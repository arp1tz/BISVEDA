/**
 * BISVEDA — graph links found in one document version (R2.6, ARCHITECTURE.md §6.5).
 *
 * Clause level (stored in `edges` with the version id, for R4 graph expansion):
 *   CROSS_REF            clause → clause / annex / figure  ("see 5.2", "clause 6.1", "Annex B", "Fig. 2")
 *   CITES_TABLE          clause → table                    ("Table 3")
 *   REFERENCES_STANDARD  clause → another standard         ("IS 2062")
 * Document level (graph fragment, applied to graph_nodes/edges only when the version is published):
 *   the standard node, its top two clause levels (HAS_CLAUSE) and the standards it cites (REFERENCES).
 */

import { extractIsReferences } from "./ids";
import type { StructNode } from "./structure";

export interface ClauseLink {
  srcKey: string;
  dstKey: string | null;
  dstStandard: string | null;
  type: "CROSS_REF" | "CITES_TABLE" | "REFERENCES_STANDARD";
  evidence: string;
}

export interface GraphFragment {
  clauses: Array<{ number: string; label: string; page: number }>;
  references: Array<{ id: string; count: number; page: number }>;
}

const snippet = (text: string, at: number) => text.slice(Math.max(0, at - 40), at + 60).replace(/\s+/g, " ").trim();

export function findClauseLinks(nodes: StructNode[], ownId: string): ClauseLink[] {
  const keyByNumber = new Map<string, string>();
  for (const n of nodes) if (n.number) keyByNumber.set(n.number.toUpperCase(), n.key);

  const links: ClauseLink[] = [];
  const seen = new Set<string>();
  const add = (l: ClauseLink) => {
    const id = `${l.srcKey}|${l.dstKey ?? l.dstStandard}|${l.type}`;
    if (seen.has(id) || l.srcKey === l.dstKey) return;
    seen.add(id);
    links.push(l);
  };

  for (const n of nodes) {
    if (!n.searchable || !n.text) continue;
    // Skip the heading line itself ("Table 3 Sizes" must not cite Table 3).
    const body = n.text.split("\n").slice(1).join("\n");
    let m: RegExpExecArray | null;

    const clauseRe = /\b(?:sub-)?clauses?\s+((?:[A-H]-)?\d{1,2}(?:\.\d{1,2}){0,4})\b/gi;
    while ((m = clauseRe.exec(body))) {
      const dst = keyByNumber.get(m[1].toUpperCase());
      if (dst) add({ srcKey: n.key, dstKey: dst, dstStandard: null, type: "CROSS_REF", evidence: snippet(body, m.index) });
    }
    const seeRe = /\b(?:see|vide|under|in accordance with|as given in|as specified in|specified in|given in|according to)\s+((?:[A-H]-)?\d{1,2}(?:\.\d{1,2}){1,4})\b/gi;
    while ((m = seeRe.exec(body))) {
      const dst = keyByNumber.get(m[1].toUpperCase());
      if (dst) add({ srcKey: n.key, dstKey: dst, dstStandard: null, type: "CROSS_REF", evidence: snippet(body, m.index) });
    }
    const tableRe = /\bTable\s+(\d{1,2}[A-Z]?)\b/g;
    while ((m = tableRe.exec(body))) {
      const dst = keyByNumber.get(`TABLE ${m[1]}`);
      if (dst) add({ srcKey: n.key, dstKey: dst, dstStandard: null, type: "CITES_TABLE", evidence: snippet(body, m.index) });
    }
    const figRe = /\bFig(?:ure)?\.?\s*(\d{1,2}[A-Z]?)\b/gi;
    while ((m = figRe.exec(body))) {
      const dst = keyByNumber.get(`FIGURE ${m[1]}`);
      if (dst) add({ srcKey: n.key, dstKey: dst, dstStandard: null, type: "CROSS_REF", evidence: snippet(body, m.index) });
    }
    const annexRe = /\bAnnex\s+([A-H])\b/gi;
    while ((m = annexRe.exec(body))) {
      const dst = keyByNumber.get(`ANNEX ${m[1].toUpperCase()}`);
      if (dst) add({ srcKey: n.key, dstKey: dst, dstStandard: null, type: "CROSS_REF", evidence: snippet(body, m.index) });
    }
    for (const [ref] of extractIsReferences(body, ownId)) {
      const at = body.search(new RegExp(`IS\\s*${ref.replace(/^IS /, "").replace(/ \(Part (\d+)\)/, "")}`));
      add({ srcKey: n.key, dstKey: null, dstStandard: ref, type: "REFERENCES_STANDARD", evidence: snippet(body, Math.max(0, at)) });
    }
  }
  return links;
}

export function buildGraphFragment(nodes: StructNode[], ownId: string): GraphFragment {
  const clauses = nodes
    .filter((n) => n.kind === "clause" && n.number && /^\d{1,2}(\.\d{1,2})?$/.test(n.number))
    .map((n) => ({ number: n.number!, label: `${n.number} ${n.title}`.trim(), page: n.pageStart }));

  const refs = new Map<string, { count: number; page: number }>();
  for (const n of nodes) {
    if (!n.searchable) continue;
    for (const [ref, count] of extractIsReferences(n.text, ownId)) {
      const cur = refs.get(ref);
      if (cur) cur.count += count;
      else refs.set(ref, { count, page: n.pageStart });
    }
  }
  return {
    clauses,
    references: Array.from(refs.entries()).map(([id, v]) => ({ id, count: v.count, page: v.page })),
  };
}
