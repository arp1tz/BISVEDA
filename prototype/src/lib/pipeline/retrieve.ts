/**
 * BISVEDA V9 — Stage 5: Multi-Store Parallel Retrieval (lib/pipeline/retrieve.ts)
 * 
 * Runs 5 retrieval mechanisms in parallel:
 *  1. Exact IS match (pinned rank 1)
 *  2. Taxonomy / Graph traversal (prod -> IS_A -> pg -> COVERS -> std)
 *  3. Semantic standards (standards.embedding top 10)
 *  4. Semantic chunks (chunks.embedding top 30, published only)
 *  5. Lexical chunks (FTS on text top 30 + trigram on titles top 10)
 */

import { generateEmbedding } from "../embeddings";
import { graphRepo } from "../knowledge/graph-repository";
import {
  localSearchVectorChunks,
  localSearchFtsChunks,
  localSearchStandardsSemantic,
  localSearchStandardsTrigram,
  ChunkRow,
} from "../kb/store";
import { CanonicalIsNumber } from "./normalize";
import { ProductResolution } from "./product";

export interface RetrievalHit {
  key: string;              // Standard ID or Chunk ID
  standardId: string;       // Associated standard ID
  source: "exact" | "graph" | "semantic_std" | "semantic_chunk" | "lexical_chunk" | "trigram_std";
  score?: number;
  chunk?: ChunkRow;
}

export interface MultiStoreRetrievalResult {
  exactHits: string[];                     // Standard IDs
  graphHits: string[];                     // Standard IDs
  semanticStdHits: string[];               // Standard IDs
  semanticChunkHits: RetrievalHit[];       // Chunk Hits
  lexicalChunkHits: RetrievalHit[];        // Chunk Hits
  trigramStdHits: string[];                // Standard IDs
  preferredStandardId?: string | null;     // Product-resolved standard
}

export async function retrieveMultiStore(
  query: string,
  canonicalStandards: CanonicalIsNumber[],
  productRes: ProductResolution,
  activeStandardsFromContext: string[] = []
): Promise<MultiStoreRetrievalResult> {
  const queryLower = query.toLowerCase();

  // 1. Exact IS numbers in query
  const exactHits: string[] = [];
  for (const cs of canonicalStandards) {
    const std = await graphRepo.getStandard(cs.id);
    if (std) exactHits.push(std.id);
  }

  // If follow-up context has active standards and query has no new standard, include them
  if (exactHits.length === 0 && activeStandardsFromContext.length > 0) {
    exactHits.push(...activeStandardsFromContext);
  }

  // 2. Taxonomy / Knowledge Graph retrieval
  let graphHits: string[] = [];
  if (productRes.productNodeId) {
    graphHits = await graphRepo.standardsForProduct(productRes.productNodeId);
  }
  if (productRes.preferredStandardId && !graphHits.includes(productRes.preferredStandardId)) {
    graphHits.unshift(productRes.preferredStandardId);
  }

  // 3 & 4. Compute query embedding for semantic search
  const queryEmbPromise = generateEmbedding(query, "RETRIEVAL_QUERY");

  // 5. Lexical chunks & Trigram search in parallel
  const [queryEmb, ftsChunks, trigramStds] = await Promise.all([
    queryEmbPromise,
    localSearchFtsChunks(query, 30),
    localSearchStandardsTrigram(query, 10),
  ]);

  // Execute semantic searches once embedding is ready
  const [semanticStds, vectorChunks] = await Promise.all([
    localSearchStandardsSemantic(queryEmb, 10),
    localSearchVectorChunks(queryEmb, 30, 0.35),
  ]);

  const semanticStdHits = semanticStds.map((s) => s.id);
  const trigramStdHits = trigramStds.map((s) => s.id);

  const semanticChunkHits: RetrievalHit[] = vectorChunks.map((c) => ({
    key: c.chunk_id,
    standardId: c.standard_number || "UNKNOWN",
    source: "semantic_chunk",
    score: c.similarity,
    chunk: c,
  }));

  const lexicalChunkHits: RetrievalHit[] = ftsChunks.map((c) => ({
    key: c.chunk_id,
    standardId: c.standard_number || "UNKNOWN",
    source: "lexical_chunk",
    chunk: c,
  }));

  return {
    exactHits,
    graphHits,
    semanticStdHits,
    semanticChunkHits,
    lexicalChunkHits,
    trigramStdHits,
    preferredStandardId: productRes.preferredStandardId,
  };
}
