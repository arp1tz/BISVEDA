/**
 * BISVEDA — Runtime knowledge-base types.
 *
 * These mirror the on-disk shapes written by `scripts/kb/*.ts` and
 * `scripts/directory/*.ts` (see prototype/scripts/kb/types.ts and
 * prototype/scripts/directory/types.ts for the build-time source of truth).
 * Duplicated here rather than imported, because `scripts/` is outside the
 * Next.js build's tsconfig project.
 */

export type Domain = "helmets" | "toys" | "gold" | "forms";

export interface KbChunk {
  chunk_id: string;
  doc_id: string;
  standard_id: string;
  clause: string;
  clause_title: string;
  breadcrumb: string[];
  page_start: number;
  page_end: number;
  text: string;
  tokens: number;
  sha256: string;
  embedding: number[] | null;
}

export interface KbStandard {
  id: string;
  title: string;
  year?: number;
  domain: Domain;
  scope_text: string;
  doc_id: string;
  chunk_count: number;
}

export type GraphNodeType = "domain" | "standard" | "clause" | "reference" | "form" | "lab" | "ahc_region";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  props?: Record<string, unknown>;
}

export type GraphEdgeType = "IN_DOMAIN" | "HAS_CLAUSE" | "REFERENCES" | "TESTS" | "FORM_FOR" | "HALLMARKS";

export interface GraphEdge {
  src: string;
  dst: string;
  type: GraphEdgeType;
  weight?: number;
  source: string;
}

export interface KbGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LabScopeEntry {
  standard_id: string;
  is_number_raw: string;
  product: string;
  grade: string;
  charges?: string;
  validity_raw?: string;
  remark?: string;
}

export interface LabRecord {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  geocode: "city-centroid" | "none";
  current_status?: string;
  recognition_valid_upto?: string;
  standards_in_scope: string[];
  scope: LabScopeEntry[];
  source_url: string;
  retrieved_at: string;
}

export interface AhcRecord {
  recognition_no: string;
  name: string;
  address?: string;
  district?: string;
  state?: string;
  pin?: string;
  metals?: string;
  contact?: string;
  status: string;
  validity?: string;
  lat: number | null;
  lng: number | null;
  geocode: "district" | "none";
  source_url: string;
  retrieved_at: string;
}
