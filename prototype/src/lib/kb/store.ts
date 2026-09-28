/**
 * BISVEDA — Knowledge base store (P2.1)
 *
 * Loads data/kb/{chunks,standards,graph}.json and data/directory/{labs,ahc}.json
 * ONCE per process (module-level cache) and serves everything else from
 * memory. This is the only place that touches the filesystem for KB data.
 *
 * Real data only: these files are produced by `npm run kb:build` / `dir:labs`
 * / `dir:ahc` from the 9 employee-uploaded PDFs and the official BIS LIMS /
 * Manak Online directories — see TODO.md P1. If a file is missing, the
 * getter returns an empty array/null rather than fabricating anything; the
 * caller (retrieval, tools) is responsible for surfacing that honestly as
 * "not in our sources", not silently inventing facts.
 */

import fs from "fs";
import path from "path";
import type { AhcRecord, GraphEdge, GraphNode, KbChunk, KbDoc, KbGraph, KbStandard, LabRecord } from "./types";

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

interface Store {
  chunks: KbChunk[];
  standards: KbStandard[];
  graph: KbGraph;
  labs: LabRecord[];
  ahcs: AhcRecord[];
  docs: KbDoc[];
  chunksByStandard: Map<string, KbChunk[]>;
  standardsById: Map<string, KbStandard>;
  docsById: Map<string, KbDoc>;
}

let store: Store | null = null;

function cleanId(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function load(): Store {
  if (store) return store;

  const chunks = loadJson<KbChunk[]>(path.join("kb", "chunks.json"), []);
  const standards = loadJson<KbStandard[]>(path.join("kb", "standards.json"), []);
  const graph = loadJson<KbGraph>(path.join("kb", "graph.json"), { nodes: [], edges: [] });
  const labs = loadJson<LabRecord[]>(path.join("directory", "labs.json"), []);
  const ahcs = loadJson<AhcRecord[]>(path.join("directory", "ahc.json"), []);
  const docs = loadJson<KbDoc[]>(path.join("kb", "docs.json"), []);

  const chunksByStandard = new Map<string, KbChunk[]>();
  for (const c of chunks) {
    const list = chunksByStandard.get(c.standard_id) ?? [];
    list.push(c);
    chunksByStandard.set(c.standard_id, list);
  }

  const standardsById = new Map<string, KbStandard>();
  for (const s of standards) standardsById.set(s.id, s);

  const docsById = new Map<string, KbDoc>();
  for (const d of docs) docsById.set(d.doc_id, d);

  store = { chunks, standards, graph, labs, ahcs, docs, chunksByStandard, standardsById, docsById };

  if (chunks.length === 0) {
    console.warn("[kb/store] 0 chunks loaded. Run `npm run kb:build` from prototype/ before starting the app.");
  }

  return store;
}

/** Forces a reload on the next getter call. Used by admin tooling / tests only. */
export function invalidateStoreCache() {
  store = null;
}

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
