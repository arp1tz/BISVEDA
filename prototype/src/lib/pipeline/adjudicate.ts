/**
 * BISVEDA — Stage 8: Deterministic Adjudication (lib/pipeline/adjudicate.ts)
 *
 * Turns fused retrieval into a decision, with no LLM call and no hard-coded
 * product→standard map (the old version's `product.ts` and the exclusion
 * rules here were deleted in P2 — this KB has 8 standards and no QCO/scheme
 * data at all, so there is nothing to hard-code and nothing to fabricate).
 *
 * Rule: a standard only becomes `applies` if one of its retrieved chunks IS
 * its own scope clause (clause "1"/"1.1", or titled "Scope") — i.e. the
 * document's own definition of what it covers showed up in the results.
 * Otherwise a standard that was merely retrieved (some other clause matched)
 * is `related`. Grounding is `verified` only when the top standard has both
 * a dense hit at or above the calibrated floor AND a lexical (BM25/exact)
 * hit — one signal alone can be a coincidence, two agreeing is not.
 */

import { getStandardById, isScopeChunk } from "../kb/store";
import { FusedResults } from "./fuse";
import { MultiStoreRetrievalResult } from "./retrieve";
import { getCalibratedThreshold } from "./floor";

export type StandardClass = "applies" | "related" | "not_applicable";
export type Grounding = "verified" | "supported_inference" | "insufficient_evidence";

export interface AdjudicatedStandard {
  id: string;
  title: string;
  class: StandardClass;
  why: string;
  source_url: string;
}

export interface AdjudicationPackage {
  primaryStandard: { id: string; title: string } | null;
  standards: AdjudicatedStandard[];
  grounding: Grounding;
}

export function adjudicateCandidates(fused: FusedResults, raw: MultiStoreRetrievalResult): AdjudicationPackage {
  interface Agg {
    hasScope: boolean;
    hasDenseHit: boolean;
    maxSimilarity: number;
    hasLexicalHit: boolean;
  }
  const byStandard = new Map<string, Agg>();

  for (const chunk of fused.rankedChunks) {
    const agg: Agg = byStandard.get(chunk.standard_id) ?? {
      hasScope: false,
      hasDenseHit: false,
      maxSimilarity: 0,
      hasLexicalHit: false,
    };
    if (isScopeChunk(chunk.clause, chunk.clause_title)) agg.hasScope = true;
    if (chunk.similarity !== undefined) {
      agg.hasDenseHit = true;
      agg.maxSimilarity = Math.max(agg.maxSimilarity, chunk.similarity);
    }
    byStandard.set(chunk.standard_id, agg);
  }
  // Exact/BM25 hits carry no `similarity`, so they're not visible in rankedChunks'
  // aggregation above once a dense hit exists for the same chunk — check directly.
  for (const h of [...raw.exactChunkHits, ...raw.bm25Hits]) {
    const agg = byStandard.get(h.standardId);
    if (agg) agg.hasLexicalHit = true;
  }

  const rankedKnown = fused.rankedStandards.filter((id) => byStandard.has(id));
  const threshold = getCalibratedThreshold();

  const standards: AdjudicatedStandard[] = rankedKnown.slice(0, 3).map((id) => {
    const std = getStandardById(id);
    const agg = byStandard.get(id)!;
    const cls: StandardClass = agg.hasScope ? "applies" : "related";
    const why = agg.hasScope
      ? `${id}'s own scope clause matches the query.`
      : `Related content in ${id} was retrieved, but not its scope clause.`;
    return {
      id,
      title: std?.title ?? id,
      class: cls,
      why,
      source_url: `/api/docs/${std?.doc_id ?? ""}`,
    };
  });

  const primary = standards.find((s) => s.class === "applies") ?? standards[0] ?? null;

  let grounding: Grounding = "insufficient_evidence";
  if (primary) {
    const agg = byStandard.get(primary.id)!;
    if (agg.hasDenseHit && agg.maxSimilarity >= threshold && agg.hasLexicalHit) {
      grounding = "verified";
    } else if (agg.hasScope || agg.hasDenseHit || agg.hasLexicalHit) {
      grounding = "supported_inference";
    }
  }

  return {
    primaryStandard: primary ? { id: primary.id, title: primary.title } : null,
    standards,
    grounding,
  };
}
