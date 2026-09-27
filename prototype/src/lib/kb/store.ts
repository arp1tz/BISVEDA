/**
 * BISVEDA — Knowledge Base Store (P0 stub)
 *
 * Temporary stand-in for the archived `local-db.ts` so the pipeline files keep
 * compiling while the repo is restructured. Every function returns an empty
 * result. P2.1 replaces this with the real loader over `data/kb/*.json` and
 * `data/directory/*.json` (see TODO.md P2).
 *
 * Do not add fabricated data here. An empty result is honest; a fake one isn't.
 */

import type {
  StandardRecord,
  QcoRecord,
  SchemeRecord,
  LabRecord,
  KgNode,
  KgEdge,
} from "../knowledge/types";

// ─── Chunk shape (was imported from the archived db.ts) ────────────────────

export interface ChunkRow {
  chunk_id: string;
  document_id: string;
  job_id?: string;
  standard_number?: string;
  clause_number?: string;
  clause_title?: string;
  breadcrumb: string[];
  page_numbers: number[];
  text: string;
  token_count: number;
  sha256: string;
  knowledge_tier: "A" | "B" | "C";
  verification_status: string;
  doc_version_id?: number | null;
  clause_id?: string | null;
  page?: number | null;
  tsv?: string | null;
  embedding?: number[] | null;
  is_active?: boolean;
  metadata?: Record<string, any>;
  similarity?: number;
  filename?: string;
  doc_title?: string;
  source_url?: string;
}

// ─── Standards ──────────────────────────────────────────────────────────────

export async function localGetStandard(_idOrNorm: string): Promise<StandardRecord | null> {
  return null;
}

export async function localGetAllStandards(): Promise<StandardRecord[]> {
  return [];
}

export async function localSearchStandardsSemantic(
  _embedding: number[],
  _limit = 10
): Promise<Array<StandardRecord & { similarity: number }>> {
  return [];
}

export async function localSearchStandardsTrigram(
  _term: string,
  _limit = 10
): Promise<Array<StandardRecord & { similarity: number }>> {
  return [];
}

// ─── Chunks ─────────────────────────────────────────────────────────────────

export async function localSearchFtsChunks(_queryText: string, _limit = 5): Promise<ChunkRow[]> {
  return [];
}

export async function localSearchVectorChunks(
  _embedding: number[],
  _limit = 5,
  _minSimilarity = 0.4
): Promise<ChunkRow[]> {
  return [];
}

// ─── QCOs / Schemes / Labs ──────────────────────────────────────────────────

export async function localGetQcosForStandard(_stdId: string): Promise<QcoRecord[]> {
  return [];
}

export async function localGetSchemesForStandard(_stdId: string): Promise<SchemeRecord[]> {
  return [];
}

export async function localGetLabsForStandard(
  _stdId: string,
  _near?: { lat: number; lng: number }
): Promise<LabRecord[]> {
  return [];
}

// ─── Knowledge graph ────────────────────────────────────────────────────────

export async function localGetKgNeighbors(
  _nodeId: string,
  _edgeTypes?: string[],
  _depth: 1 | 2 = 1
): Promise<{ nodes: KgNode[]; edges: KgEdge[] }> {
  return { nodes: [], edges: [] };
}

export async function localGetKgStandardsForProduct(_productNodeId: string): Promise<string[]> {
  return [];
}
