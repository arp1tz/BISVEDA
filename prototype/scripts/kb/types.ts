/**
 * BISVEDA — Knowledge Base build types (scripts/kb/)
 *
 * These are the on-disk shapes of everything `npm run kb:build` produces
 * under `prototype/data/kb/`. `src/lib/kb/store.ts` (P2.1) loads these at
 * runtime; keep them in sync.
 */

export type Domain = "helmets" | "toys" | "gold" | "forms";

/** One entry in the source registry (scripts/kb/sources.ts). */
export interface SourceDoc {
  doc_id: string;
  /** Canonical standard id, e.g. "IS 4151", "IS 9873 (Part 1)". "FORM-I" for the Form I template. */
  standard_id: string;
  title: string;
  year?: number;
  domain: Domain;
  /** Filename inside "example docs uploaded by employees/" */
  file: string;
  source_url?: string;
}

/** A source that was deliberately excluded (e.g. a duplicate scan). */
export interface ExcludedDoc {
  file: string;
  reason: string;
}

/** Raw parser output for one page (mirrors parse_pdf.py's ParsedPage). */
export interface RawPage {
  pageNumber: number;
  text: string;
  charCount: number;
  headings: string[];
  tables: string[][];
  isOcr: boolean;
  ocrQuality?: number;
}

/** Raw parser output for one document, saved to data/kb/raw/{doc_id}.json */
export interface RawDoc {
  doc_id: string;
  totalPages: number;
  totalChars: number;
  detectedStandardNumber?: string | null;
  detectedTitle?: string | null;
  editionYear?: string | null;
  isOcrDoc: boolean;
  ocrPagesCount?: number;
  meanOcrQuality: number;
  pages: RawPage[];
  /** Page numbers stripped as boilerplate (RTI notice, blank-page stamp, back-cover text). */
  strippedPages: number[];
}

/** One knowledge-base chunk (data/kb/chunks.json). */
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

/** One standard record (data/kb/standards.json). */
export interface KbStandard {
  id: string; // standard_id
  title: string;
  year?: number;
  domain: Domain;
  scope_text: string;
  doc_id: string;
  chunk_count: number;
}

export type GraphNodeType =
  | "domain"
  | "standard"
  | "clause"
  | "reference"
  | "form"
  | "lab"
  | "ahc_region";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  props?: Record<string, unknown>;
}

export type GraphEdgeType =
  | "IN_DOMAIN"
  | "HAS_CLAUSE"
  | "REFERENCES"
  | "TESTS"
  | "FORM_FOR"
  | "HALLMARKS";

export interface GraphEdge {
  src: string;
  dst: string;
  type: GraphEdgeType;
  weight?: number;
  source: string; // "doc_id p.N" or a directory source_url
}

export interface KbGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
