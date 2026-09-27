/**
 * BISVEDA — KB build, Stage 1: Parse (P1.2)
 *
 * Calls the existing Python parser (PyMuPDF + RapidOCR fallback) on each
 * source PDF, strips known BIS/archive.org boilerplate pages, and caches
 * the raw parse to data/kb/raw/{doc_id}.json.
 *
 * No fabricated fallback: a parse failure throws. An empty knowledge base
 * is honest; invented chunk text is not.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type { RawDoc, RawPage, SourceDoc } from "./types";
import { DOCS_DIR } from "./sources";

const REPO_ROOT = path.resolve(__dirname, "../../.."); // .../prototype/scripts/kb -> repo root
const PROTOTYPE_ROOT = path.resolve(__dirname, "../.."); // .../prototype
const RAW_DIR = path.join(PROTOTYPE_ROOT, "data", "kb", "raw");
const PARSE_SCRIPT = path.join(PROTOTYPE_ROOT, "scripts", "parse_pdf_json.py");

/** Boilerplate that appears on the RTI cover / copyright / back-cover pages of these archive.org BIS scans. */
const BOILERPLATE_PATTERNS: RegExp[] = [
  /Disclosure to Promote the Right To Information/i,
  /\bBLANK\s*PAGE\b/i,
  /BIS is a statutory institution established under the Bureau of Indian Standards Act/i,
  /IGNORANTIA\s*JURIS\s*NONEXCUSAT/i, // copyright watermark stamp seen on scanned blank pages
];

function isBoilerplatePage(page: RawPage): boolean {
  const text = page.text.trim();
  if (text.length < 15) return true; // effectively blank
  return BOILERPLATE_PATTERNS.some((re) => re.test(text));
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Runs the Python parser on one PDF. Throws on any failure — callers must
 * not substitute fabricated text.
 */
function runPythonParser(pdfPath: string): Omit<RawDoc, "doc_id" | "strippedPages"> {
  const tmpDir = path.join(os.tmpdir(), "bisveda_kb_build");
  ensureDir(tmpDir);
  const outJson = path.join(tmpDir, `${path.basename(pdfPath)}.${Date.now()}.json`);

  const res = spawnSync("python", [PARSE_SCRIPT, pdfPath, outJson], {
    encoding: "utf-8",
    timeout: 180000,
    cwd: path.dirname(PARSE_SCRIPT),
  });

  if (res.error) {
    throw new Error(`Failed to spawn python for ${pdfPath}: ${res.error.message}`);
  }
  if (res.status !== 0 || !fs.existsSync(outJson)) {
    throw new Error(
      `parse_pdf_json.py failed for ${pdfPath} (exit ${res.status}): ${res.stderr || res.stdout}`
    );
  }

  try {
    const raw = fs.readFileSync(outJson, "utf-8");
    return JSON.parse(raw);
  } finally {
    try {
      fs.unlinkSync(outJson);
    } catch {
      /* ignore cleanup failure */
    }
  }
}

/**
 * Parses one source document, using the on-disk cache at data/kb/raw/{doc_id}.json
 * unless `force` is set. Strips boilerplate pages (flagged, not deleted from
 * the raw record — chunk.ts skips them).
 */
export function parseSource(doc: SourceDoc, opts: { force?: boolean } = {}): RawDoc {
  ensureDir(RAW_DIR);
  const cachePath = path.join(RAW_DIR, `${doc.doc_id}.json`);

  if (!opts.force && fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  }

  const pdfPath = path.join(REPO_ROOT, DOCS_DIR, doc.file);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Source PDF not found: ${pdfPath}`);
  }

  const parsed = runPythonParser(pdfPath);
  const strippedPages = parsed.pages.filter(isBoilerplatePage).map((p) => p.pageNumber);

  const rawDoc: RawDoc = {
    doc_id: doc.doc_id,
    totalPages: parsed.totalPages,
    totalChars: parsed.totalChars,
    detectedStandardNumber: parsed.detectedStandardNumber,
    detectedTitle: parsed.detectedTitle,
    editionYear: parsed.editionYear,
    isOcrDoc: parsed.isOcrDoc,
    ocrPagesCount: parsed.ocrPagesCount,
    meanOcrQuality: parsed.meanOcrQuality,
    pages: parsed.pages,
    strippedPages,
  };

  fs.writeFileSync(cachePath, JSON.stringify(rawDoc, null, 2), "utf-8");
  return rawDoc;
}

/** Content pages only (boilerplate pages excluded), for the chunker. */
export function contentPages(raw: RawDoc): RawPage[] {
  const stripped = new Set(raw.strippedPages);
  return raw.pages.filter((p) => !stripped.has(p.pageNumber));
}
