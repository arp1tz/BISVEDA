/**
 * BISVEDA — KB build, Stage 4: Standards registry (P1.5)
 *
 * One record per standard, derived only from its own PDF's chunks. The
 * scope text is taken verbatim from clause "1" or "1.1" (BIS standards put
 * "1 SCOPE" / "1.1 This standard specifies..." first); if that wasn't
 * cleanly detected — real risk on 30+ year old scanned/OCR'd documents —
 * we fall back to a title match, then the longest early real chunk, never
 * inventing text. This field is descriptive only (an "about this standard"
 * blurb); it is not used for RAG citations, which come from `chunks.json`
 * directly regardless of how this field turned out.
 */

import type { KbChunk, KbStandard, RawPage, SourceDoc } from "./types";

/**
 * On some pages the source scan's embedded font is corrupted enough that
 * PyMuPDF extracts the wrong character for a clause number (observed: "1"
 * came out as "t" on an IS 15644 page) — the clause-heading regex in
 * chunk.ts can't recover from that, because the digit genuinely isn't
 * there. For the scope-text field specifically we don't need a clean
 * clause id, just the passage: search the raw page text directly for the
 * word "Scope" near the start of the document and take a window after it.
 */
function findScopeInPages(pages: RawPage[]): string | null {
  const earlyPages = pages.slice(0, Math.max(3, Math.ceil(pages.length * 0.3)));
  for (const page of earlyPages) {
    // Case-insensitive: BIS standards render this heading as "SCOPE", "Scope" or "scope"
    // depending on the document, and a corrupted font can also mangle the clause number
    // right before it — but the word itself is a reliable anchor either way.
    const match = page.text.match(/\bscope\b/i);
    if (!match || match.index == null) continue;
    const window = page.text.slice(match.index, match.index + 500).trim();
    if (window.length >= MIN_USABLE_SCOPE_CHARS) return window;
  }
  return null;
}

const MIN_USABLE_SCOPE_CHARS = 60;

export function buildStandardRecord(doc: SourceDoc, chunks: KbChunk[], contentPages: RawPage[]): KbStandard {
  const ownChunks = chunks.filter((c) => c.doc_id === doc.doc_id);

  const earlyRealChunks = ownChunks.filter((c) => c.clause !== "0").slice(0, 5);
  const longestEarlyChunk = [...earlyRealChunks].sort((a, b) => b.text.length - a.text.length)[0];

  // Raw-page text search first: it's immune to the clause-chunker's known
  // failure modes on this corpus (column-interleaved text merging an
  // unrelated later clause into the "1" segment; a corrupted font turning
  // the clause number into a stray letter so no chunk is even labelled "1").
  const chunkScope =
    ownChunks.find((c) => /^1(\.1)?$/.test(c.clause)) ??
    ownChunks.find((c) => /scope/i.test(c.clause_title));

  const scopeText =
    findScopeInPages(contentPages) ??
    (chunkScope ? chunkScope.text.trim() : null) ??
    (longestEarlyChunk ? longestEarlyChunk.text.trim() : null) ??
    (ownChunks[0] ? ownChunks[0].text.trim() : "");

  return {
    id: doc.standard_id,
    title: doc.title,
    year: doc.year,
    domain: doc.domain,
    scope_text: scopeText,
    doc_id: doc.doc_id,
    chunk_count: ownChunks.length,
  };
}
