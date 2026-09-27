/**
 * BISVEDA V9 — Knowledge Layer Types
 */

export interface StandardRecord {
  id: string;              // e.g. "IS 4151" or "IS 9873 (Part 1)"
  is_number_norm: string;  // e.g. "IS4151", "IS9873P1"
  year?: number;
  title: string;
  title_hi?: string;
  status: "current" | "superseded" | "withdrawn";
  scope_text?: string;
  product_group?: string;
  committee?: string;
  source_url: string;
  knowledge_tier: "catalogue" | "full_text";
  embedding?: number[];
  updated_at?: string;
  verification_status?: "verified" | "demo";
}

export interface QcoRecord {
  id: string;
  title: string;
  ministry?: string;
  notified_on?: string;
  effective_on?: string;
  status: "in_force" | "notified_not_in_force" | "withdrawn";
  source_url: string;
  verification_status?: "verified" | "demo";
}

export interface SchemeRecord {
  id: string;              // e.g. "scheme-1", "scheme-2"
  name: string;            // e.g. "Scheme I (ISI Mark)"
  summary?: string;
  steps: Array<{ text: string; source: string }>;
  source_url: string;
  verification_status?: "verified" | "demo";
}

export interface LabRecord {
  id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  pin?: string;
  lat?: number;
  lng?: number;
  geocode_quality: "exact" | "pin_centroid" | "none";
  recognition?: string;
  valid_until?: string;
  detail_url?: string;
  source_url: string;
  verification_status?: "verified" | "demo";
}

export interface FactRecord {
  id: number;
  subject_id: string;      // e.g. "std:IS 4151"
  predicate: string;       // e.g. "mandated_by", "fee_concession_msme"
  object_id?: string | null;
  value?: string | null;
  source_chunk_id?: number | null;
  source_url: string;
  status: "proposed" | "approved" | "rejected";
  created_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  note?: string;
  created_at?: string;
}

export interface DocumentVersionRecord {
  id: number;
  document_id: string;
  version_no: number;
  sha256: string;
  storage_key?: string | null;
  status: "draft" | "in_review" | "published" | "archived";
  change_note?: string;
  created_by: string;
  created_at?: string;
  published_by?: string;
  published_at?: string;
}

export interface KgNode {
  id: string;
  type: "Standard" | "Clause" | "QCO" | "Scheme" | "Lab" | "ProductGroup" | "Product" | "Committee" | "Document" | "DocVersion" | "Chunk";
  label: string;
  props?: Record<string, any>;
}

export interface KgEdge {
  id?: number;
  src: string;
  dst: string;
  type:
    | "MANDATES"
    | "CERTIFIED_UNDER"
    | "ACCREDITED_FOR"
    | "COVERS"
    | "IS_A"
    | "MAINTAINS"
    | "SUPERSEDES"
    | "REFERENCES"
    | "HAS_VERSION"
    | "DOCUMENTS"
    | "HAS_CHUNK"
    | "HAS_CLAUSE";
  fact_id?: number;
  source_url?: string;
  status: "proposed" | "approved" | "rejected";
}

export interface AuditLogRecord {
  id: number;
  at: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  note?: string;
}

export interface VersionImpactResult {
  versionId: number;
  documentId: string;
  currentStatus: string;
  searchableChunksDelta: number;
  totalChunks: number;
  affectedFactsCount: number;
  affectedEdgesCount: number;
  orphanedEdgesCount: number;
}

export interface ChunkDiffItem {
  clause_id: string;
  page?: number;
  title?: string;
  textA?: string;
  textB?: string;
  diffStatus: "added" | "removed" | "changed" | "unchanged";
  wordDiff?: Array<{ value: string; added?: boolean; removed?: boolean }>;
}

export interface VersionDiffResult {
  versionA: DocumentVersionRecord;
  versionB: DocumentVersionRecord;
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  chunks: ChunkDiffItem[];
}

export interface GraphApiNode {
  id: string;
  type: string;
  label: string;
  degree?: number;
  status?: string;
  props?: Record<string, any>;
}

export interface GraphApiLink {
  source: string;
  target: string;
  type: string;
  status: string;
  source_url?: string;
}

export interface GraphApiResponse {
  nodes: GraphApiNode[];
  links: GraphApiLink[];
  totalNodesInStore: number;
  totalEdgesInStore: number;
  isCapped: boolean;
}

