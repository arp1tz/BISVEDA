/**
 * BISVEDA — KB build, Stage 2: Clause-aware chunker (P1.3)
 *
 * Fresh implementation (the old `lib/ingestion/pipeline.ts` chunker was
 * archived in P0 along with the rest of that file — its overall approach is
 * reused here, but the clause regex is rewritten per TODO.md P1.3: reject
 * top-level numbers above 40, and reject bare years).
 *
 * Rules:
 *  - Never split a table (tracks markdown `| ... |` rows).
 *  - Target 250-450 tokens (~1000-1800 chars at 4 chars/token).
 *  - A tiny trailing segment (<80 chars) merges into the next one instead of
 *    becoming its own chunk.
 */

import { createHash } from "crypto";
import type { KbChunk, RawPage, SourceDoc } from "./types";

const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = 350 * CHARS_PER_TOKEN; // ~350 tokens mid-target (250-450 range)
const OVERLAP_CHARS = 32 * CHARS_PER_TOKEN;
const MIN_SEGMENT_CHARS = 80;

// Top-level clause number 1-40 (BIS standards rarely exceed ~30 top-level clauses).
// Requires a real word (capital letter + lowercase letter) right after the number,
// so it doesn't match a bare year ("1993 ") or a page-footer digit run.
const CLAUSE_RE = /^(\d{1,2}(?:\.\d{1,2}){0,4})\s+([A-Z][A-Za-z].{0,120})$/;
const ANNEX_RE = /^(ANNEX\s+[A-Z])\s*[-:]?\s*(.{0,120})$/i;
const TABLE_HEADER_RE = /^(Table\s+\d+[A-Za-z]?)\s*[-:]?\s*(.{0,120})$/i;
const FIGURE_HEADER_RE = /^(Figure\s+\d+[A-Za-z]?)\s*[-:]?\s*(.{0,120})$/i;

function isTopLevelInRange(clauseNumber: string): boolean {
  const top = parseInt(clauseNumber.split(".")[0], 10);
  return Number.isFinite(top) && top >= 1 && top <= 40;
}

interface ClauseSegment {
  clause: string;
  clauseTitle: string;
  text: string;
  pages: Set<number>;
  breadcrumb: string[];
}

function matchClauseHeading(line: string): { clause: string; title: string } | null {
  const mAnnex = line.match(ANNEX_RE);
  if (mAnnex) return { clause: mAnnex[1].toUpperCase(), title: (mAnnex[2] || mAnnex[1]).trim() };

  const mTable = line.match(TABLE_HEADER_RE);
  if (mTable) return { clause: mTable[1], title: (mTable[2] || mTable[1]).trim() };

  const mFig = line.match(FIGURE_HEADER_RE);
  if (mFig) return { clause: mFig[1], title: (mFig[2] || mFig[1]).trim() };

  const mClause = line.match(CLAUSE_RE);
  if (mClause && isTopLevelInRange(mClause[1])) {
    return { clause: mClause[1], title: mClause[2].trim() };
  }
  return null;
}

/**
 * Merges a tiny heading-only segment (e.g. a bare "1 SCOPE" with no body
 * before the next numbered sub-clause starts) forward into the segment that
 * follows it, keeping the earlier segment's clause id/title/breadcrumb.
 * This is why "1 SCOPE" + "1.1 This standard specifies..." end up as one
 * "clause 1" chunk instead of the heading being silently dropped and the
 * real scope text losing its clause number.
 */
function mergeTinyForward(segments: ClauseSegment[]): ClauseSegment[] {
  const working = [...segments];
  const merged: ClauseSegment[] = [];

  for (let i = 0; i < working.length; i++) {
    const seg = working[i];
    const isFrontMatter = seg.clause === "0";
    if (!isFrontMatter && seg.text.trim().length < MIN_SEGMENT_CHARS && i + 1 < working.length) {
      const next = working[i + 1];
      working[i + 1] = {
        clause: seg.clause,
        clauseTitle: seg.clauseTitle,
        text: seg.text + "\n" + next.text,
        pages: new Set([...seg.pages, ...next.pages]),
        breadcrumb: seg.breadcrumb,
      };
      continue; // folded into the next segment; don't emit this one separately
    }
    merged.push(seg);
  }

  return merged;
}

function buildClauseSegments(pages: RawPage[], documentTitle: string): ClauseSegment[] {
  const segments: ClauseSegment[] = [];
  let current: ClauseSegment = {
    clause: "0",
    clauseTitle: documentTitle,
    text: "",
    pages: new Set(),
    breadcrumb: [documentTitle],
  };

  function flush() {
    if (current.text.trim().length > 0) segments.push(current);
  }

  for (const page of pages) {
    const lines = page.text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      const heading = trimmed ? matchClauseHeading(trimmed) : null;

      if (heading) {
        flush();
        current = {
          clause: heading.clause,
          clauseTitle: heading.title || heading.clause,
          text: "",
          pages: new Set(),
          breadcrumb: [documentTitle, `${heading.clause} ${heading.title}`.trim()],
        };
      }

      current.text += line + "\n";
      current.pages.add(page.pageNumber);
    }
  }
  flush();

  return segments;
}

function pageRange(pages: Set<number>): [number, number] {
  const arr = Array.from(pages).sort((a, b) => a - b);
  return [arr[0] ?? 0, arr[arr.length - 1] ?? 0];
}

function isTableLine(line: string): boolean {
  return line.trim().startsWith("|");
}

function splitLongSegment(text: string): string[] {
  if (text.length <= TARGET_CHARS) return [text];

  const lines = text.split("\n");
  const parts: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  let inTable = false;

  for (const line of lines) {
    const tableLine = isTableLine(line);
    if (tableLine) inTable = true;
    else if (inTable && !tableLine) inTable = false;

    buf.push(line);
    bufLen += line.length + 1;

    if (bufLen >= TARGET_CHARS && !inTable) {
      parts.push(buf.join("\n").trim());
      // overlap: keep the last ~OVERLAP_CHARS worth of lines
      let overlapLen = 0;
      const overlapLines: string[] = [];
      for (let i = buf.length - 1; i >= 0; i--) {
        overlapLines.unshift(buf[i]);
        overlapLen += buf[i].length + 1;
        if (overlapLen >= OVERLAP_CHARS) break;
      }
      buf = overlapLines;
      bufLen = overlapLen;
    }
  }
  if (buf.join("\n").trim().length > 0) parts.push(buf.join("\n").trim());

  return parts;
}

/**
 * Chunks one document's content pages (boilerplate pages already excluded
 * by scripts/kb/parse.ts's contentPages()).
 */
export function chunkDocument(doc: SourceDoc, pages: RawPage[]): KbChunk[] {
  const segments = buildClauseSegments(pages, doc.title);
  const merged = mergeTinyForward(segments);

  const chunks: KbChunk[] = [];
  // The same clause label can head two different segments (a mis-detected heading, or two "Annex C" passages),
  // which used to produce identical ids and let one chunk shadow the other in BM25 and RRF (TD-23).
  // The first occurrence keeps its id; later ones get "~2", "~3", ...
  const idCount = new Map<string, number>();
  for (const seg of merged) {
    const text = seg.text.trim();
    if (text.length < MIN_SEGMENT_CHARS) continue; // still-tiny leading/orphan segment: drop

    const parts = splitLongSegment(text);
    const [pageStart, pageEnd] = pageRange(seg.pages);

    parts.forEach((part, idx) => {
      if (!part.trim()) return;
      const baseId = `${doc.doc_id}-${seg.clause.replace(/\s+/g, "_")}-${idx}`;
      const seen = (idCount.get(baseId) ?? 0) + 1;
      idCount.set(baseId, seen);
      const chunkId = seen === 1 ? baseId : `${baseId}~${seen}`;
      chunks.push({
        chunk_id: chunkId,
        doc_id: doc.doc_id,
        standard_id: doc.standard_id,
        clause: seg.clause,
        clause_title: seg.clauseTitle,
        breadcrumb: seg.breadcrumb,
        page_start: pageStart,
        page_end: pageEnd,
        text: part,
        tokens: Math.ceil(part.length / CHARS_PER_TOKEN),
        sha256: createHash("sha256").update(part).digest("hex"),
        embedding: null,
      });
    });
  }

  return chunks;
}
