/**
 * BISVEDA — Stage 9: Evidence Package Builder (lib/pipeline/package.ts)
 *
 * Builds the frozen EvidencePackage of [S#] sources the LLM is allowed to
 * cite. Every source is a real retrieved chunk — no templated "catalogue"
 * or "QCO" sources (the old version's S1/S2 boilerplate, which stated
 * claims as if they were sourced, was deleted; we hold no QCO/scheme data
 * to source from in the first place).
 */

import { AdjudicationPackage } from "./adjudicate";
import { FusedChunk } from "./fuse";

export interface Source {
  label: string; // 'S1', 'S2', ...
  standard_id: string;
  title: string;
  clause: string;
  page: number;
  url: string; // /api/docs/{doc_id}#page=N
  text: string; // exact excerpt, never paraphrased
}

export interface EvidencePackage {
  primary_standard: { id: string; title: string } | null;
  standards: Array<{ id: string; title: string; class: string; why: string }>;
  sources: Source[];
}

export function buildEvidencePackage(adjudicated: AdjudicationPackage, rankedChunks: FusedChunk[]): EvidencePackage {
  const sources: Source[] = [];
  let sIndex = 1;

  const primaryId = adjudicated.primaryStandard?.id;
  const relevantChunks = primaryId ? rankedChunks.filter((c) => c.standard_id === primaryId) : [];

  for (const chunk of relevantChunks.slice(0, 6)) {
    const text = (chunk.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    sources.push({
      label: `S${sIndex++}`,
      standard_id: chunk.standard_id,
      title: `${chunk.standard_id} — Clause ${chunk.clause}${chunk.clause_title ? `: ${chunk.clause_title}` : ""}`,
      clause: chunk.clause,
      page: chunk.page_start,
      url: `/api/docs/${chunk.doc_id}#page=${chunk.page_start}`,
      text: text.slice(0, 500),
    });
  }

  return {
    primary_standard: adjudicated.primaryStandard,
    standards: adjudicated.standards.map((s) => ({ id: s.id, title: s.title, class: s.class, why: s.why })),
    sources,
  };
}
