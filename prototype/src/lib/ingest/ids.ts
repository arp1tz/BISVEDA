/**
 * BISVEDA — standard ids for ingestion (R2.1, R2.5, R2.6).
 *
 * One spelling per document: "IS 4151", "IS 9873 (Part 1)", "FORM-I". The edition
 * year is not part of the id ("IS 4151:1993" is the 1993 edition of "IS 4151"),
 * so a new edition of a standard lands on the same document.
 * The citation regex matches scripts/kb/graph.ts (kept separate so kb:build is unchanged).
 */

export interface NormalizedId {
  id: string;
  isStandard: boolean;
  baseNumber: string | null;
  part: string | null;
  year: number | null;
}

const IS_ID_RE = /^\s*IS\s*[:\-]?\s*(\d{1,6})\s*(?:\(\s*Part\s*(\d{1,3})\s*\)|Part\s*(\d{1,3})|[-/]\s*(\d{1,4}))?\s*(?:[:\-]\s*(\d{4}))?\s*$/i;
const FORM_RE = /^\s*form[\s-]*([ivx]{1,5}|\d{1,2})\s*$/i;

export function normalizeStandardId(raw: string): NormalizedId {
  const text = raw.replace(/\s+/g, " ").trim();
  const m = text.match(IS_ID_RE);
  if (m) {
    const num = m[1];
    let part = m[2] || m[3] || null;
    let year = m[5] ? Number(m[5]) : null;
    if (m[4]) {
      // "IS 9873-1" is Part 1; "IS 1417-1999" is a year.
      if (/^(19|20)\d{2}$/.test(m[4]) && !year) year = Number(m[4]);
      else if (m[4].length <= 2) part = m[4];
    }
    return {
      id: part ? `IS ${num} (Part ${part})` : `IS ${num}`,
      isStandard: true,
      baseNumber: num,
      part,
      year,
    };
  }
  const f = text.match(FORM_RE);
  if (f) return { id: `FORM-${f[1].toUpperCase()}`, isStandard: false, baseNumber: null, part: null, year: null };
  return { id: text, isStandard: false, baseNumber: null, part: null, year: null };
}

/** URL-safe public id for /api/docs links, in the style of the original nine ("is-9873-1"). */
export function slugForId(id: string): string {
  return id
    .toLowerCase()
    .replace(/\(\s*part\s*(\d+)\s*\)/, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Matches "IS 2062", "IS 2062:2011", "IS 9873 (Part 1)", "IS 9873 Part 1".
const IS_CITE_RE = /\bIS\s*(\d{2,6})\s*(?:\(\s*Part\s*(\d+)\s*\)|Part\s*(\d+))?(?:\s*:\s*\d{4})?/gi;

/** IS numbers cited in a text, with counts. The document's own id is left out. */
export function extractIsReferences(text: string, ownId: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = new RegExp(IS_CITE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const part = m[2] || m[3];
    const canon = part ? `IS ${m[1]} (Part ${part})` : `IS ${m[1]}`;
    if (canon === ownId) continue;
    counts.set(canon, (counts.get(canon) || 0) + 1);
  }
  return counts;
}

/** Domain keys stored on documents. The first four are the original corpus. */
export const DOMAIN_KEYS: Record<string, string> = {
  "Helmets & Head Protection": "helmets",
  "Toys & Child Safety": "toys",
  "Gold & Precious Metals Hallmarking": "gold",
  "Application / Forms": "forms",
  "Steel & Construction Products": "steel",
  "Electrical & Electronics": "electrical",
  "Food & Agricultural Products": "food",
  "Chemicals & Fertilizers": "chemicals",
  "Other / General": "other",
};

export function domainKey(labelOrKey: string): string {
  if (DOMAIN_KEYS[labelOrKey]) return DOMAIN_KEYS[labelOrKey];
  const k = labelOrKey.trim().toLowerCase();
  return Object.values(DOMAIN_KEYS).includes(k) ? k : "other";
}

const GENERIC_TITLE_WORDS = new Set(
  `specification specifications requirement requirements safety general method methods determination part indian
   standard standards code practice guidelines guide revision test tests testing for of and the in on to with
   its from by at as or an a use used other certain related aspects properties competence application grant sale
   certificate registration`.split(/\s+/).filter(Boolean),
);

/** Product words suggested from a title, for the officer to confirm (e.g. "Pressure Cookers" → ["pressure", "cookers"]). */
export function suggestProductTerms(title: string): string[] {
  const words = (title.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !GENERIC_TITLE_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, 6);
}
