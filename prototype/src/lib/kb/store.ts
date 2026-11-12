/**
 * BISVEDA — Knowledge base store (R1.3: PostgreSQL-backed read model)
 *
 * Two sources behind one interface:
 *   KB_SOURCE=db   (default) reads the searchable set from PostgreSQL
 *                  (published editions + published amendments; see the
 *                  `searchable_chunks` view in db/migrations/0001_init.sql).
 *   KB_SOURCE=json reads data/kb/*.json + data/directory/*.json as before
 *                  (offline fallback, and the reference for parity checks).
 *
 * Usage contract: every entry point (runPipeline, API routes, scripts) calls
 * `await loadStore()` first. The getters below stay synchronous and read the
 * loaded snapshot; a getter called before loadStore() throws rather than
 * silently returning nothing. In db mode, loadStore() re-checks
 * index_state.version at most every 5 s and reloads the snapshot when it
 * changed, so a newly published document becomes searchable without a restart.
 *
 * Real data only: if a source is missing or empty the getters return empty
 * arrays/null; callers surface that as "not in our sources".
 *
 * Dense vectors are NOT held in memory in db mode: chunk.embedding is null and
 * dense search runs in PostgreSQL (denseSearchChunks).
 */

import fs from "fs";
import path from "path";
import type { AhcRecord, Domain, GraphEdge, GraphEdgeType, GraphNode, GraphNodeType, KbChunk, KbDoc, KbGraph, KbStandard, LabRecord } from "./types";
import { getPool, query, toVectorLiteral } from "../db/client";

export type KbSource = "db" | "json";
export function getKbSource(): KbSource {
  return process.env.KB_SOURCE === "json" ? "json" : "db";
}

/** Separator used to store a chunk's breadcrumb as clauses.path. */
export const PATH_SEP = " › ";

export interface StoreData {
  chunks: KbChunk[];
  standards: KbStandard[];
  graph: KbGraph;
  labs: LabRecord[];
  ahcs: AhcRecord[];
  docs: KbDoc[];
  /** db mode only: chunks table row id for each entry of `chunks` (same index). */
  rowIds?: string[];
}

interface Store extends StoreData {
  chunkByRowId: Map<string, KbChunk>;
  chunksByStandard: Map<string, KbChunk[]>;
  standardsById: Map<string, KbStandard>;
  docsById: Map<string, KbDoc>;
  /** Increments on every (re)load; caches derived from the store (BM25) key on it. */
  generation: number;
}

let store: Store | null = null;
let generation = 0;
let loadedIndexVersion = -1;
let lastVersionCheck = 0;
let loading: Promise<void> | null = null;
const VERSION_CHECK_MS = 5_000;

// ── JSON source ──────────────────────────────────────────────────────────────

function resolveDataDir(subpath: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data", subpath), // dev server cwd = prototype/
    path.resolve(process.cwd(), "prototype", "data", subpath), // cwd = repo root
    path.resolve(__dirname, "../../../data", subpath), // src/lib/kb -> prototype/data
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadJson<T>(subpath: string, fallback: T): T {
  const resolved = resolveDataDir(subpath);
  if (!resolved) {
    console.warn(`[kb/store] missing data file: data/${subpath} — returning empty. Run the relevant build script.`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf-8")) as T;
  } catch (err) {
    console.warn(`[kb/store] failed to parse data/${subpath}:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/** Reads the JSON knowledge base exactly as written by kb:build / dir:* scripts. */
export function loadJsonSources(): StoreData {
  return {
    chunks: loadJson<KbChunk[]>(path.join("kb", "chunks.json"), []),
    standards: loadJson<KbStandard[]>(path.join("kb", "standards.json"), []),
    graph: loadJson<KbGraph>(path.join("kb", "graph.json"), { nodes: [], edges: [] }),
    labs: loadJson<LabRecord[]>(path.join("directory", "labs.json"), []),
    ahcs: loadJson<AhcRecord[]>(path.join("directory", "ahc.json"), []),
    docs: loadJson<KbDoc[]>(path.join("kb", "docs.json"), []),
  };
}

// ── DB source ────────────────────────────────────────────────────────────────

const und = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

/** Reads the published (searchable) knowledge base from PostgreSQL into the same shapes as the JSON files. */
export async function loadDbSources(): Promise<StoreData> {
  const [chunkRows, stdRows, docRows, nodeRows, edgeRows, labRows, ahcRows] = await Promise.all([
    query<{
      row_id: string; chunk_id: string; doc_id: string; standard_id: string; clause: string | null; clause_title: string | null;
      path: string; page_start: number; page_end: number; text: string; tokens: number; sha256: string;
    }>(
      `SELECT sc.id AS row_id, COALESCE(sc.legacy_id, sc.id::text) AS chunk_id, COALESCE(d.legacy_doc_id, d.id) AS doc_id,
              sc.document_id AS standard_id, cl.number AS clause, cl.title AS clause_title, cl.path,
              sc.page_start, sc.page_end, sc.text, sc.tokens, sc.sha256
         FROM searchable_chunks sc
         JOIN clauses cl ON cl.id = sc.clause_id
         JOIN documents d ON d.id = sc.document_id
        ORDER BY sc.seq, sc.id`
    ),
    query<{ id: string; title: string; year: number | null; domain: string; scope_text: string | null; doc_id: string; chunk_count: string }>(
      `SELECT d.id, d.title, v.edition_year AS year, d.domain, d.scope_text, COALESCE(d.legacy_doc_id, d.id) AS doc_id,
              (SELECT count(*) FROM searchable_chunks sc WHERE sc.document_id = d.id) AS chunk_count
         FROM documents d
         JOIN document_versions v ON v.document_id = d.id AND v.status = 'published' AND v.kind = 'edition'
        WHERE d.doc_type = 'standard'
        ORDER BY d.display_order, d.id`
    ),
    query<{ doc_id: string; standard_id: string; title: string; domain: string; file: string; source_url: string | null }>(
      `SELECT COALESCE(d.legacy_doc_id, d.id) AS doc_id, d.id AS standard_id, d.title, d.domain, v.file_name AS file, v.source_url
         FROM documents d
         JOIN document_versions v ON v.document_id = d.id AND v.status = 'published' AND v.kind = 'edition'
        ORDER BY d.display_order, d.id`
    ),
    query<{ id: string; type: string; label: string; props: Record<string, unknown> | null }>(
      `SELECT id, type, label, props FROM graph_nodes ORDER BY ord`
    ),
    query<{ src_id: string; dst_id: string; type: string; weight: number | null; evidence: string | null }>(
      `SELECT src_id, dst_id, type, weight, evidence FROM edges ORDER BY id`
    ),
    query<{
      id: string; name: string; city: string | null; state: string | null; lat: number | null; lng: number | null; geocode: string;
      status: string | null; valid_upto: string | null; standards_in_scope: string[]; scope: LabRecord["scope"]; source_url: string; retrieved_at: Date;
    }>(`SELECT * FROM labs ORDER BY ord`),
    query<{
      recognition_no: string; name: string; address: string | null; district: string | null; state: string | null; pin: string | null;
      metals: string | null; contact: string | null; status: string; validity: string | null; lat: number | null; lng: number | null;
      geocode: string; source_url: string; retrieved_at: Date;
    }>(`SELECT * FROM ahcs ORDER BY ord`),
  ]);

  const chunks: KbChunk[] = chunkRows.map((r) => ({
    chunk_id: r.chunk_id,
    doc_id: r.doc_id,
    standard_id: r.standard_id,
    clause: r.clause ?? "0",
    clause_title: r.clause_title ?? "",
    breadcrumb: r.path.split(PATH_SEP),
    page_start: r.page_start,
    page_end: r.page_end,
    text: r.text,
    tokens: r.tokens,
    sha256: r.sha256,
    embedding: null,
  }));

  const standards: KbStandard[] = stdRows.map((r) => ({
    id: r.id,
    title: r.title,
    year: und(r.year),
    domain: r.domain as Domain,
    scope_text: r.scope_text ?? "",
    doc_id: r.doc_id,
    chunk_count: Number(r.chunk_count),
  }));

  const docs: KbDoc[] = docRows.map((r) => ({
    doc_id: r.doc_id,
    standard_id: r.standard_id,
    title: r.title,
    domain: r.domain as Domain,
    file: r.file,
    source_url: und(r.source_url),
  }));

  const graph: KbGraph = {
    nodes: nodeRows.map((r) => {
      const n: GraphNode = { id: r.id, type: r.type as GraphNodeType, label: r.label };
      if (r.props) n.props = r.props;
      return n;
    }),
    edges: edgeRows.map((r) => {
      const e: GraphEdge = { src: r.src_id, dst: r.dst_id, type: r.type as GraphEdgeType, source: r.evidence ?? "" };
      if (r.weight !== null) e.weight = r.weight;
      return e;
    }),
  };

  const labs: LabRecord[] = labRows.map((r) => ({
    id: r.id,
    name: r.name,
    city: und(r.city),
    state: und(r.state),
    lat: und(r.lat),
    lng: und(r.lng),
    geocode: r.geocode as LabRecord["geocode"],
    current_status: und(r.status),
    recognition_valid_upto: und(r.valid_upto),
    standards_in_scope: r.standards_in_scope,
    scope: r.scope,
    source_url: r.source_url,
    retrieved_at: r.retrieved_at.toISOString(),
  }));

  const ahcs: AhcRecord[] = ahcRows.map((r) => ({
    recognition_no: r.recognition_no,
    name: r.name,
    address: und(r.address),
    district: und(r.district),
    state: und(r.state),
    pin: und(r.pin),
    metals: und(r.metals),
    contact: und(r.contact),
    status: r.status,
    validity: und(r.validity),
    lat: r.lat,
    lng: r.lng,
    geocode: r.geocode as AhcRecord["geocode"],
    source_url: r.source_url,
    retrieved_at: r.retrieved_at.toISOString(),
  }));

  return { chunks, standards, graph, labs, ahcs, docs, rowIds: chunkRows.map((r) => r.row_id) };
}

// ── Snapshot management ─────────────────────────────────────────────────────

function buildStore(data: StoreData): Store {
  const chunksByStandard = new Map<string, KbChunk[]>();
  for (const c of data.chunks) {
    const list = chunksByStandard.get(c.standard_id) ?? [];
    list.push(c);
    chunksByStandard.set(c.standard_id, list);
  }
  const standardsById = new Map<string, KbStandard>();
  for (const s of data.standards) standardsById.set(s.id, s);
  const docsById = new Map<string, KbDoc>();
  for (const d of data.docs) docsById.set(d.doc_id, d);
  const chunkByRowId = new Map<string, KbChunk>();
  data.rowIds?.forEach((id, i) => chunkByRowId.set(id, data.chunks[i]));

  if (data.chunks.length === 0) {
    console.warn(
      getKbSource() === "db"
        ? "[kb/store] 0 searchable chunks in the database. Run `npm run db:import` (or publish a document)."
        : "[kb/store] 0 chunks loaded. Run `npm run kb:build` from prototype/ before starting the app."
    );
  }
  return { ...data, chunksByStandard, standardsById, docsById, chunkByRowId, generation: ++generation };
}

/**
 * Loads (or refreshes) the snapshot. Call at every entry point before using
 * the getters. Cheap when nothing changed: one tiny query at most every 5 s.
 */
export async function loadStore(): Promise<void> {
  if (getKbSource() === "json") {
    if (!store) store = buildStore(loadJsonSources());
    return;
  }
  if (store && Date.now() - lastVersionCheck < VERSION_CHECK_MS) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const rows = await query<{ version: string }>("SELECT version FROM index_state WHERE id = 1");
      lastVersionCheck = Date.now();
      const version = rows.length ? Number(rows[0].version) : 0;
      if (store && version === loadedIndexVersion) return;
      store = buildStore(await loadDbSources());
      loadedIndexVersion = version;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function load(): Store {
  if (!store) {
    throw new Error("[kb/store] knowledge base not loaded: call `await loadStore()` at the entry point before using the store.");
  }
  return store;
}

/** Forces a full reload on the next loadStore(). */
export function invalidateStoreCache() {
  store = null;
  loadedIndexVersion = -1;
  lastVersionCheck = 0;
}

/** Identifies the current snapshot; derived caches (e.g. the BM25 index) rebuild when it changes. */
export function getStoreGeneration(): number {
  return load().generation;
}

// ── Getters (synchronous, over the loaded snapshot) ─────────────────────────

export function getAllChunks(): KbChunk[] {
  return load().chunks;
}

export function getAllStandards(): KbStandard[] {
  return load().standards;
}

export function getGraph(): KbGraph {
  return load().graph;
}

export function getAllLabs(): LabRecord[] {
  return load().labs;
}

export function getAllAhcs(): AhcRecord[] {
  return load().ahcs;
}

export function getChunksByStandard(standardId: string): KbChunk[] {
  return load().chunksByStandard.get(standardId) ?? [];
}

function cleanId(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Resolves a standard by exact id, then by cleaned-id prefix match (handles "IS4151" -> "IS 4151"). */
export function getStandardById(idOrNorm: string): KbStandard | null {
  const s = load();
  const exact = s.standardsById.get(idOrNorm);
  if (exact) return exact;

  const cleanTarget = cleanId(idOrNorm);
  for (const std of s.standards) {
    if (cleanId(std.id) === cleanTarget) return std;
  }
  for (const std of s.standards) {
    const cleanStd = cleanId(std.id);
    if (cleanStd.startsWith(cleanTarget) || cleanTarget.startsWith(cleanStd)) return std;
  }
  return null;
}

/** Resolves a doc_id to its registry entry (real PDF filename, title, source_url), or null if unknown. */
export function getDocById(docId: string): KbDoc | null {
  return load().docsById.get(docId) ?? null;
}

export function getAllDocs(): KbDoc[] {
  return load().docs;
}

export function getGraphNode(id: string): GraphNode | undefined {
  return load().graph.nodes.find((n) => n.id === id);
}

export function getGraphNeighbors(nodeId: string, edgeTypes?: string[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const g = load().graph;
  const edges = g.edges.filter(
    (e) => (e.src === nodeId || e.dst === nodeId) && (!edgeTypes || edgeTypes.includes(e.type))
  );
  const nodeIds = new Set<string>([nodeId]);
  for (const e of edges) {
    nodeIds.add(e.src);
    nodeIds.add(e.dst);
  }
  const nodes = g.nodes.filter((n) => nodeIds.has(n.id));
  return { nodes, edges };
}

/** Labs whose scope includes the given standard, honest-empty if none. */
export function getLabsForStandard(standardId: string): LabRecord[] {
  return load().labs.filter((l) => l.standards_in_scope.includes(standardId));
}

/**
 * Is this chunk (likely) the standard's own scope clause? BIS standards
 * almost always put "1 SCOPE" first, sometimes split across "1.1"/"1.2"
 * (what's covered / what's excluded) — but deeper "1.x" clauses in some
 * documents are unrelated technical content that happens to live under a
 * top-level "1" the document uses for something else (observed: IS 15644's
 * "1.8 Clearances and creepage distances"). So: match "1", "1.1", "1.2"
 * specifically, or a title that says "scope" outright — not the whole "1.*"
 * family.
 */
export function isScopeChunk(clause: string, clauseTitle: string): boolean {
  return /^1(\.[12])?$/.test(clause) || /scope/i.test(clauseTitle);
}

// ── Dense search ─────────────────────────────────────────────────────────────

/**
 * Dense candidates for a query vector: indices into getAllChunks() with cosine
 * similarity, best first. db mode runs in PostgreSQL; json mode computes
 * cosine over the in-memory vectors (the original implementation).
 *
 * At prototype scale (< EXACT_SEARCH_MAX chunks) the db query is forced to an
 * exact scan so results match the JSON path; above it, the HNSW index is used.
 */
const EXACT_SEARCH_MAX = 20_000;

export async function denseSearchChunks(
  queryVec: number[],
  limit: number,
  standardIds?: string[]
): Promise<Array<{ chunk: KbChunk; similarity: number }>> {
  const s = load();
  if (getKbSource() === "json") {
    const scoped = standardIds ? s.chunks.filter((c) => standardIds.includes(c.standard_id)) : s.chunks;
    const scored: Array<{ chunk: KbChunk; similarity: number }> = [];
    for (const chunk of scoped) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;
      scored.push({ chunk, similarity: cosineSimilarity(queryVec, chunk.embedding) });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  const exact = s.chunks.length < EXACT_SEARCH_MAX;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (exact) await client.query("SET LOCAL enable_indexscan = off");
    else await client.query("SET LOCAL hnsw.ef_search = 100");
    const params: unknown[] = [toVectorLiteral(queryVec), limit];
    let where = "";
    if (standardIds && standardIds.length) {
      params.push(standardIds);
      where = "WHERE sc.document_id = ANY($3)";
    }
    const res = await client.query<{ id: string; similarity: number }>(
      `SELECT sc.id, 1 - (sc.embedding <=> $1::vector) AS similarity
         FROM searchable_chunks sc ${where}
        ORDER BY sc.embedding <=> $1::vector
        LIMIT $2`,
      params
    );
    await client.query("COMMIT");
    const out: Array<{ chunk: KbChunk; similarity: number }> = [];
    for (const r of res.rows) {
      // A row published after this snapshot was loaded has no snapshot chunk yet; it appears after the next reload.
      const chunk = s.chunkByRowId.get(r.id);
      if (chunk) out.push({ chunk, similarity: Number(r.similarity) });
    }
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
