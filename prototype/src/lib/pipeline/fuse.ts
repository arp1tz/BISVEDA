/**
 * BISVEDA — Stage 6: Reciprocal Rank Fusion (lib/pipeline/fuse.ts)
 *
 * Combines the exact/bm25/dense/graph chunk lists with RRF (k = 60) into one
 * ranked chunk list and one ranked standard list. Exact hits are pinned to
 * the top.
 *
 * Fix vs. the old version: merging hits for the same chunk_id across sources
 * used to let a later source silently overwrite an earlier one (a lexical
 * hit replacing a semantic hit lost that chunk's `similarity`, which is what
 * floor.ts reads). Here a chunk keeps its `similarity` if ANY source that
 * found it set one, however many other sources also matched it.
 */

import { MultiStoreRetrievalResult, RetrievalHit } from "./retrieve";
import type { KbChunk } from "../kb/types";

/** Standard Reciprocal Rank Fusion (RRF). */
export function rrf(lists: string[][], k = 60): Map<string, number> {
  const scoreMap = new Map<string, number>();
  for (const list of lists) {
    list.forEach((key, i) => {
      scoreMap.set(key, (scoreMap.get(key) ?? 0) + 1 / (k + i + 1));
    });
  }
  return scoreMap;
}

export interface FusedChunk extends KbChunk {
  similarity?: number;
  rrfScore: number;
}

export interface FusedResults {
  rankedStandards: string[];
  rankedChunks: FusedChunk[];
}

export function fuseRetrievalResults(raw: MultiStoreRetrievalResult, k = 60, topN = 8): FusedResults {
  const chunkLists: RetrievalHit[][] = [raw.exactChunkHits, raw.graphChunkHits, raw.bm25Hits, raw.denseHits];

  const chunkScores = rrf(chunkLists.map((list) => list.map((h) => h.key)), k);
  for (const h of raw.exactChunkHits) {
    chunkScores.set(h.key, (chunkScores.get(h.key) ?? 0) + 1000); // pin exact matches
  }

  // Merge duplicate hits for the same chunk across sources, keeping any similarity found.
  const merged = new Map<string, RetrievalHit>();
  for (const list of chunkLists) {
    for (const h of list) {
      const existing = merged.get(h.key);
      if (!existing) {
        merged.set(h.key, h);
      } else if (existing.similarity === undefined && h.similarity !== undefined) {
        merged.set(h.key, { ...existing, similarity: h.similarity });
      }
    }
  }

  const rankedChunks: FusedChunk[] = Array.from(merged.entries())
    .map(([key, h]) => ({ ...h.chunk, similarity: h.similarity, rrfScore: chunkScores.get(key) ?? 0 }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topN);

  // Standard-level ranking. Dedupe each retriever's chunk list down to one
  // entry per standard (its best-ranked chunk) BEFORE running RRF — otherwise
  // a document with many chunks in the top-30 (e.g. a 249-chunk standard)
  // racks up RRF score just from volume and can outrank a document with one
  // strongly-matching chunk. This is the "resists chunk-volume bias"
  // requirement from the architecture spec's adjudicator design.
  const dedupeToStandards = (hits: RetrievalHit[]): string[] => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const h of hits) {
      if (!seen.has(h.standardId)) {
        seen.add(h.standardId);
        ordered.push(h.standardId);
      }
    }
    return ordered;
  };

  const standardLists: string[][] = [
    raw.exactHits,
    raw.graphHits,
    dedupeToStandards(raw.bm25Hits),
    dedupeToStandards(raw.denseHits),
  ];
  const standardScores = rrf(standardLists, k);
  raw.exactHits.forEach((id, i) => standardScores.set(id, 1000 - i));
  if (raw.preferredStandardId) {
    standardScores.set(raw.preferredStandardId, (standardScores.get(raw.preferredStandardId) ?? 0) + 500);
  }

  const rankedStandards = Array.from(standardScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter(Boolean);

  return { rankedStandards, rankedChunks };
}
