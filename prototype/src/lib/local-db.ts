/**
 * BISVEDA Local Persistence Fallback Engine
 * Provides sovereign zero-dependency persistence when PostgreSQL+pgvector is offline.
 * Supports exact match, phrase search, keyword/FTS search, and 768-dim vector cosine similarity.
 */

import fs from "fs";
import path from "path";
import type { DocumentRow, ChunkRow } from "./db";
export type { DocumentRow, ChunkRow };
import { diffWords } from "diff";
import { clearSpeedGateCache } from "./speed-gate";
import type {
  StandardRecord,
  QcoRecord,
  SchemeRecord,
  LabRecord,
  FactRecord,
  DocumentVersionRecord,
  KgNode,
  KgEdge,
  AuditLogRecord,
  VersionImpactResult,
  VersionDiffResult,
  ChunkDiffItem,
  GraphApiResponse,
  GraphApiNode,
  GraphApiLink,
} from "./knowledge/types";

interface LocalStoreSchema {
  documents: Record<string, DocumentRow>;
  chunks: Record<string, ChunkRow>;
  ingestion_jobs: Record<string, any>;
  standards?: Record<string, StandardRecord>;
  qcos?: Record<string, QcoRecord>;
  qco_standards?: Array<{ qco_id: string; standard_id: string }>;
  schemes?: Record<string, SchemeRecord>;
  standard_schemes?: Array<{ standard_id: string; scheme_id: string }>;
  labs?: Record<string, LabRecord>;
  lab_scopes?: Array<{ lab_id: string; standard_id: string }>;
  facts?: Record<number, FactRecord>;
  document_versions?: Record<number, DocumentVersionRecord>;
  kg_nodes?: Record<string, KgNode>;
  kg_edges?: Array<KgEdge>;
  audit_log?: Record<number, AuditLogRecord>;
}

function getLocalStorePath(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), "prototype/data/bisveda_local_db.json"),
    path.resolve(process.cwd(), "data/bisveda_local_db.json"),
    path.resolve(__dirname, "../../data/bisveda_local_db.json"),
    path.resolve(__dirname, "../../../data/bisveda_local_db.json"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (parsed.standards && Object.keys(parsed.standards).length > 0) {
          return p;
        }
      } catch {}
    }
  }
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), "data/bisveda_local_db.json");
}

function loadLocalStore(): LocalStoreSchema {
  const p = getLocalStorePath();
  try {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(content);
      return {
        documents: parsed.documents || {},
        chunks: parsed.chunks || {},
        ingestion_jobs: parsed.ingestion_jobs || {},
        standards: parsed.standards || {},
        qcos: parsed.qcos || {},
        qco_standards: parsed.qco_standards || [],
        schemes: parsed.schemes || {},
        standard_schemes: parsed.standard_schemes || [],
        labs: parsed.labs || {},
        lab_scopes: parsed.lab_scopes || [],
        facts: parsed.facts || {},
        document_versions: parsed.document_versions || {},
        kg_nodes: parsed.kg_nodes || {},
        kg_edges: parsed.kg_edges || [],
        audit_log: parsed.audit_log || {},
      };
    }
  } catch (err) {
    console.warn("[Local Store Load Warning]:", err);
  }
  return {
    documents: {},
    chunks: {},
    ingestion_jobs: {},
    standards: {},
    qcos: {},
    qco_standards: [],
    schemes: {},
    standard_schemes: [],
    labs: {},
    lab_scopes: [],
    facts: {},
    document_versions: {},
    kg_nodes: {},
    kg_edges: [],
    audit_log: {},
  };
}

function saveLocalStore(data: LocalStoreSchema): void {
  const targetPaths = [
    path.resolve(process.cwd(), "prototype/data/bisveda_local_db.json"),
    path.resolve(process.cwd(), "data/bisveda_local_db.json"),
    path.resolve(__dirname, "../../data/bisveda_local_db.json"),
    path.resolve(__dirname, "../../../data/bisveda_local_db.json"),
  ];
  const uniquePaths = Array.from(new Set(targetPaths));
  for (const p of uniquePaths) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
      }
    } catch {}
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function localInsertDocument(doc: DocumentRow): Promise<void> {
  const store = loadLocalStore();
  store.documents[doc.id] = {
    ...doc,
    published_at: doc.published_at || new Date().toISOString(),
    created_at: doc.created_at || new Date().toISOString(),
  };
  saveLocalStore(store);
}

export async function localInsertChunks(chunks: ChunkRow[]): Promise<void> {
  if (chunks.length === 0) return;
  const store = loadLocalStore();
  for (const c of chunks) {
    store.chunks[c.chunk_id] = {
      ...c,
      is_active: c.is_active ?? true,
      verification_status: c.verification_status || "verified",
      knowledge_tier: c.knowledge_tier || "B",
    };
  }
  saveLocalStore(store);
}

export async function localSearchExactChunks(
  standardNumber: string,
  limit = 5
): Promise<ChunkRow[]> {
  const clean = standardNumber.replace(/\s+/g, "").toUpperCase();
  const store = loadLocalStore();
  const matches: ChunkRow[] = [];

  for (const c of Object.values(store.chunks)) {
    if (!c.is_active) continue;
    const std = (c.standard_number || "").replace(/\s+/g, "").toUpperCase();
    const id = (c.chunk_id || "").toUpperCase();
    if (std.includes(clean) || id.startsWith(clean)) {
      const doc = store.documents[c.document_id];
      matches.push({
        ...c,
        similarity: 0.99,
        filename: doc?.filename || c.filename,
        doc_title: doc?.title || c.doc_title,
        source_url: doc?.source_url || c.source_url,
      });
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

export async function localSearchPhraseChunks(
  phrase: string,
  limit = 5
): Promise<ChunkRow[]> {
  const cleanPhrase = phrase.toLowerCase().trim();
  const isPhrase = cleanPhrase.includes(" ") || cleanPhrase.length >= 15;
  if (!isPhrase || cleanPhrase.length < 3) return [];
  const store = loadLocalStore();
  const matches: ChunkRow[] = [];

  for (const c of Object.values(store.chunks)) {
    if (!c.is_active) continue;
    if (c.text.toLowerCase().includes(cleanPhrase)) {
      const doc = store.documents[c.document_id];
      matches.push({
        ...c,
        similarity: 0.98,
        filename: doc?.filename || c.filename,
        doc_title: doc?.title || c.doc_title,
        source_url: doc?.source_url || c.source_url,
      });
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

export async function localSearchFtsChunks(
  queryText: string,
  limit = 5
): Promise<ChunkRow[]> {
  const store = loadLocalStore();
  const terms = queryText
    .toLowerCase()
    .split(/[\s,.;:!?\-()\[\]]+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const scored: { chunk: ChunkRow; score: number }[] = [];

  for (const c of Object.values(store.chunks)) {
    if (!c.is_active) continue;
    const textLower = c.text.toLowerCase();
    const titleLower = (c.clause_title || "").toLowerCase();
    let hits = 0;

    for (const term of terms) {
      if (textLower.includes(term)) hits++;
      if (titleLower.includes(term)) hits += 2;
    }

    if (hits > 0) {
      const doc = store.documents[c.document_id];
      const termRatio = hits / terms.length;
      const hasTitleHit = terms.some(
        (t) =>
          titleLower.includes(t) ||
          (c.standard_number || "").toLowerCase().includes(t) ||
          (doc?.title || "").toLowerCase().includes(t)
      );
      let sim: number;
      if (terms.length === 1 && !hasTitleHit) {
        sim = 0.30;
      } else {
        sim = Math.min(
          0.95,
          Math.max(0.30, Math.round((0.35 + termRatio * 0.45 + (hasTitleHit ? 0.15 : 0)) * 100) / 100)
        );
      }
      scored.push({
        chunk: {
          ...c,
          similarity: sim,
          filename: doc?.filename || c.filename,
          doc_title: doc?.title || c.doc_title,
          source_url: doc?.source_url || c.source_url,
        },
        score: hits,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.chunk);
}

export async function localSearchVectorChunks(
  embedding: number[],
  limit = 5,
  minSimilarity = 0.40
): Promise<ChunkRow[]> {
  const store = loadLocalStore();
  const scored: { chunk: ChunkRow; similarity: number }[] = [];

  for (const c of Object.values(store.chunks)) {
    if (!c.is_active || !c.embedding || c.embedding.length === 0) continue;
    const sim = cosineSimilarity(embedding, c.embedding);
    if (sim >= minSimilarity) {
      const doc = store.documents[c.document_id];
      scored.push({
        chunk: {
          ...c,
          similarity: Math.round(sim * 10000) / 10000,
          filename: doc?.filename || c.filename,
          doc_title: doc?.title || c.doc_title,
          source_url: doc?.source_url || c.source_url,
        },
        similarity: sim,
      });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit).map((s) => s.chunk);
}

export async function localGetAllDocuments(): Promise<DocumentRow[]> {
  const store = loadLocalStore();
  const docs = Object.values(store.documents);
  return docs.map((d) => {
    const chunkCount = Object.values(store.chunks).filter((c) => c.document_id === d.id).length;
    return { ...d, chunk_count: chunkCount } as any;
  });
}

export async function localGetDocumentById(id: string): Promise<DocumentRow | null> {
  const store = loadLocalStore();
  if (store.documents[id]) return store.documents[id];

  const cleanId = id.trim().toLowerCase();
  const cleanNoSpaces = cleanId.replace(/\s+/g, "");

  // Match by standard_number, filename, or ID
  const found = Object.values(store.documents).find((d) => {
    if (d.id.toLowerCase() === cleanId) return true;
    if (d.standard_number) {
      const stdLower = d.standard_number.toLowerCase();
      const stdNoSpaces = stdLower.replace(/\s+/g, "");
      if (stdLower === cleanId || stdNoSpaces === cleanNoSpaces) return true;
      if (stdNoSpaces.includes(cleanNoSpaces) || cleanNoSpaces.includes(stdNoSpaces)) return true;
    }
    if (d.filename && (d.filename.toLowerCase() === cleanId || d.filename.toLowerCase().includes(cleanId))) return true;
    return false;
  });
  if (found) return found;

  // Check ingestion_jobs mapping
  if (store.ingestion_jobs[id]?.document_id) {
    const docId = store.ingestion_jobs[id].document_id;
    if (store.documents[docId]) return store.documents[docId];
  }

  return null;
}

export async function localGetDocumentBySha256(sha: string): Promise<DocumentRow | null> {
  const store = loadLocalStore();
  return Object.values(store.documents).find((d) => d.sha256 === sha) || null;
}

export async function localGetDocumentChunks(id: string): Promise<ChunkRow[]> {
  const store = loadLocalStore();
  let targetDocId = id;
  const doc = await localGetDocumentById(id);
  if (doc) {
    targetDocId = doc.id;
  }
  const cleanId = id.trim().toLowerCase().replace(/\s+/g, "");
  return Object.values(store.chunks).filter(
    (c) =>
      c.document_id === targetDocId ||
      (c.standard_number &&
        (c.standard_number.toLowerCase().replace(/\s+/g, "").includes(cleanId) ||
          cleanId.includes(c.standard_number.toLowerCase().replace(/\s+/g, ""))))
  );
}

export async function localSaveIngestionJob(
  jobId: string,
  documentId: string,
  status: string,
  filename: string,
  standardNumber?: string,
  pageCount = 0,
  chunkCount = 0,
  events: any[] = [],
  errors: string[] = []
): Promise<void> {
  const store = loadLocalStore();
  store.ingestion_jobs[jobId] = {
    job_id: jobId,
    document_id: documentId,
    status,
    filename,
    standard_number: standardNumber,
    page_count: pageCount,
    chunk_count: chunkCount,
    events,
    errors,
    updated_at: new Date().toISOString(),
  };
  saveLocalStore(store);
}

export async function localPurgeDocument(
  documentId: string
): Promise<{ success: boolean; minioDeleted: boolean; chunksRemoved: number }> {
  const store = loadLocalStore();
  let targetId = documentId;
  if (!store.documents[targetId]) {
    const doc = await localGetDocumentById(documentId);
    if (doc) targetId = doc.id;
  }

  delete store.documents[targetId];
  if (targetId !== documentId) {
    delete store.documents[documentId];
  }

  let removed = 0;
  for (const [k, v] of Object.entries(store.chunks)) {
    if (v.document_id === targetId || v.document_id === documentId) {
      delete store.chunks[k];
      removed++;
    }
  }
  for (const [k, v] of Object.entries(store.ingestion_jobs)) {
    if (v.document_id === targetId || v.document_id === documentId || k === documentId) {
      delete store.ingestion_jobs[k];
    }
  }
  saveLocalStore(store);
  return { success: true, minioDeleted: false, chunksRemoved: removed };
}

export async function localPublishDocument(documentId: string): Promise<boolean> {
  const store = loadLocalStore();
  let targetId = documentId;
  if (!store.documents[targetId]) {
    const doc = await localGetDocumentById(documentId);
    if (doc) targetId = doc.id;
  }

  if (store.documents[targetId]) {
    store.documents[targetId].status = "published";
    store.documents[targetId].verification_status = "verified";
    for (const c of Object.values(store.chunks)) {
      if (c.document_id === targetId) {
        c.is_active = true;
        c.verification_status = "verified";
      }
    }
    saveLocalStore(store);
    return true;
  }
  return false;
}

export async function localRevokeDocument(documentId: string): Promise<boolean> {
  const store = loadLocalStore();
  let targetId = documentId;
  if (!store.documents[targetId]) {
    const doc = await localGetDocumentById(documentId);
    if (doc) targetId = doc.id;
  }

  if (store.documents[targetId]) {
    store.documents[targetId].status = "revoked";
    store.documents[targetId].verification_status = "revoked";
    for (const c of Object.values(store.chunks)) {
      if (c.document_id === targetId) {
        c.is_active = false;
        c.verification_status = "revoked";
      }
    }
    saveLocalStore(store);
    return true;
  }
  return false;
}

export async function localUpdateDocument(
  documentId: string,
  updates: Partial<DocumentRow>
): Promise<boolean> {
  const store = loadLocalStore();
  let targetId = documentId;
  if (!store.documents[targetId]) {
    const doc = await localGetDocumentById(documentId);
    if (doc) targetId = doc.id;
  }

  if (store.documents[targetId]) {
    store.documents[targetId] = {
      ...store.documents[targetId],
      ...updates,
    };
    saveLocalStore(store);
    return true;
  }
  return false;
}

export async function localUpdateChunks(
  documentId: string,
  updatedChunks: ChunkRow[]
): Promise<boolean> {
  const store = loadLocalStore();
  for (const chunk of updatedChunks) {
    if (store.chunks[chunk.chunk_id]) {
      store.chunks[chunk.chunk_id] = {
        ...store.chunks[chunk.chunk_id],
        ...chunk,
      };
    } else {
      store.chunks[chunk.chunk_id] = {
        ...chunk,
        document_id: documentId,
        is_active: chunk.is_active ?? true,
      };
    }
  }
  saveLocalStore(store);
  return true;
}

export async function localDeleteChunk(chunkId: string): Promise<boolean> {
  const store = loadLocalStore();
  if (store.chunks[chunkId]) {
    delete store.chunks[chunkId];
    saveLocalStore(store);
    return true;
  }
  return false;
}

// ── Knowledge Layer: Standards ───────────────────────────────────────────────

export async function localUpsertStandards(records: StandardRecord[]): Promise<void> {
  const store = loadLocalStore();
  store.standards = store.standards || {};
  for (const s of records) {
    store.standards[s.id] = {
      ...(store.standards[s.id] || {}),
      ...s,
      updated_at: s.updated_at || new Date().toISOString(),
    };
  }
  saveLocalStore(store);
}

export async function localGetStandard(idOrNorm: string): Promise<StandardRecord | null> {
  const store = loadLocalStore();
  const cleanTarget = idOrNorm.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  
  // 1. Exact match
  for (const s of Object.values(store.standards || {})) {
    if (
      s.id.toUpperCase() === idOrNorm.toUpperCase() ||
      s.is_number_norm.toUpperCase() === cleanTarget ||
      s.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === cleanTarget
    ) {
      return s;
    }
  }

  // 2. Prefix / Part match
  for (const s of Object.values(store.standards || {})) {
    const sClean = s.is_number_norm.toUpperCase();
    if (sClean.startsWith(cleanTarget) || cleanTarget.startsWith(sClean)) {
      return s;
    }
  }

  return null;
}

export async function localGetAllStandards(): Promise<StandardRecord[]> {
  const store = loadLocalStore();
  return Object.values(store.standards || {});
}

export async function localSearchStandardsSemantic(
  embedding: number[],
  limit = 10
): Promise<Array<StandardRecord & { similarity: number }>> {
  const store = loadLocalStore();
  const results: Array<StandardRecord & { similarity: number }> = [];
  for (const s of Object.values(store.standards || {})) {
    if (s.embedding && s.embedding.length > 0) {
      const sim = cosineSimilarity(embedding, s.embedding);
      results.push({ ...s, similarity: sim });
    }
  }
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

export async function localSearchStandardsTrigram(
  term: string,
  limit = 10
): Promise<Array<StandardRecord & { similarity: number }>> {
  const store = loadLocalStore();
  const cleanTerm = term.toLowerCase().trim();
  const tokens = cleanTerm.split(/\s+/).filter((t) => t.length > 2);
  const results: Array<StandardRecord & { similarity: number }> = [];

  for (const s of Object.values(store.standards || {})) {
    const titleLower = (s.title + " " + (s.scope_text || "")).toLowerCase();
    let score = 0;
    if (titleLower.includes(cleanTerm)) score += 0.8;
    for (const t of tokens) {
      if (titleLower.includes(t)) score += 0.2;
    }
    if (score > 0) {
      results.push({ ...s, similarity: Math.min(score, 1.0) });
    }
  }
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

// ── Knowledge Layer: QCOs ───────────────────────────────────────────────────

export async function localUpsertQcos(
  records: QcoRecord[],
  links: Array<{ qco_id: string; standard_id: string }>
): Promise<void> {
  const store = loadLocalStore();
  store.qcos = store.qcos || {};
  for (const q of records) {
    store.qcos[q.id] = { ...(store.qcos[q.id] || {}), ...q };
  }
  store.qco_standards = store.qco_standards || [];
  for (const link of links) {
    const exists = store.qco_standards.some(
      (l) => l.qco_id === link.qco_id && l.standard_id === link.standard_id
    );
    if (!exists) store.qco_standards.push(link);
  }
  saveLocalStore(store);
}

export async function localGetQcosForStandard(stdId: string): Promise<QcoRecord[]> {
  const store = loadLocalStore();
  const cleanTarget = stdId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Check approved / rejected edges in kg_edges
  const rejectedQcoIds = new Set<string>();
  const approvedQcoIdsFromKg = new Set<string>();
  for (const e of store.kg_edges || []) {
    const eDstClean = e.dst.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const eSrcClean = e.src.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (e.type === "MANDATES" || (e.type as string) === "MANDATED_BY") {
      if (eDstClean.includes(cleanTarget) || cleanTarget.includes(eDstClean)) {
        const qid = e.src.replace(/^qco:/, "");
        if (e.status === "rejected") {
          rejectedQcoIds.add(qid);
        } else if (e.status === "approved") {
          approvedQcoIdsFromKg.add(qid);
        }
      }
    }
  }

  const matchingQcoIds = (store.qco_standards || [])
    .filter((l) => {
      const lClean = l.standard_id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      return lClean === cleanTarget || lClean.startsWith(cleanTarget) || cleanTarget.startsWith(lClean);
    })
    .map((l) => l.qco_id)
    .filter((qid) => !rejectedQcoIds.has(qid));

  for (const qid of approvedQcoIdsFromKg) {
    if (!rejectedQcoIds.has(qid) && !matchingQcoIds.includes(qid)) {
      matchingQcoIds.push(qid);
    }
  }

  const qcos: QcoRecord[] = [];
  for (const qid of matchingQcoIds) {
    if (store.qcos?.[qid]) {
      qcos.push(store.qcos[qid]);
    }
  }
  return qcos;
}

// ── Knowledge Layer: Schemes ────────────────────────────────────────────────

export async function localUpsertSchemes(
  records: SchemeRecord[],
  links: Array<{ standard_id: string; scheme_id: string }>
): Promise<void> {
  const store = loadLocalStore();
  store.schemes = store.schemes || {};
  for (const sc of records) {
    store.schemes[sc.id] = { ...(store.schemes[sc.id] || {}), ...sc };
  }
  store.standard_schemes = store.standard_schemes || [];
  for (const link of links) {
    const exists = store.standard_schemes.some(
      (l) => l.standard_id === link.standard_id && l.scheme_id === link.scheme_id
    );
    if (!exists) store.standard_schemes.push(link);
  }
  saveLocalStore(store);
}

export async function localGetSchemesForStandard(stdId: string): Promise<SchemeRecord[]> {
  const store = loadLocalStore();
  const cleanTarget = stdId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const matchingSchemeIds = (store.standard_schemes || [])
    .filter((l) => {
      const lClean = l.standard_id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      return lClean === cleanTarget || lClean.startsWith(cleanTarget) || cleanTarget.startsWith(lClean);
    })
    .map((l) => l.scheme_id);

  const schemes: SchemeRecord[] = [];
  for (const sid of matchingSchemeIds) {
    if (store.schemes?.[sid]) {
      schemes.push(store.schemes[sid]);
    }
  }
  if (schemes.length === 0 && store.schemes?.["scheme-1"]) {
    // Default Scheme I if standard is in facts
    schemes.push(store.schemes["scheme-1"]);
  }
  return schemes;
}

// ── Knowledge Layer: Labs ───────────────────────────────────────────────────

export async function localUpsertLabs(
  records: LabRecord[],
  links: Array<{ lab_id: string; standard_id: string }>
): Promise<void> {
  const store = loadLocalStore();
  store.labs = store.labs || {};
  for (const lab of records) {
    store.labs[lab.id] = { ...(store.labs[lab.id] || {}), ...lab };
  }
  store.lab_scopes = store.lab_scopes || [];
  for (const link of links) {
    const exists = store.lab_scopes.some(
      (l) => l.lab_id === link.lab_id && l.standard_id === link.standard_id
    );
    if (!exists) store.lab_scopes.push(link);
  }
  saveLocalStore(store);
}

export async function localGetLabsForStandard(
  stdId: string,
  near?: { lat: number; lng: number }
): Promise<LabRecord[]> {
  const store = loadLocalStore();
  const cleanTarget = stdId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const matchingLabIds = (store.lab_scopes || [])
    .filter((l) => {
      const lClean = l.standard_id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      return lClean === cleanTarget || lClean.startsWith(cleanTarget) || cleanTarget.startsWith(lClean);
    })
    .map((l) => l.lab_id);

  const labs: LabRecord[] = [];
  for (const lid of matchingLabIds) {
    if (store.labs?.[lid]) {
      labs.push(store.labs[lid]);
    }
  }

  // If user provided coordinates, sort by distance
  if (near && near.lat && near.lng) {
    labs.sort((a, b) => {
      if (!a.lat || !a.lng) return 1;
      if (!b.lat || !b.lng) return -1;
      const distA = Math.hypot(a.lat - near.lat, a.lng - near.lng);
      const distB = Math.hypot(b.lat - near.lat, b.lng - near.lng);
      return distA - distB;
    });
  }

  return labs;
}

// ── Knowledge Layer: Facts ──────────────────────────────────────────────────

export async function localUpsertFacts(records: FactRecord[]): Promise<void> {
  const store = loadLocalStore();
  store.facts = store.facts || {};
  for (const f of records) {
    store.facts[f.id] = { ...(store.facts[f.id] || {}), ...f };
  }
  saveLocalStore(store);
}

export async function localGetFacts(filter?: {
  subject_id?: string;
  predicate?: string;
  status?: string;
}): Promise<FactRecord[]> {
  const store = loadLocalStore();
  let facts = Object.values(store.facts || {});
  if (filter?.subject_id) {
    facts = facts.filter((f) => f.subject_id === filter.subject_id);
  }
  if (filter?.predicate) {
    facts = facts.filter((f) => f.predicate === filter.predicate);
  }
  if (filter?.status) {
    facts = facts.filter((f) => f.status === filter.status);
  }
  return facts;
}

// ── Knowledge Layer: Document Versions ──────────────────────────────────────

export async function localUpsertDocumentVersions(records: DocumentVersionRecord[]): Promise<void> {
  const store = loadLocalStore();
  store.document_versions = store.document_versions || {};
  for (const v of records) {
    store.document_versions[v.id] = { ...(store.document_versions[v.id] || {}), ...v };
  }
  saveLocalStore(store);
}

export async function localGetDocumentVersions(docId?: string): Promise<DocumentVersionRecord[]> {
  const store = loadLocalStore();
  let versions = Object.values(store.document_versions || {});
  if (docId) {
    versions = versions.filter((v) => v.document_id === docId);
  }
  return versions;
}

// ── Knowledge Layer: Knowledge Graph ────────────────────────────────────────

export async function localUpsertKg(nodes: KgNode[], edges: KgEdge[]): Promise<void> {
  const store = loadLocalStore();
  store.kg_nodes = store.kg_nodes || {};
  for (const n of nodes) {
    store.kg_nodes[n.id] = { ...(store.kg_nodes[n.id] || {}), ...n };
  }
  store.kg_edges = store.kg_edges || [];
  for (const e of edges) {
    const idx = store.kg_edges.findIndex(
      (existing) => existing.src === e.src && existing.dst === e.dst && existing.type === e.type
    );
    if (idx >= 0) {
      store.kg_edges[idx] = { ...store.kg_edges[idx], ...e };
    } else {
      store.kg_edges.push(e);
    }
  }
  saveLocalStore(store);
}

export async function localGetKgNeighbors(
  nodeId: string,
  edgeTypes?: string[],
  depth: 1 | 2 = 1
): Promise<{ nodes: KgNode[]; edges: KgEdge[] }> {
  const store = loadLocalStore();
  const approvedEdges = (store.kg_edges || []).filter((e) => e.status === "approved");
  const visitedNodeIds = new Set<string>([nodeId]);
  const matchedEdges: KgEdge[] = [];

  // Depth 1
  for (const e of approvedEdges) {
    if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(e.type)) continue;
    if (e.src === nodeId) {
      visitedNodeIds.add(e.dst);
      matchedEdges.push(e);
    } else if (e.dst === nodeId) {
      visitedNodeIds.add(e.src);
      matchedEdges.push(e);
    }
  }

  // Depth 2
  if (depth === 2) {
    const d1NodeIds = Array.from(visitedNodeIds);
    for (const d1Id of d1NodeIds) {
      for (const e of approvedEdges) {
        if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(e.type)) continue;
        if (e.src === d1Id) {
          visitedNodeIds.add(e.dst);
          if (!matchedEdges.includes(e)) matchedEdges.push(e);
        } else if (e.dst === d1Id) {
          visitedNodeIds.add(e.src);
          if (!matchedEdges.includes(e)) matchedEdges.push(e);
        }
      }
    }
  }

  const nodes: KgNode[] = [];
  for (const nid of visitedNodeIds) {
    if (store.kg_nodes?.[nid]) {
      nodes.push(store.kg_nodes[nid]);
    }
  }

  return { nodes, edges: matchedEdges };
}

export async function localGetKgStandardsForProduct(productNodeId: string): Promise<string[]> {
  const store = loadLocalStore();
  const approvedEdges = (store.kg_edges || []).filter((e) => e.status === "approved");

  // Step 1: prod -IS_A-> pg
  const pgNodeIds = approvedEdges
    .filter((e) => e.src === productNodeId && e.type === "IS_A")
    .map((e) => e.dst);

  // Step 2: pg -COVERS-> std
  const standardIds: string[] = [];
  for (const pgId of pgNodeIds) {
    const stds = approvedEdges
      .filter((e) => e.src === pgId && e.type === "COVERS")
      .map((e) => e.dst.replace(/^std:/, ""));
    standardIds.push(...stds);
  }

  return Array.from(new Set(standardIds));
}

// ── Knowledge Layer: Audit Log ──────────────────────────────────────────────

export async function localInsertAuditLog(entry: Omit<AuditLogRecord, "id">): Promise<AuditLogRecord> {
  const store = loadLocalStore();
  store.audit_log = store.audit_log || {};
  const existingIds = Object.keys(store.audit_log).map(Number).filter((n) => !isNaN(n));
  const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  const record: AuditLogRecord = {
    id: newId,
    at: entry.at || new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    before: entry.before || null,
    after: entry.after || null,
    note: entry.note || "",
  };
  store.audit_log[newId] = record;
  saveLocalStore(store);
  return record;
}

export async function localGetAuditLogs(filter?: {
  target_type?: string;
  target_id?: string;
  limit?: number;
}): Promise<AuditLogRecord[]> {
  const store = loadLocalStore();
  let logs = Object.values(store.audit_log || {});
  if (filter?.target_type) {
    logs = logs.filter((l) => l.target_type === filter.target_type);
  }
  if (filter?.target_id) {
    logs = logs.filter((l) => l.target_id === filter.target_id);
  }
  logs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || b.id - a.id);
  if (filter?.limit) {
    logs = logs.slice(0, filter.limit);
  }
  return logs;
}

// ── Knowledge Layer: Version Lifecycle (Git for Documents) ──────────────────

export async function localSubmitVersionForReview(
  versionId: number,
  note?: string,
  actor = "officer"
): Promise<DocumentVersionRecord> {
  const store = loadLocalStore();
  const v = store.document_versions?.[versionId];
  if (!v) throw new Error(`Version ${versionId} not found`);
  const before = { ...v };
  v.status = "in_review";
  if (note) v.change_note = note;
  saveLocalStore(store);

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "submit_for_review",
    target_type: "document_version",
    target_id: String(versionId),
    before,
    after: { ...v },
    note: note || "Submitted version for review",
  });

  return v;
}

export async function localPublishVersion(
  versionId: number,
  note?: string,
  actor = "officer"
): Promise<DocumentVersionRecord> {
  const store = loadLocalStore();
  const target = store.document_versions?.[versionId];
  if (!target) throw new Error(`Version ${versionId} not found`);
  const before = { ...target };

  // Archive any currently published version of the same document in the same transaction
  for (const v of Object.values(store.document_versions || {})) {
    if (v.document_id === target.document_id && v.status === "published" && v.id !== versionId) {
      v.status = "archived";
    }
  }

  target.status = "published";
  target.published_by = actor;
  target.published_at = new Date().toISOString();
  if (note) target.change_note = note;

  // Activate chunks belonging to this version or document
  for (const c of Object.values(store.chunks || {})) {
    if (c.doc_version_id === versionId || (!c.doc_version_id && c.document_id === target.document_id)) {
      c.is_active = true;
      c.verification_status = "verified";
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "publish",
    target_type: "document_version",
    target_id: String(versionId),
    before,
    after: { ...target },
    note: note || `Published version ${target.version_no}`,
  });

  return target;
}

export async function localArchiveVersion(
  versionId: number,
  note?: string,
  actor = "officer"
): Promise<DocumentVersionRecord> {
  const store = loadLocalStore();
  const target = store.document_versions?.[versionId];
  if (!target) throw new Error(`Version ${versionId} not found`);
  const before = { ...target };

  target.status = "archived";
  if (note) target.change_note = note;

  // Deactivate chunks if no other published version for this document exists
  const hasOtherPublished = Object.values(store.document_versions || {}).some(
    (v) => v.document_id === target.document_id && v.status === "published" && v.id !== versionId
  );
  if (!hasOtherPublished) {
    for (const c of Object.values(store.chunks || {})) {
      if (c.doc_version_id === versionId || (!c.doc_version_id && c.document_id === target.document_id)) {
        c.is_active = false;
      }
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "archive",
    target_type: "document_version",
    target_id: String(versionId),
    before,
    after: { ...target },
    note: note || `Archived version ${target.version_no}`,
  });

  return target;
}

export async function localRollbackVersion(
  versionId: number,
  note?: string,
  actor = "officer"
): Promise<DocumentVersionRecord> {
  const store = loadLocalStore();
  const target = store.document_versions?.[versionId];
  if (!target) throw new Error(`Version ${versionId} not found`);
  const before = { ...target };

  // Archive any current published version of the same document
  for (const v of Object.values(store.document_versions || {})) {
    if (v.document_id === target.document_id && v.status === "published" && v.id !== versionId) {
      v.status = "archived";
    }
  }

  target.status = "published";
  target.published_by = actor;
  target.published_at = new Date().toISOString();
  if (note) target.change_note = note;

  // Reactivate chunks for this version
  for (const c of Object.values(store.chunks || {})) {
    if (c.doc_version_id === versionId || (!c.doc_version_id && c.document_id === target.document_id)) {
      c.is_active = true;
      c.verification_status = "verified";
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "rollback",
    target_type: "document_version",
    target_id: String(versionId),
    before,
    after: { ...target },
    note: note || `Rolled back to version ${target.version_no}`,
  });

  return target;
}

export async function localGetVersionImpact(versionId: number): Promise<VersionImpactResult> {
  const store = loadLocalStore();
  const target = store.document_versions?.[versionId];
  if (!target) throw new Error(`Version ${versionId} not found`);

  const docChunks = Object.values(store.chunks || {}).filter(
    (c) => c.doc_version_id === versionId || (!c.doc_version_id && c.document_id === target.document_id)
  );

  const delta = target.status === "published" ? -docChunks.length : docChunks.length;

  const chunkIds = new Set(docChunks.map((c) => c.chunk_id));
  const affectedFacts = Object.values(store.facts || {}).filter(
    (f) => f.source_chunk_id && chunkIds.has(String(f.source_chunk_id))
  );

  const docNodeId = `doc:${target.document_id}`;
  const verNodeId = `ver:${target.id}`;
  const affectedEdges = (store.kg_edges || []).filter(
    (e) => e.src === docNodeId || e.dst === docNodeId || e.src === verNodeId || e.dst === verNodeId
  );

  return {
    versionId,
    documentId: target.document_id,
    currentStatus: target.status,
    searchableChunksDelta: delta,
    totalChunks: docChunks.length,
    affectedFactsCount: affectedFacts.length,
    affectedEdgesCount: affectedEdges.length,
    orphanedEdgesCount: 0,
  };
}

export async function localDiffVersions(
  versionIdA: number,
  versionIdB: number
): Promise<VersionDiffResult> {
  const store = loadLocalStore();
  const vA = store.document_versions?.[versionIdA];
  const vB = store.document_versions?.[versionIdB];
  if (!vA || !vB) throw new Error("One or both versions not found");

  const chunksA = Object.values(store.chunks || {}).filter(
    (c) => c.doc_version_id === versionIdA || (!c.doc_version_id && c.document_id === vA.document_id)
  );
  const chunksB = Object.values(store.chunks || {}).filter(
    (c) => c.doc_version_id === versionIdB || (!c.doc_version_id && c.document_id === vB.document_id)
  );

  const mapA = new Map<string, typeof chunksA[0]>();
  for (const c of chunksA) {
    const key = c.clause_number || c.chunk_id;
    mapA.set(key, c);
  }

  const mapB = new Map<string, typeof chunksB[0]>();
  for (const c of chunksB) {
    const key = c.clause_number || c.chunk_id;
    mapB.set(key, c);
  }

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const items: ChunkDiffItem[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const key of allKeys) {
    const cA = mapA.get(key);
    const cB = mapB.get(key);

    if (cA && !cB) {
      removed++;
      items.push({
        clause_id: key,
        page: cA.page_numbers?.[0],
        title: cA.clause_title,
        textA: cA.text,
        diffStatus: "removed",
      });
    } else if (!cA && cB) {
      added++;
      items.push({
        clause_id: key,
        page: cB.page_numbers?.[0],
        title: cB.clause_title,
        textB: cB.text,
        diffStatus: "added",
      });
    } else if (cA && cB) {
      if (cA.text.trim() === cB.text.trim()) {
        unchanged++;
        items.push({
          clause_id: key,
          page: cB.page_numbers?.[0],
          title: cB.clause_title,
          textA: cA.text,
          textB: cB.text,
          diffStatus: "unchanged",
        });
      } else {
        changed++;
        const words = diffWords(cA.text, cB.text);
        items.push({
          clause_id: key,
          page: cB.page_numbers?.[0],
          title: cB.clause_title,
          textA: cA.text,
          textB: cB.text,
          diffStatus: "changed",
          wordDiff: words.map((w) => ({
            value: w.value,
            added: w.added,
            removed: w.removed,
          })),
        });
      }
    }
  }

  return {
    versionA: vA,
    versionB: vB,
    summary: { added, removed, changed, unchanged },
    chunks: items,
  };
}

// ── Knowledge Layer: Facts Control ──────────────────────────────────────────

export async function localApproveFact(
  factId: number,
  actor = "officer",
  note?: string
): Promise<FactRecord> {
  const store = loadLocalStore();
  const fact = store.facts?.[factId];
  if (!fact) throw new Error(`Fact ${factId} not found`);
  const before = { ...fact };

  fact.status = "approved";
  fact.reviewed_by = actor;
  fact.reviewed_at = new Date().toISOString();
  if (note) fact.note = note;

  // Sync edge in kg_edges
  if (fact.object_id) {
    store.kg_edges = store.kg_edges || [];
    let matched = false;
    for (const e of store.kg_edges) {
      if (
        (e.src === fact.subject_id && e.dst === fact.object_id) ||
        (e.dst === fact.subject_id && e.src === fact.object_id) ||
        (fact.predicate === "mandated_by" && (
          (e.src === fact.object_id && e.dst === fact.subject_id) ||
          (e.src === fact.subject_id && e.dst === fact.object_id)
        ))
      ) {
        e.status = "approved";
        e.fact_id = factId;
        matched = true;
      }
    }
    if (!matched) {
      const edgeType = fact.predicate === "mandated_by" ? "MANDATES"
        : fact.predicate === "certified_under" ? "CERTIFIED_UNDER"
        : fact.predicate === "accredited_for" ? "ACCREDITED_FOR"
        : "REFERENCES";
      store.kg_edges.push({
        src: fact.subject_id,
        dst: fact.object_id,
        type: edgeType,
        fact_id: factId,
        source_url: fact.source_url,
        status: "approved",
      });
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "approve_fact",
    target_type: "fact",
    target_id: String(factId),
    before,
    after: { ...fact },
    note: note || `Approved fact: ${fact.subject_id} ${fact.predicate} ${fact.object_id || fact.value}`,
  });

  return fact;
}

export async function localRejectFact(
  factId: number,
  reason: string,
  actor = "officer"
): Promise<FactRecord> {
  const store = loadLocalStore();
  const fact = store.facts?.[factId];
  if (!fact) throw new Error(`Fact ${factId} not found`);
  const before = { ...fact };

  fact.status = "rejected";
  fact.reviewed_by = actor;
  fact.reviewed_at = new Date().toISOString();
  fact.note = reason;

  // Mark matching edge in kg_edges as rejected
  store.kg_edges = store.kg_edges || [];
  for (const e of store.kg_edges) {
    if (
      e.fact_id === factId ||
      (fact.object_id &&
        ((e.src === fact.subject_id && e.dst === fact.object_id) ||
         (e.dst === fact.subject_id && e.src === fact.object_id) ||
         (fact.predicate === "mandated_by" && (
           (e.src === fact.object_id && e.dst === fact.subject_id) ||
           (e.src === fact.subject_id && e.dst === fact.object_id)
         ))))
    ) {
      e.status = "rejected";
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "reject_fact",
    target_type: "fact",
    target_id: String(factId),
    before,
    after: { ...fact },
    note: reason,
  });

  return fact;
}

export async function localEditFact(
  factId: number,
  updates: Partial<FactRecord>,
  actor = "officer",
  note?: string
): Promise<FactRecord> {
  const store = loadLocalStore();
  store.facts = store.facts || {};
  const oldFact = store.facts[factId];
  if (!oldFact) throw new Error(`Fact ${factId} not found`);

  // Reject old fact to preserve history
  oldFact.status = "rejected";
  oldFact.note = `Superceded by edit by ${actor}: ${note || "Fact updated"}`;
  oldFact.reviewed_by = actor;
  oldFact.reviewed_at = new Date().toISOString();

  // Create new fact
  const existingIds = Object.keys(store.facts || {}).map(Number).filter((n) => !isNaN(n));
  const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  const newFact: FactRecord = {
    ...oldFact,
    ...updates,
    id: newId,
    status: updates.status || "approved",
    created_by: actor,
    created_at: new Date().toISOString(),
    reviewed_by: actor,
    reviewed_at: new Date().toISOString(),
    note: note || `Edited from #${factId}`,
  };

  store.facts[newId] = newFact;

  // Sync edge
  if (newFact.object_id) {
    store.kg_edges = store.kg_edges || [];
    for (const e of store.kg_edges) {
      if (
        (e.src === newFact.subject_id && e.dst === newFact.object_id) ||
        (e.dst === newFact.subject_id && e.src === newFact.object_id) ||
        (newFact.predicate === "mandated_by" && (
          (e.src === newFact.object_id && e.dst === newFact.subject_id) ||
          (e.src === newFact.subject_id && e.dst === newFact.object_id)
        ))
      ) {
        e.status = newFact.status === "approved" ? "approved" : "rejected";
        e.fact_id = newId;
      }
    }
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "edit_fact",
    target_type: "fact",
    target_id: String(newId),
    before: oldFact,
    after: newFact,
    note: note || `Edited fact #${factId} -> #${newId}`,
  });

  return newFact;
}

export async function localCreateFact(
  fact: Omit<FactRecord, "id">,
  actor = "officer"
): Promise<FactRecord> {
  const store = loadLocalStore();
  store.facts = store.facts || {};
  const existingIds = Object.keys(store.facts).map(Number).filter((n) => !isNaN(n));
  const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

  const record: FactRecord = {
    ...fact,
    id: newId,
    created_at: fact.created_at || new Date().toISOString(),
    created_by: fact.created_by || actor,
    status: fact.status || "proposed",
  };
  store.facts[newId] = record;

  if (record.object_id && record.status === "approved") {
    store.kg_edges = store.kg_edges || [];
    const edgeType = record.predicate === "mandated_by" ? "MANDATES"
      : record.predicate === "certified_under" ? "CERTIFIED_UNDER"
      : record.predicate === "accredited_for" ? "ACCREDITED_FOR"
      : "REFERENCES";
    store.kg_edges.push({
      src: record.subject_id,
      dst: record.object_id,
      type: edgeType,
      fact_id: newId,
      source_url: record.source_url,
      status: "approved",
    });
  }

  saveLocalStore(store);
  clearSpeedGateCache();

  await localInsertAuditLog({
    at: new Date().toISOString(),
    actor,
    action: "create_fact",
    target_type: "fact",
    target_id: String(newId),
    before: null,
    after: record,
    note: `Created manual fact #${newId}`,
  });

  return record;
}

// ── Knowledge Layer: Admin Graph API ────────────────────────────────────────

export async function localGetAdminGraph(filter?: {
  focus?: string;
  depth?: number;
  types?: string[];
  includeProposed?: boolean;
}): Promise<GraphApiResponse> {
  const store = loadLocalStore();
  const allNodes = Object.values(store.kg_nodes || {});
  const allEdges = store.kg_edges || [];

  const degrees = new Map<string, number>();
  for (const e of allEdges) {
    if (e.status === "rejected") continue;
    degrees.set(e.src, (degrees.get(e.src) || 0) + 1);
    degrees.set(e.dst, (degrees.get(e.dst) || 0) + 1);
  }

  let filteredNodes: typeof allNodes = [];
  let filteredEdges: typeof allEdges = [];
  let isCapped = false;

  if (filter?.focus) {
    const depth = Math.min(Math.max(filter.depth || 1, 1), 3);
    let focusId = filter.focus;
    if (!allNodes.some((n) => n.id === focusId)) {
      const candidate = allNodes.find(
        (n) =>
          n.id.toLowerCase() === focusId.toLowerCase() ||
          n.id.toLowerCase() === `std:${focusId.toLowerCase()}` ||
          n.label.toLowerCase() === focusId.toLowerCase()
      );
      if (candidate) focusId = candidate.id;
    }
    const visited = new Set<string>([focusId]);
    const edgesMatched: typeof allEdges = [];

    let currentLevel = new Set<string>([focusId]);
    for (let d = 0; d < depth; d++) {
      const nextLevel = new Set<string>();
      for (const e of allEdges) {
        if (e.status === "rejected") continue;
        if (e.status === "proposed" && !filter.includeProposed) continue;

        if (currentLevel.has(e.src)) {
          visited.add(e.dst);
          nextLevel.add(e.dst);
          if (!edgesMatched.includes(e)) edgesMatched.push(e);
        } else if (currentLevel.has(e.dst)) {
          visited.add(e.src);
          nextLevel.add(e.src);
          if (!edgesMatched.includes(e)) edgesMatched.push(e);
        }
      }
      currentLevel = nextLevel;
    }

    filteredNodes = allNodes.filter((n) => visited.has(n.id));
    filteredEdges = edgesMatched;
  } else {
    // Global graph: exclude Chunk and DocVersion to stay clean and fast
    filteredNodes = allNodes.filter((n) => n.type !== "Chunk" && n.type !== "DocVersion");

    if (filter?.types && filter.types.length > 0) {
      const typeSet = new Set(filter.types);
      filteredNodes = filteredNodes.filter((n) => typeSet.has(n.type));
    }

    if (filteredNodes.length > 1500) {
      isCapped = true;
      filteredNodes.sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0));
      filteredNodes = filteredNodes.slice(0, 1500);
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = allEdges.filter((e) => {
      if (e.status === "rejected") return false;
      if (!filter?.includeProposed && e.status !== "approved") return false;
      return nodeIds.has(e.src) && nodeIds.has(e.dst);
    });
  }

  const nodes: GraphApiNode[] = filteredNodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    degree: degrees.get(n.id) || 0,
    props: n.props,
  }));

  const links: GraphApiLink[] = filteredEdges.map((e) => ({
    source: e.src,
    target: e.dst,
    type: e.type,
    status: e.status,
    source_url: e.source_url,
  }));

  return {
    nodes,
    links,
    totalNodesInStore: allNodes.length,
    totalEdgesInStore: allEdges.length,
    isCapped,
  };
}



