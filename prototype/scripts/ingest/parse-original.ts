/**
 * BISVEDA — parse one stored original (R2.3, ARCHITECTURE.md §6).
 *
 * Runs the existing PyMuPDF + RapidOCR parser (scripts/parse_pdf_json.py).
 * Per-page OCR fallback is already done by the parser; this adds a quality
 * summary and a garbage-glyph check. The parser's temp output goes under
 * storage/tmp (project drive), not os.tmpdir() (C:).
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { STORAGE_ROOT } from "../../src/lib/ingest/upload";
import type { RawPage } from "../kb/types";

const PARSE_SCRIPT = path.resolve(__dirname, "..", "parse_pdf_json.py");
const BOILERPLATE_PATTERNS: RegExp[] = [
  /Disclosure to Promote the Right To Information/i,
  /\bBLANK\s*PAGE\b/i,
  /BIS is a statutory institution established under the Bureau of Indian Standards Act/i,
  /IGNORANTIA\s*JURIS\s*NONEXCUSAT/i,
];

export interface ParsedDocument {
  totalPages: number;
  pages: RawPage[];
  /** Pages with almost no text (blank scans, cover pages). */
  emptyPages: number[];
  /** Pages where a high share of characters are not letters, digits, punctuation or spaces. */
  lowQualityPages: number[];
  ocrPages: number;
  /** 0..1: share of pages that carry usable text. */
  parseQuality: number;
  /** Boilerplate pages (RTI cover, copyright), excluded from chunking. */
  strippedPages: number[];
}

/** Share of characters that look like garbage (control chars, replacement chars, odd symbols). */
function garbageRatio(text: string): number {
  if (text.length === 0) return 0;
  let bad = 0;
  for (const ch of text) {
    if (/[\p{L}\p{N}\p{P}\p{Zs}\n\r\t|]/u.test(ch) || ch === "°" || ch === "±" || ch === "×") continue;
    bad++;
  }
  return bad / text.length;
}

export function parseOriginal(pdfPath: string, tag: string): ParsedDocument {
  const tmpDir = path.join(STORAGE_ROOT, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const outJson = path.join(tmpDir, `${tag}.${Date.now()}.json`);

  const res = spawnSync("python", [PARSE_SCRIPT, pdfPath, outJson], {
    encoding: "utf-8",
    timeout: 900_000,
    cwd: path.dirname(PARSE_SCRIPT),
  });
  if (res.error) throw new Error(`Could not start the PDF parser: ${res.error.message}`);
  if (res.status !== 0 || !fs.existsSync(outJson)) {
    throw new Error(`The PDF parser failed (exit ${res.status}): ${(res.stderr || res.stdout || "").trim().slice(0, 500)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(outJson, "utf-8"));
  } finally {
    try {
      fs.unlinkSync(outJson);
    } catch {
      /* ignore */
    }
  }

  const pages: RawPage[] = (parsed.pages ?? []).map((p: any) => {
    const text = String(p.text ?? "");
    return {
      pageNumber: p.pageNumber,
      text,
      charCount: text.length,
      headings: Array.isArray(p.headings) ? p.headings : [],
      tables: Array.isArray(p.tables) ? p.tables : [],
      isOcr: Boolean(p.isOcr),
      ocrQuality: typeof p.ocrQuality === "number" ? p.ocrQuality : undefined,
    };
  });
  if (pages.length === 0) throw new Error("The parser returned no pages.");

  const emptyPages: number[] = [];
  const lowQualityPages: number[] = [];
  const strippedPages: number[] = [];
  let withText = 0;
  for (const p of pages) {
    const t = p.text.trim();
    if (t.length < 15) emptyPages.push(p.pageNumber);
    else withText++;
    if (BOILERPLATE_PATTERNS.some((re) => re.test(t)) || t.length < 15) strippedPages.push(p.pageNumber);
    if (t.length >= 15 && garbageRatio(t) > 0.2) lowQualityPages.push(p.pageNumber);
  }

  return {
    totalPages: pages.length,
    pages,
    emptyPages,
    lowQualityPages,
    ocrPages: pages.filter((p) => p.isOcr).length,
    parseQuality: Math.round((withText / pages.length) * 1000) / 1000,
    strippedPages,
  };
}
