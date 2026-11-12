/**
 * BISVEDA — parse one stored original (R2.3, ARCHITECTURE.md §6).
 *
 * Runs scripts/parse_pdf_json.py --enhanced (PyMuPDF + RapidOCR): OCR for scanned,
 * low-alphanumeric or garbled-word pages, and column-aware reading order where it
 * reads clause numbers in order more often. Adds a garbage-glyph check per page.
 * The parser's temp output goes under storage/tmp (project drive), not os.tmpdir() (C:).
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

/** A failure that retrying cannot fix (corrupt or unreadable file, no text). */
export class PermanentError extends Error {}

export interface ParsedDocument {
  totalPages: number;
  pages: RawPage[];
  emptyPages: number[];
  lowQualityPages: number[];
  ocrPages: number[];
  ocrReasons: Record<string, number[]>;
  twoColumnPages: number[];
  reorderedPages: number[];
  /** 0..1: share of pages that carry usable text. */
  parseQuality: number;
  strippedPages: number[];
  parser: { standard: string | null; title: string | null; year: string | number | null };
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

  const res = spawnSync("python", [PARSE_SCRIPT, pdfPath, outJson, "--enhanced"], {
    encoding: "utf-8",
    timeout: 1_800_000,
    cwd: path.dirname(PARSE_SCRIPT),
  });
  if (res.error) throw new Error(`Could not start the PDF parser: ${res.error.message}`);
  if (res.status !== 0 || !fs.existsSync(outJson)) {
    const detail = (res.stderr || res.stdout || "").trim().slice(0, 500);
    if (/FileDataError|cannot open|broken|not a pdf|format error|password/i.test(detail)) {
      throw new PermanentError(`The PDF could not be opened (it may be corrupt or encrypted): ${detail}`);
    }
    throw new Error(`The PDF parser failed (exit ${res.status}): ${detail}`);
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
  if (pages.length === 0) throw new PermanentError("The PDF has no pages.");

  const emptyPages: number[] = [];
  const lowQualityPages: number[] = [];
  const strippedPages: number[] = [];
  const ocrReasons: Record<string, number[]> = {};
  const twoColumnPages: number[] = [];
  const reorderedPages: number[] = [];
  let withText = 0;
  for (const raw of parsed.pages ?? []) {
    const n = raw.pageNumber as number;
    const t = String(raw.text ?? "").trim();
    if (t.length < 15) emptyPages.push(n);
    else withText++;
    if (BOILERPLATE_PATTERNS.some((re) => re.test(t)) || t.length < 15) strippedPages.push(n);
    if (t.length >= 15 && garbageRatio(t) > 0.2) lowQualityPages.push(n);
    const reason = raw.quality?.ocrReason;
    if (reason) (ocrReasons[reason] ??= []).push(n);
    if (raw.layout === "two_column" || raw.layout === "two_column_reordered") twoColumnPages.push(n);
    if (raw.layout === "two_column_reordered") reorderedPages.push(n);
  }

  return {
    totalPages: pages.length,
    pages,
    emptyPages,
    lowQualityPages,
    ocrPages: pages.filter((p) => p.isOcr).map((p) => p.pageNumber),
    ocrReasons,
    twoColumnPages,
    reorderedPages,
    parseQuality: Math.round((withText / pages.length) * 1000) / 1000,
    strippedPages,
    parser: {
      standard: parsed.detectedStandardNumber ?? null,
      title: parsed.detectedTitle ?? null,
      year: parsed.editionYear ?? null,
    },
  };
}
