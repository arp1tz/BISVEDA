/**
 * BISVEDA V9 — Stage 6: Reciprocal Rank Fusion (lib/pipeline/fuse.ts)
 * 
 * Combines ranked result lists from multiple retrievers using RRF (k = 60).
 * Produces two distinct ranked lists:
 *  1. Ranked Standards (with chunk hits rolled up to standard level)
 *  2. Ranked Evidence Chunks (for grounding and citation)
 * 
 * Exact matches are pinned at Rank 1.
 */

import { MultiStoreRetrievalResult, RetrievalHit } from "./retrieve";
import { ChunkRow } from "../kb/store";

/**
 * Standard Reciprocal Rank Fusion (RRF).
 */
export function rrf(lists: string[][], k = 60): Map<string, number> {
  const scoreMap = new Map<string, number>();
  for (const list of lists) {
    list.forEach((key, i) => {
      scoreMap.set(key, (scoreMap.get(key) ?? 0) + 1 / (k + i + 1));
    });
  }
  return scoreMap;
}

export interface FusedResults {
  rankedStandards: string[];         // Standard IDs in order of fused relevance
  rankedChunks: ChunkRow[];          // Chunks in order of fused relevance
  standardScores: Map<string, number>;
}

export function fuseRetrievalResults(
  raw: MultiStoreRetrievalResult,
  k = 60
): FusedResults {
  // 1. Standard-level rank lists
  // Roll up chunk hits to standard level
  const semanticChunkStds = raw.semanticChunkHits.map((h) => h.standardId);
  const lexicalChunkStds = raw.lexicalChunkHits.map((h) => h.standardId);

  const standardRankLists: string[][] = [
    raw.graphHits,
    raw.semanticStdHits,
    semanticChunkStds,
    lexicalChunkStds,
    raw.trigramStdHits,
  ];

  const standardScores = rrf(standardRankLists, k);

  // Pin exact matches with maximal boost
  for (let i = 0; i < raw.exactHits.length; i++) {
    const exactStd = raw.exactHits[i];
    standardScores.set(exactStd, 1000 - i);
  }

  // Pin preferred standard if determined by product resolution
  if (raw.preferredStandardId) {
    standardScores.set(raw.preferredStandardId, (standardScores.get(raw.preferredStandardId) ?? 0) + 500);
  }

  const sortedStandards = Array.from(standardScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .filter((id) => id && id !== "UNKNOWN");

  // 2. Chunk-level rank lists
  const chunkMap = new Map<string, ChunkRow>();
  for (const h of raw.semanticChunkHits) {
    if (h.chunk) chunkMap.set(h.key, h.chunk);
  }
  for (const h of raw.lexicalChunkHits) {
    if (h.chunk) chunkMap.set(h.key, h.chunk);
  }

  const chunkRankLists: string[][] = [
    raw.semanticChunkHits.map((h) => h.key),
    raw.lexicalChunkHits.map((h) => h.key),
  ];

  const chunkScores = rrf(chunkRankLists, k);

  // Boost chunks belonging to the top-ranked standard
  const topStandard = sortedStandards[0];
  if (topStandard) {
    const cleanTop = topStandard.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    for (const [cid, chunk] of chunkMap.entries()) {
      const cleanStd = (chunk.standard_number || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (cleanStd === cleanTop || cleanStd.includes(cleanTop) || cleanTop.includes(cleanStd)) {
        chunkScores.set(cid, (chunkScores.get(cid) ?? 0) + 1.0);
      }
    }
  }

  const sortedChunks = Array.from(chunkScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cid]) => chunkMap.get(cid)!)
    .filter(Boolean);

  return {
    rankedStandards: sortedStandards,
    rankedChunks: sortedChunks,
    standardScores,
  };
}
