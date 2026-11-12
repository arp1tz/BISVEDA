/**
 * BISVEDA — Lexical (BM25) and dense (embedding cosine) search over the
 * knowledge-base chunks (P2.2).
 *
 * BM25 index is built once, lazily, from the store's chunks and cached at
 * module scope (same lifetime as the store itself).
 */

import { generateEmbedding } from "../embeddings";
import { denseSearchChunks, getAllChunks, getStoreGeneration } from "./store";
import type { KbChunk } from "./types";

const K1 = 1.2;
const B = 0.75;

/** Tokenises, keeping "is4151"-style IS-number tokens intact (don't split the digits off). */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1);
}

interface Bm25Index {
  docTokens: Map<string, string[]>; // chunk_id -> tokens
  df: Map<string, number>; // token -> document frequency
  avgDocLen: number;
  N: number;
}

let bm25Index: Bm25Index | null = null;
let indexedGeneration = -1; // store snapshot the index was built from

function buildIndex(chunks: KbChunk[]): Bm25Index {
  const docTokens = new Map<string, string[]>();
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const chunk of chunks) {
    const indexedText = `${chunk.standard_id} ${chunk.clause_title} ${chunk.text}`;
    const tokens = tokenize(indexedText);
    docTokens.set(chunk.chunk_id, tokens);
    totalLen += tokens.length;

    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }

  return {
    docTokens,
    df,
    avgDocLen: chunks.length > 0 ? totalLen / chunks.length : 0,
    N: chunks.length,
  };
}

function getIndex(): Bm25Index {
  const generation = getStoreGeneration();
  if (!bm25Index || indexedGeneration !== generation) {
    bm25Index = buildIndex(getAllChunks());
    indexedGeneration = generation;
  }
  return bm25Index;
}

export interface Bm25Hit {
  chunk: KbChunk;
  score: number;
}

/** Real BM25 (k1=1.2, b=0.75) over all chunks, optionally scoped to a set of standard ids. */
export function bm25Search(query: string, limit = 30, standardIds?: string[]): Bm25Hit[] {
  const chunks = getAllChunks();
  const idx = getIndex();
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return [];

  const scoped = standardIds ? chunks.filter((c) => standardIds.includes(c.standard_id)) : chunks;

  const scored: Bm25Hit[] = [];
  for (const chunk of scoped) {
    const docTokens = idx.docTokens.get(chunk.chunk_id) || [];
    if (docTokens.length === 0) continue;
    const docLen = docTokens.length;

    let score = 0;
    for (const qt of queryTokens) {
      const df = idx.df.get(qt) || 0;
      if (df === 0) continue;
      const tf = docTokens.filter((t) => t === qt).length;
      if (tf === 0) continue;
      const idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen) / idx.avgDocLen)));
    }

    if (score > 0) scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export interface DenseHit {
  chunk: KbChunk;
  similarity: number;
}

/**
 * Dense search: embeds the query with local bge-m3 and ranks chunks by cosine
 * similarity (pgvector in db mode, in-memory in json mode — see
 * store.denseSearchChunks). Returns [] (not fabricated results) if embedding fails —
 * callers should treat that as "dense signal unavailable this turn", not
 * as evidence of anything.
 */
export async function denseSearch(query: string, limit = 30, standardIds?: string[]): Promise<DenseHit[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query, "RETRIEVAL_QUERY");
  } catch (err) {
    console.warn("[kb/bm25] dense search skipped — query embedding failed:", err instanceof Error ? err.message : err);
    return [];
  }

  try {
    return await denseSearchChunks(queryEmbedding, limit, standardIds);
  } catch (err) {
    console.warn("[kb/bm25] dense search skipped — vector query failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
