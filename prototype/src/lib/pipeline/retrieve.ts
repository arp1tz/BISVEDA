/**
 * BISVEDA — Stage 5: Hybrid Multi-Store Retrieval (lib/pipeline/retrieve.ts)
 *
 * Runs 4 retrievers over the real knowledge base (src/lib/kb/store.ts):
 *  1. exact:  an IS number in the query resolves the standard directly; its
 *             chunks are ranked by BM25 within just that standard and pinned.
 *  2. bm25:   lexical search across the whole KB.
 *  3. dense:  cosine similarity against real Gemini embeddings.
 *  4. graph:  standards carried over from conversation context contribute
 *             their scope chunks, so a follow-up question keeps working
 *             without repeating the standard number.
 */

import { bm25Search, denseSearch } from "../kb/bm25";
import { getChunksByStandard, getStandardById, isScopeChunk } from "../kb/store";
import type { KbChunk } from "../kb/types";
import { CanonicalIsNumber } from "./normalize";

export interface RetrievalHit {
  key: string; // chunk_id
  standardId: string;
  source: "exact" | "bm25" | "dense" | "graph";
  score?: number; // bm25 score, or dense cosine similarity
  similarity?: number; // set only for dense hits (0-1 cosine) — floor.ts reads this
  chunk: KbChunk;
}

export interface MultiStoreRetrievalResult {
  exactHits: string[]; // standard ids resolved by an exact IS number in the query or context
  graphHits: string[]; // standard ids carried over from conversation context
  exactChunkHits: RetrievalHit[];
  bm25Hits: RetrievalHit[];
  denseHits: RetrievalHit[];
  graphChunkHits: RetrievalHit[];
  preferredStandardId: string | null;
}

export async function retrieveMultiStore(
  query: string,
  canonicalStandards: CanonicalIsNumber[],
  activeStandardsFromContext: string[] = []
): Promise<MultiStoreRetrievalResult> {
  // 1. Exact: canonical IS numbers in the query resolved against the real KB.
  const exactHits: string[] = [];
  for (const cs of canonicalStandards) {
    const std = getStandardById(cs.id);
    if (std) exactHits.push(std.id);
  }
  // No new standard named this turn but one is active from context: keep treating it as exact.
  if (exactHits.length === 0 && activeStandardsFromContext.length > 0) {
    exactHits.push(...activeStandardsFromContext);
  }

  let exactChunkHits: RetrievalHit[] = [];
  if (exactHits.length > 0) {
    const scoped = bm25Search(query, 10, exactHits);
    exactChunkHits = scoped.map((h) => ({
      key: h.chunk.chunk_id,
      standardId: h.chunk.standard_id,
      source: "exact" as const,
      score: h.score,
      chunk: h.chunk,
    }));
    // If the query is just the identifier itself (no other terms), BM25 may find
    // nothing to score against — fall back to the standard's own scope chunks.
    if (exactChunkHits.length === 0) {
      for (const stdId of exactHits) {
        const scopeChunks = getChunksByStandard(stdId).filter((c) => isScopeChunk(c.clause, c.clause_title)).slice(0, 3);
        exactChunkHits.push(
          ...scopeChunks.map((c) => ({ key: c.chunk_id, standardId: c.standard_id, source: "exact" as const, chunk: c }))
        );
      }
    }
  }

  // 2. Graph: standards active in the conversation contribute their scope chunks,
  // so a follow-up like "what impact test does it need?" still has grounding
  // context even though it names no standard.
  const graphHits = [...activeStandardsFromContext];
  const graphChunkHits: RetrievalHit[] = [];
  for (const stdId of graphHits) {
    if (exactHits.includes(stdId)) continue; // already covered above
    const scopeChunks = getChunksByStandard(stdId).filter((c) => isScopeChunk(c.clause, c.clause_title)).slice(0, 2);
    graphChunkHits.push(
      ...scopeChunks.map((c) => ({ key: c.chunk_id, standardId: c.standard_id, source: "graph" as const, chunk: c }))
    );
  }

  // 3. BM25 + dense, in parallel, across the whole KB.
  const [bm25Top, denseTop] = await Promise.all([
    Promise.resolve(bm25Search(query, 30)),
    denseSearch(query, 30),
  ]);

  const bm25Hits: RetrievalHit[] = bm25Top.map((h) => ({
    key: h.chunk.chunk_id,
    standardId: h.chunk.standard_id,
    source: "bm25" as const,
    score: h.score,
    chunk: h.chunk,
  }));

  const denseHits: RetrievalHit[] = denseTop.map((h) => ({
    key: h.chunk.chunk_id,
    standardId: h.chunk.standard_id,
    source: "dense" as const,
    score: h.similarity,
    similarity: h.similarity,
    chunk: h.chunk,
  }));

  return {
    exactHits,
    graphHits,
    exactChunkHits,
    bm25Hits,
    denseHits,
    graphChunkHits,
    preferredStandardId: exactHits[0] || activeStandardsFromContext[0] || null,
  };
}
