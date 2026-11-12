/**
 * BISVEDA — structure-aware chunker (R2.4; RESEARCH.md §5; ARCHITECTURE.md §6.1–6.2).
 *
 * Builds the clause tree of one document from its page text, deterministically:
 *  - numbered clauses get their parent from the numbering (3.6.1 → 3.6 → 3);
 *  - a candidate clause number is accepted only if it can follow the previous one
 *    (3.9 → 3.10 yes, 3.9 → 3.15 no), which drops page numbers, list items and
 *    column-interleaving accidents;
 *  - annexes (and A-2.1 style annex clauses), tables and figures are nodes;
 *  - the foreword and the title page are front-matter nodes, not a clause "0" bucket;
 *  - the BIS back cover (addresses, amendment record) is kept but not searchable;
 *  - a heading's title is kept only when it looks like a title ("3.1 Shell",
 *    "7 MARKING"), not a sentence fragment ("1.2 The helmets covered by this standard are").
 * Each node's own text becomes its chunk(s); long text splits at sentence ends and
 * never inside a table. Used by the ingestion worker; kb:build keeps scripts/kb/chunk.ts.
 */

export const STRUCT_PATH_SEP = " › ";

export interface StructPage {
  pageNumber: number;
  text: string;
}

export type NodeKind = "root" | "front_matter" | "clause" | "annex" | "table" | "figure" | "note";

export interface StructNode {
  key: string;
  kind: NodeKind;
  /** "3.1", "A-2.1", "ANNEX A", "Table 2", "Figure 1", "FOREWORD"; null for root / front / back matter. */
  number: string | null;
  title: string;
  parentKey: string | null;
  depth: number;
  ord: number;
  pageStart: number;
  pageEnd: number;
  /** Heading line plus the node's own text (children excluded). */
  text: string;
  searchable: boolean;
  /** Labels from the document title down to this node. */
  path: string[];
}

export interface StructChunk {
  nodeKey: string;
  text: string;
  pageStart: number;
  pageEnd: number;
}

export interface StructureStats {
  nodes: number;
  clauses: number;
  untitledClauses: number;
  annexes: number;
  tables: number;
  figures: number;
  rejectedHeadings: number;
  chunks: number;
  backMatterChars: number;
}

export interface Structure {
  nodes: StructNode[];
  chunks: StructChunk[];
  stats: StructureStats;
}

interface Line {
  text: string;
  page: number;
}

interface MutableNode extends StructNode {
  lines: Line[];
  /** How many leading lines are the heading itself (2 when the number and title sit on separate lines). */
  headLines: number;
}

const TARGET_CHARS = 1200;
const MAX_CHARS = 1600;
const MIN_CHUNK_CHARS = 25;

const FUNCTION_END =
  /\b(?:a|an|the|of|to|in|for|and|or|with|by|as|at|on|is|are|be|shall|should|may|that|which|from|than|when|where|its|their|this|these|such|not)$/i;

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const cleanTitle = (s: string) => s.replace(/\s+/g, " ").replace(/[\s.:—–-]+$/, "").trim();

/** Keeps a heading's text as a title only when it reads like one. */
export function splitHeading(rest: string): { title: string; body: string } {
  const r = rest.replace(/\s+/g, " ").trim();
  if (!r) return { title: "", body: "" };
  const sep = r.match(/^(.{2,70}?)\s*(?:—|–|-{1,2}|:)\s+(.+)$/);
  if (sep && wordCount(sep[1]) <= 8 && /^[A-Z(]/.test(sep[1]) && !/[.;,]$/.test(sep[1]) && !FUNCTION_END.test(sep[1].trim())) {
    return { title: cleanTitle(sep[1]), body: sep[2] };
  }
  const letters = r.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase() && wordCount(r) <= 12) return { title: cleanTitle(r), body: "" };
  const sentenceStart = /^(?:The|This|These|Those|It|Its|Each|All|Every|Any|A|An|In|For|When|Where|If|Unless|No)\s/.test(r) && wordCount(r) >= 3;
  if (!sentenceStart && wordCount(r) <= 7 && !FUNCTION_END.test(r) && !/[,;:.]$/.test(r) && !/\bshall\b/i.test(r)) {
    return { title: cleanTitle(r), body: "" };
  }
  return { title: "", body: r };
}

type Num = number[];
const parseNum = (s: string): Num => s.split(".").map(Number);

/** Whether clause number `next` can follow `last` in reading order. */
export function canFollow(last: Num | null, next: Num): boolean {
  if (next[0] < 1 || next[0] > 40 || next.some((n) => n > 80)) return false;
  const smallTail = (from: number) => next.slice(from).every((n) => n >= 1 && n <= 2);
  if (!last) return next[0] <= 3 && smallTail(1);
  if (next.length > last.length && last.every((v, i) => next[i] === v)) return smallTail(last.length);
  const n = Math.min(last.length, next.length);
  for (let j = 0; j < n; j++) {
    if (next[j] === last[j]) continue;
    const d = next[j] - last[j];
    return d >= 1 && d <= 3 && smallTail(j + 1);
  }
  return false; // equal to the previous number or one of its ancestors
}

interface ClauseCandidate {
  idx: number;
  num: Num;
  numStr: string;
  rest: string;
  /** Last line index the heading uses (the title line when the number stands alone). */
  lastIdx: number;
}

/**
 * Picks the longest chain of candidates in which each number can follow the previous one.
 * A garbled or interleaved number then costs only itself, not every heading after it
 * (IS 9873-1 loses clauses 1-3 to a broken font; its 4.1 onwards still form a chain).
 */
function acceptClauseChain(cands: ClauseCandidate[]): Set<number> {
  const n = cands.length;
  const len = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = Math.max(0, i - 400); j < i; j++) {
      if (len[j] + 1 > len[i] && canFollow(cands[j].num, cands[i].num)) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
  }
  const startsWell = (i: number) => {
    let s = i;
    while (prev[s] !== -1) s = prev[s];
    return canFollow(null, cands[s].num);
  };
  let best = -1;
  for (let i = 0; i < n; i++) {
    if (best === -1 || len[i] > len[best] || (len[i] === len[best] && startsWell(i) && !startsWell(best))) best = i;
  }
  const accepted = new Set<number>();
  for (let i = best; i !== -1; i = prev[i]) accepted.add(cands[i].idx);
  return accepted;
}

const CLAUSE_LINE_RE = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+([A-Z(].*)$/;
const CLAUSE_NUMBER_ONLY_RE = /^(\d{1,2}(?:\.\d{1,2}){1,4})\.?$/;
const ANNEX_RE = /^ANNEX\s+([A-H])\b\s*[-:—–]?\s*(.*)$/;
const ANNEX_MIXED_RE = /^Annex\s+([A-H])\s*$/;
const ANNEX_CLAUSE_RE = /^([A-H])-(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(\S.*)$/;
const TABLE_RE = /^Table\s+(\d{1,2}[A-Z]?)\b\.?\s*[-:—–]?\s*(.*)$/;
const FIGURE_RE = /^(?:Figure|FIGURE|FIG\.?|Fig\.?)\s+(\d{1,2}[A-Z]?)\b\.?\s*[-:—–]?\s*(.*)$/;
const FOREWORD_RE = /^(?:0\.?\s*)?(?:FOREWORD|Foreword)\s*[.:]?\s*(.*)$/;
const BACK_MATTER_RE =
  /^(?:Bureau of Indian Standards|BUREAU OF INDIAN STANDARDS|Amendments Issued Since Publication|AMENDMENTS ISSUED SINCE PUBLICATION|Copyright\s+BIS\b.*)$/;
const CAPTION_VERB_RE = /\b(?:shall|gives|given|shows|lists|is|are|was|were)\b/i;

function toLines(pages: StructPage[]): Line[] {
  const out: Line[] = [];
  for (const p of pages) {
    for (const raw of p.text.split("\n")) {
      const t = raw.replace(/\s+$/, "");
      if (/^###\s*Extracted Tables:?$/i.test(t.trim())) continue;
      out.push({ text: t, page: p.pageNumber });
    }
  }
  return out;
}

function nodeLabel(n: { kind: NodeKind; number: string | null; title: string }): string {
  if (n.kind === "front_matter" || n.kind === "note") return n.title;
  return `${n.number ?? ""} ${n.title}`.trim();
}

/** Splits a node's lines into chunk-sized parts at sentence ends, never inside a table. */
function splitLines(lines: Line[]): Line[][] {
  const total = lines.reduce((s, l) => s + l.text.length + 1, 0);
  if (total <= MAX_CHARS) return [lines];
  const parts: Line[][] = [];
  let buf: Line[] = [];
  let len = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    buf.push(line);
    len += line.text.length + 1;
    const inTable = line.text.trim().startsWith("|") && (lines[i + 1]?.text.trim().startsWith("|") ?? false);
    const boundary = line.text.trim() === "" || /[.:;]\s*$/.test(line.text);
    if (!inTable && ((len >= TARGET_CHARS && boundary) || len >= MAX_CHARS)) {
      parts.push(buf);
      buf = [];
      len = 0;
    }
  }
  if (buf.some((l) => l.text.trim())) parts.push(buf);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last.reduce((s, l) => s + l.text.length + 1, 0) < 200) {
    parts.pop();
    parts[parts.length - 1] = parts[parts.length - 1].concat(last);
  }
  return parts;
}

function finish(nodes: MutableNode[], docTitle: string, extraRejected: number): Structure {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const hasChildren = new Set(nodes.map((n) => n.parentKey).filter((k): k is string => Boolean(k)));

  for (const n of nodes) {
    const pages = n.lines.map((l) => l.page);
    n.pageStart = pages.length ? Math.min(...pages) : n.pageStart;
    n.pageEnd = pages.length ? Math.max(...pages) : n.pageEnd;
    n.text = n.lines.map((l) => l.text).join("\n").trim();
    const labels: string[] = [];
    let cur: MutableNode | undefined = n;
    while (cur && cur.kind !== "root") {
      labels.unshift(nodeLabel(cur));
      cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined;
    }
    n.path = [docTitle, ...labels.filter(Boolean)];
  }
  // Parents' page ranges cover their children.
  for (const n of [...nodes].reverse()) {
    const p = n.parentKey ? byKey.get(n.parentKey) : undefined;
    if (!p || !n.lines.length) continue;
    p.pageStart = Math.min(p.pageStart, n.pageStart);
    p.pageEnd = Math.max(p.pageEnd, n.pageEnd);
  }

  const chunks: StructChunk[] = [];
  for (const n of nodes) {
    if (!n.searchable || n.kind === "root") continue;
    const body = n.lines.slice(n.headLines).map((l) => l.text).join("\n").trim();
    if (hasChildren.has(n.key) && body.length < 15) continue; // heading-only parent ("3 TERMINOLOGY")
    if (n.text.length < MIN_CHUNK_CHARS) continue;
    for (const part of splitLines(n.lines)) {
      const text = part.map((l) => l.text).join("\n").trim();
      if (text.length < MIN_CHUNK_CHARS) continue;
      const pages = part.map((l) => l.page);
      chunks.push({ nodeKey: n.key, text, pageStart: Math.min(...pages), pageEnd: Math.max(...pages) });
    }
  }

  const count = (k: NodeKind) => nodes.filter((n) => n.kind === k).length;
  const stats: StructureStats = {
    nodes: nodes.length,
    clauses: count("clause"),
    untitledClauses: nodes.filter((n) => n.kind === "clause" && !n.title).length,
    annexes: count("annex"),
    tables: count("table"),
    figures: count("figure"),
    rejectedHeadings: extraRejected,
    chunks: chunks.length,
    backMatterChars: nodes.filter((n) => !n.searchable).reduce((s, n) => s + n.text.length, 0),
  };
  const out: StructNode[] = nodes.map(({ lines: _lines, headLines: _h, ...rest }) => rest);
  return { nodes: out, chunks, stats };
}

export function buildStructure(pages: StructPage[], docTitle: string): Structure {
  const lines = toLines(pages);
  const firstPage = pages[0]?.pageNumber ?? 1;
  const nodes: MutableNode[] = [];
  const byKey = new Map<string, MutableNode>();
  let ord = 0;

  const make = (n: Omit<MutableNode, "ord" | "depth" | "path" | "pageStart" | "pageEnd" | "text" | "lines" | "headLines">, page: number) => {
    let key = n.key;
    for (let i = 2; byKey.has(key); i++) key = `${n.key}~${i}`;
    const parent = n.parentKey ? byKey.get(n.parentKey) : undefined;
    const node: MutableNode = {
      ...n,
      key,
      ord: ord++,
      depth: parent ? parent.depth + 1 : 0,
      path: [],
      pageStart: page,
      pageEnd: page,
      text: "",
      lines: [],
      headLines: 0,
    };
    nodes.push(node);
    byKey.set(key, node);
    return node;
  };

  // Pass 1: every line that could be a numbered clause heading outside the annexes.
  const cands: ClauseCandidate[] = [];
  {
    let inAnnex = false;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text.trim();
      if (!t) continue;
      if (ANNEX_RE.test(t) || ANNEX_MIXED_RE.test(t)) inAnnex = true;
      if (inAnnex) continue;
      const m = t.match(CLAUSE_LINE_RE);
      if (m) {
        cands.push({ idx: i, num: parseNum(m[1]), numStr: m[1], rest: m[2], lastIdx: i });
        continue;
      }
      const only = t.match(CLAUSE_NUMBER_ONLY_RE);
      if (only) {
        let k = i + 1;
        while (k < lines.length && !lines[k].text.trim()) k++;
        if (k < lines.length && /^[A-Z]/.test(lines[k].text.trim())) {
          cands.push({ idx: i, num: parseNum(only[1]), numStr: only[1], rest: lines[k].text.trim(), lastIdx: k });
        }
      }
    }
  }
  const acceptedIdx = acceptClauseChain(cands);
  const candByIdx = new Map(cands.map((c) => [c.idx, c]));

  const root = make({ key: "root", kind: "root", number: null, title: docTitle, parentKey: null, searchable: false }, firstPage);
  let current: MutableNode = root;
  let container: MutableNode = root; // last clause / annex / front node: parent for tables and figures
  let annex: MutableNode | null = null;
  let lastAnnexNum: Num | null = null;
  let numberedSeen = 0;
  let inBackMatter = false;
  let rejected = 0;

  const clauseParent = (num: string): string => {
    const parts = num.split(".");
    for (let k = parts.length - 1; k >= 1; k--) {
      const key = `c:${parts.slice(0, k).join(".")}`;
      if (byKey.has(key)) return key;
    }
    return root.key;
  };

  // The heading line stays in the node text (it carries the number, the title and any body after it).
  const open = (node: MutableNode, headingLine: Line, _body: string) => {
    node.lines.push(headingLine);
    node.headLines = 1;
    current = node;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.text.trim();
    if (!t) {
      current.lines.push(line);
      continue;
    }

    if (inBackMatter) {
      current.lines.push(line);
      continue;
    }

    if (numberedSeen >= 3 && BACK_MATTER_RE.test(t)) {
      const node = make({ key: "back", kind: "note", number: null, title: "Back matter", parentKey: root.key, searchable: false }, line.page);
      open(node, line, "");
      inBackMatter = true;
      continue;
    }

    const fw = numberedSeen === 0 ? t.match(FOREWORD_RE) : null;
    if (fw && !byKey.has("foreword")) {
      const node = make({ key: "foreword", kind: "front_matter", number: "FOREWORD", title: "Foreword", parentKey: root.key, searchable: true }, line.page);
      open(node, line, fw[1]);
      container = node;
      continue;
    }

    const ax = t.match(ANNEX_RE) || t.match(ANNEX_MIXED_RE);
    if (ax) {
      const letter = ax[1];
      let title = ax[2] && /[A-Z]/.test(ax[2]) && ax[2] === ax[2].toUpperCase() ? cleanTitle(ax[2]) : "";
      if (!title) {
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          const c = lines[j].text.trim();
          if (!c || /^\(.*\)$/.test(c)) continue;
          const letters = c.replace(/[^A-Za-z]/g, "");
          if (letters.length >= 3 && letters === letters.toUpperCase() && wordCount(c) <= 14) title = cleanTitle(c);
          break;
        }
      }
      const node = make({ key: `annex:${letter}`, kind: "annex", number: `ANNEX ${letter}`, title, parentKey: root.key, searchable: true }, line.page);
      open(node, line, "");
      annex = node;
      container = node;
      lastAnnexNum = null;
      numberedSeen++;
      continue;
    }

    const ac = annex ? t.match(ANNEX_CLAUSE_RE) : null;
    if (ac && annex && ac[1] === annex.number?.slice(-1)) {
      const num = parseNum(ac[2]);
      if (canFollow(lastAnnexNum, num)) {
        const { title, body } = splitHeading(ac[3]);
        const parts = ac[2].split(".");
        let parentKey = annex.key;
        for (let k = parts.length - 1; k >= 1; k--) {
          const key = `c:${ac[1]}-${parts.slice(0, k).join(".")}`;
          if (byKey.has(key)) {
            parentKey = key;
            break;
          }
        }
        const node = make({ key: `c:${ac[1]}-${ac[2]}`, kind: "clause", number: `${ac[1]}-${ac[2]}`, title, parentKey, searchable: true }, line.page);
        open(node, line, body);
        container = node;
        lastAnnexNum = num;
        continue;
      }
      rejected++;
    }

    const tb = t.match(TABLE_RE);
    if (tb && wordCount(tb[2]) <= 14 && !CAPTION_VERB_RE.test(tb[2]) && !/continued|concluded/i.test(tb[2])) {
      const node = make({ key: `table:${tb[1]}`, kind: "table", number: `Table ${tb[1]}`, title: cleanTitle(tb[2]), parentKey: container.key, searchable: true }, line.page);
      open(node, line, "");
      continue;
    }

    const fg = t.match(FIGURE_RE);
    if (fg && wordCount(fg[2]) <= 14 && !CAPTION_VERB_RE.test(fg[2])) {
      const node = make({ key: `figure:${fg[1]}`, kind: "figure", number: `Figure ${fg[1]}`, title: cleanTitle(fg[2]), parentKey: container.key, searchable: true }, line.page);
      open(node, line, "");
      continue;
    }

    const cand = !annex ? candByIdx.get(i) : undefined;
    if (cand && acceptedIdx.has(i)) {
      const { title, body } = splitHeading(cand.rest);
      const node = make({ key: `c:${cand.numStr}`, kind: "clause", number: cand.numStr, title, parentKey: clauseParent(cand.numStr), searchable: true }, line.page);
      open(node, line, body);
      for (let j = i + 1; j <= cand.lastIdx; j++) node.lines.push(lines[j]);
      node.headLines = node.lines.length;
      i = cand.lastIdx;
      container = node;
      numberedSeen++;
      continue;
    }
    if (cand) rejected++;

    if (current === root) {
      const front = make({ key: "front", kind: "front_matter", number: null, title: "Front matter", parentKey: root.key, searchable: true }, line.page);
      current = front;
      container = front;
    }
    current.lines.push(line);
  }

  return finish(nodes, docTitle, rejected);
}

/** One affected-target label per mention: "4.2", "A-2.1", "Table 2", "Figure 1", "ANNEX B". */
export function parseAmendmentTargets(target: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  let m: RegExpExecArray | null;
  const clauseRe = /\b(?:sub-)?clauses?\s+((?:[A-H]-)?\d{1,2}(?:\.\d{1,2}){0,4})/gi;
  while ((m = clauseRe.exec(target))) push(m[1].toUpperCase());
  const tableRe = /\bTable\s+(\d{1,2}[A-Z]?)/gi;
  while ((m = tableRe.exec(target))) push(`Table ${m[1]}`);
  const figRe = /\bFig(?:ure)?\.?\s*(\d{1,2}[A-Z]?)/gi;
  while ((m = figRe.exec(target))) push(`Figure ${m[1]}`);
  const annexRe = /\bAnnex\s+([A-H])\b/gi;
  while ((m = annexRe.exec(target))) push(`ANNEX ${m[1].toUpperCase()}`);
  return out;
}

const AMENDMENT_ITEM_RE = /^\(\s*Page\s+\d+\s*,\s*([^)]{1,100})\)/i;

/**
 * An amendment is a list of changes, each starting "(Page N, clause X) — Substitute ...".
 * Each change becomes one node numbered after the first target it changes, so the
 * base edition's clauses can be marked as amended when the amendment is published.
 */
export function buildAmendmentStructure(
  pages: StructPage[],
  docTitle: string,
  amendmentNo: number,
): Structure & { affected: string[] } {
  const lines = toLines(pages);
  const nodes: MutableNode[] = [];
  let ord = 0;
  const firstPage = pages[0]?.pageNumber ?? 1;
  const mk = (key: string, kind: NodeKind, number: string | null, title: string, parentKey: string | null, searchable: boolean, page: number) => {
    const node: MutableNode = { key, kind, number, title, parentKey, depth: parentKey ? 1 : 0, ord: ord++, pageStart: page, pageEnd: page, text: "", searchable, path: [], lines: [], headLines: 0 };
    nodes.push(node);
    return node;
  };
  const root = mk("root", "root", null, docTitle, null, false, firstPage);
  let current = mk("front", "front_matter", null, `Amendment No. ${amendmentNo}`, root.key, true, firstPage);
  const affected: string[] = [];
  let items = 0;

  for (const line of lines) {
    const t = line.text.trim();
    const m = t.match(AMENDMENT_ITEM_RE);
    if (m) {
      const targets = parseAmendmentTargets(m[1]);
      for (const a of targets) if (!affected.includes(a)) affected.push(a);
      items++;
      current = mk(
        `amd:${items}`,
        "clause",
        targets[0] ?? null,
        `Amendment No. ${amendmentNo}: ${m[1].replace(/\s+/g, " ").trim()}`,
        root.key,
        true,
        line.page,
      );
    }
    current.lines.push(line);
  }

  if (items === 0) {
    // No "(Page N, ...)" markers: fall back to every clause the text names.
    const all = lines.map((l) => l.text).join("\n");
    for (const a of parseAmendmentTargets(all)) if (!affected.includes(a)) affected.push(a);
  }

  return { ...finish(nodes, docTitle, 0), affected };
}
