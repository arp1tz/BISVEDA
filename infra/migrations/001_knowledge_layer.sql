-- BISVEDA V9 Migration 001: Knowledge Layer Schema
-- Sets up Facts DB, Document Versions, Knowledge Graph (kg_nodes, kg_edges), and weighted search indexes.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Standards Table
CREATE TABLE IF NOT EXISTS standards (
  id             TEXT PRIMARY KEY,
  is_number_norm TEXT NOT NULL UNIQUE,
  year           INT,
  title          TEXT NOT NULL,
  title_hi       TEXT,
  status         TEXT NOT NULL DEFAULT 'current',
  scope_text     TEXT,
  product_group  TEXT,
  committee      TEXT,
  source_url     TEXT NOT NULL,
  knowledge_tier TEXT NOT NULL DEFAULT 'catalogue',
  embedding      vector(768),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Quality Control Orders (QCOs)
CREATE TABLE IF NOT EXISTS qcos (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  ministry     TEXT,
  notified_on  DATE,
  effective_on DATE,
  status       TEXT NOT NULL DEFAULT 'in_force',
  source_url   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qco_standards (
  qco_id      TEXT REFERENCES qcos(id) ON DELETE CASCADE,
  standard_id TEXT REFERENCES standards(id) ON DELETE CASCADE,
  PRIMARY KEY (qco_id, standard_id)
);

-- 3. Certification Schemes
CREATE TABLE IF NOT EXISTS schemes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  summary    TEXT,
  steps      JSONB,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS standard_schemes (
  standard_id TEXT REFERENCES standards(id) ON DELETE CASCADE,
  scheme_id   TEXT REFERENCES schemes(id) ON DELETE CASCADE,
  source_url  TEXT,
  PRIMARY KEY (standard_id, scheme_id)
);

-- 4. Testing Laboratories
CREATE TABLE IF NOT EXISTS labs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  pin             TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  geocode_quality TEXT DEFAULT 'none',
  recognition     TEXT,
  valid_until     DATE,
  detail_url      TEXT,
  source_url      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_scopes (
  lab_id      TEXT REFERENCES labs(id) ON DELETE CASCADE,
  standard_id TEXT REFERENCES standards(id) ON DELETE CASCADE,
  source_url  TEXT,
  PRIMARY KEY (lab_id, standard_id)
);

-- 5. FAQ Entries
CREATE TABLE IF NOT EXISTS faq_entries (
  id         TEXT PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  lang       TEXT DEFAULT 'en',
  source_url TEXT NOT NULL,
  embedding  vector(768)
);

-- 6. Facts (Atomic, Staff-Controlled Truth Boundaries)
CREATE TABLE IF NOT EXISTS facts (
  id              BIGSERIAL PRIMARY KEY,
  subject_id      TEXT NOT NULL,
  predicate       TEXT NOT NULL,
  object_id       TEXT,
  value           TEXT,
  source_chunk_id BIGINT,
  source_url      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed',
  created_by      TEXT NOT NULL,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 7. Document Versions (Git for PDFs)
CREATE TABLE IF NOT EXISTS document_versions (
  id           BIGSERIAL PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no   INT NOT NULL,
  sha256       TEXT NOT NULL,
  storage_key  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  change_note  TEXT,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  published_by TEXT,
  published_at TIMESTAMPTZ,
  UNIQUE (document_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_published_per_doc 
ON document_versions(document_id) 
WHERE status = 'published';

-- 8. Enhance Chunks with version FK and weighted tsv
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS doc_version_id BIGINT REFERENCES document_versions(id);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS clause_id TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS page INT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS tsv tsvector;

-- 9. Knowledge Graph Nodes and Edges
CREATE TABLE IF NOT EXISTS kg_nodes (
  id    TEXT PRIMARY KEY,
  type  TEXT NOT NULL,
  label TEXT NOT NULL,
  props JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id         BIGSERIAL PRIMARY KEY,
  src        TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  dst        TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  fact_id    BIGINT REFERENCES facts(id) ON DELETE SET NULL,
  source_url TEXT,
  status     TEXT NOT NULL DEFAULT 'approved',
  UNIQUE (src, dst, type)
);

CREATE INDEX IF NOT EXISTS kg_edges_src ON kg_edges(src);
CREATE INDEX IF NOT EXISTS kg_edges_dst ON kg_edges(dst);

-- 10. Audit Log for Knowledge Console
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ DEFAULT now(),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  before      JSONB,
  after       JSONB,
  note        TEXT
);

-- 11. Search Indexes
CREATE INDEX IF NOT EXISTS chunks_tsv_gin ON chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS standards_title_trgm ON standards USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS standards_embedding_hnsw ON standards USING hnsw (embedding vector_cosine_ops);
