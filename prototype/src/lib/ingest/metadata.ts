/**
 * BISVEDA — metadata read from the PDF itself (R2.5, ARCHITECTURE.md §6.3).
 *
 * These are suggestions shown to the officer next to what the uploader typed,
 * with a warning where they disagree. Nothing here is applied silently.
 */

import { extractIsReferences, normalizeStandardId, suggestProductTerms } from "./ids";
import type { StructNode } from "./structure";

export interface DetectedMeta {
  standard_id: string | null;
  edition_year: number | null;
  revision: string | null;
  reaffirmed_year: number | null;
  title: string | null;
  amendment_no: number | null;
  scope_excerpt: string | null;
  referenced_standards: Array<{ id: string; count: number }>;
  product_terms: string[];
}

export interface Mismatch {
  field: "standard_id" | "edition_year" | "title" | "kind" | "amendment_no";
  uploaded: string;
  detected: string;
}

export interface UploadedMeta {
  standard_id: string;
  title: string;
  edition_year: number | null;
  kind: "edition" | "amendment";
  amendment_no: number | null;
}

const REVISION_WORDS = "First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth";

function cleanTitle(lines: string[]): string | null {
  const t = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-—–]+\s*/g, " — ")
    .replace(/[\s—]+$/, "")
    .trim();
  return t.length >= 5 ? t : null;
}

/** Title lines between "Indian Standard" and "( Third Revision )" or the first non-title line. */
function detectTitle(firstPages: string): { title: string | null; revision: string | null } {
  const rev = firstPages.match(new RegExp(`\\(\\s*(${REVISION_WORDS})\\s+Revision\\s*\\)`, "i"));
  const revision = rev ? `${rev[1][0].toUpperCase()}${rev[1].slice(1).toLowerCase()} Revision` : null;
  const lines = firstPages.split("\n");
  const start = lines.findIndex((l) => /^\s*Indian\s+Standard\s*$/i.test(l));
  if (start === -1) return { title: null, revision };
  const picked: string[] = [];
  for (let i = start + 1; i < lines.length && picked.length < 4; i++) {
    const l = lines[i].trim();
    if (!l) {
      if (picked.length) break;
      continue;
    }
    if (/^\(/.test(l) || /^(UDC|ICS)\b/i.test(l) || /^\d/.test(l)) break;
    picked.push(l);
  }
  return { title: cleanTitle(picked), revision };
}

function scopeExcerpt(nodes: StructNode[]): string | null {
  const scope = nodes.find((n) => n.kind === "clause" && (n.number === "1" || /^scope$/i.test(n.title)));
  if (!scope) return null;
  const parts = [scope, ...nodes.filter((n) => n.parentKey === scope.key)].map((n) => n.text);
  const text = parts.join("\n").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 600) : null;
}

export function detectMetadata(input: {
  parserStandard: string | null;
  parserTitle: string | null;
  parserYear: string | number | null;
  firstPagesText: string;
  allText: string;
  nodes: StructNode[];
  ownId: string;
}): DetectedMeta {
  const std = input.parserStandard ? normalizeStandardId(input.parserStandard) : null;
  const { title, revision } = detectTitle(input.firstPagesText);
  const reaff = input.allText.match(/Reaffirmed\s*[:\-]?\s*((?:19|20)\d{2})/i);
  const amd = input.firstPagesText.match(/AMENDMENT\s+NO\.?\s*(\d{1,2})\b/i);
  const parserYear = input.parserYear ? Number(input.parserYear) : null;
  const refs = Array.from(extractIsReferences(input.allText, input.ownId).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => ({ id, count }));
  const effectiveTitle = title ?? input.parserTitle;
  return {
    standard_id: std?.isStandard ? std.id : null,
    edition_year: std?.year ?? (parserYear && parserYear > 1900 ? parserYear : null),
    revision,
    reaffirmed_year: reaff ? Number(reaff[1]) : null,
    title: effectiveTitle,
    amendment_no: amd ? Number(amd[1]) : null,
    scope_excerpt: scopeExcerpt(input.nodes),
    referenced_standards: refs,
    product_terms: effectiveTitle ? suggestProductTerms(effectiveTitle) : [],
  };
}

function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !["for", "and", "the", "specification"].includes(w)));
}

export function compareMetadata(uploaded: UploadedMeta, detected: DetectedMeta): Mismatch[] {
  const out: Mismatch[] = [];
  if (detected.standard_id && detected.standard_id !== uploaded.standard_id) {
    out.push({ field: "standard_id", uploaded: uploaded.standard_id, detected: detected.standard_id });
  }
  if (detected.edition_year && uploaded.edition_year && detected.edition_year !== uploaded.edition_year) {
    out.push({ field: "edition_year", uploaded: String(uploaded.edition_year), detected: String(detected.edition_year) });
  }
  if (detected.title && uploaded.title) {
    const a = tokens(detected.title);
    const b = tokens(uploaded.title);
    const inter = [...a].filter((w) => b.has(w)).length;
    const union = new Set([...a, ...b]).size || 1;
    if (inter / union < 0.34) out.push({ field: "title", uploaded: uploaded.title, detected: detected.title });
  }
  if (uploaded.kind === "edition" && detected.amendment_no) {
    out.push({ field: "kind", uploaded: "edition", detected: `amendment No. ${detected.amendment_no}` });
  }
  if (uploaded.kind === "amendment" && detected.amendment_no && uploaded.amendment_no && detected.amendment_no !== uploaded.amendment_no) {
    out.push({ field: "amendment_no", uploaded: String(uploaded.amendment_no), detected: String(detected.amendment_no) });
  }
  return out;
}
