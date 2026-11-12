-- BIS VEDA schema v1 (ARCHITECTURE.md §4). Applied by scripts/db/migrate.ts inside one transaction.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── People (first: document_versions references it) ──────────────────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,                       -- scrypt
  role          text NOT NULL CHECK (role IN ('staff','officer','admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Identity of a standard / form across editions ───────────────────────────
CREATE TABLE documents (
  id          text PRIMARY KEY,                      -- 'IS 4151', 'IS 9873 (Part 1)', 'FORM-I'
  legacy_doc_id text UNIQUE,                         -- 'is-4151' (data/kb/docs.json; /api/docs/{id} links)
  doc_type    text NOT NULL CHECK (doc_type IN ('standard','form','guideline')),
  base_number text,
  part        text,
  title       text NOT NULL,
  domain      text NOT NULL,
  scope_text  text,                                  -- standards.json scope_text (adjudication / admin)
  display_order int NOT NULL DEFAULT 0,              -- listing order (registry order)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_id_trgm ON documents USING gin (id gin_trgm_ops);

-- ── One uploaded file = one version (edition or amendment) ──────────────────
CREATE TABLE document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     text NOT NULL REFERENCES documents(id),
  kind            text NOT NULL CHECK (kind IN ('edition','amendment')),
  base_version_id uuid REFERENCES document_versions(id),
  edition_label   text,
  edition_year    int,
  amendment_no    int,
  status          text NOT NULL CHECK (status IN
                    ('uploaded','processing','failed','staged','published','superseded','rejected')),
  file_sha256     text NOT NULL UNIQUE,
  file_path       text NOT NULL,
  file_name       text NOT NULL,
  file_bytes      bigint NOT NULL,
  page_count      int,
  ocr_page_count  int,
  parse_quality   real,
  source_url      text,
  extracted_meta  jsonb,
  uploaded_by     uuid REFERENCES users(id),
  approved_by     uuid REFERENCES users(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  superseded_at   timestamptz,
  embed_model     text,
  CHECK (kind = 'edition' OR base_version_id IS NOT NULL)
);
CREATE UNIQUE INDEX one_published_edition ON document_versions(document_id)
  WHERE status = 'published' AND kind = 'edition';
CREATE INDEX document_versions_doc ON document_versions(document_id);

-- ── Clause tree ─────────────────────────────────────────────────────────────
CREATE TABLE clauses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES clauses(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('root','front_matter','clause','annex','table','figure','note')),
  number      text,
  title       text,
  path        text NOT NULL,
  ord         int NOT NULL,
  depth       int NOT NULL,
  page_start  int NOT NULL,
  page_end    int NOT NULL,
  text        text NOT NULL,
  amended_by  uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (version_id, ord)
);
CREATE INDEX clauses_version_number ON clauses(version_id, number);
CREATE INDEX clauses_parent ON clauses(parent_id);

-- ── Retrieval units ─────────────────────────────────────────────────────────
CREATE TABLE chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id   text,                                  -- chunk_id from data/kb/chunks.json (NOT unique there: 22 ids collide, TD-23)
  version_id  uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  clause_id   uuid NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
  seq         int NOT NULL,                          -- global order (import) / order within the clause (R2)
  page_start  int NOT NULL,
  page_end    int NOT NULL,
  text        text NOT NULL,
  embed_text  text NOT NULL,
  tokens      int NOT NULL,
  sha256      text NOT NULL,
  embedding   vector(1024) NOT NULL,
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', embed_text)) STORED
);
CREATE INDEX chunks_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX chunks_tsv ON chunks USING gin (tsv);
CREATE INDEX chunks_version ON chunks(version_id);
CREATE INDEX chunks_clause ON chunks(clause_id);
CREATE INDEX chunks_legacy ON chunks(legacy_id);

-- ── Graph ───────────────────────────────────────────────────────────────────
CREATE TABLE edges (
  id         bigserial PRIMARY KEY,
  src_kind   text NOT NULL,
  src_id     text NOT NULL,
  dst_kind   text NOT NULL,
  dst_id     text NOT NULL,
  type       text NOT NULL CHECK (type IN
               ('CROSS_REF','CITES_TABLE','REFERENCES_STANDARD','REFERENCES','AMENDS','TESTS','HALLMARKS','IN_DOMAIN','FORM_FOR','HAS_CLAUSE')),
  version_id uuid REFERENCES document_versions(id) ON DELETE CASCADE,
  weight     real,
  evidence   text
);
CREATE INDEX edges_src ON edges(src_kind, src_id);
CREATE INDEX edges_dst ON edges(dst_kind, dst_id);

-- Graph nodes that are not documents/clauses/labs (domains, reference targets, AHC regions)
-- are kept verbatim so the admin explorer renders exactly what graph.json held.
CREATE TABLE graph_nodes (
  id    text PRIMARY KEY,
  ord   int NOT NULL,
  type  text NOT NULL,
  label text NOT NULL,
  props jsonb
);

-- ── Directories ─────────────────────────────────────────────────────────────
CREATE TABLE labs (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  city          text,
  state         text,
  lat           double precision,
  lng           double precision,
  geocode       text NOT NULL,
  status        text,
  valid_upto    text,
  standards_in_scope text[] NOT NULL DEFAULT '{}',
  scope         jsonb NOT NULL,
  source_url    text NOT NULL,
  retrieved_at  timestamptz NOT NULL,
  ord           int NOT NULL
);
CREATE TABLE ahcs (
  recognition_no text PRIMARY KEY,
  name           text NOT NULL,
  address        text,
  district       text,
  state          text,
  pin            text,
  metals         text,
  contact        text,
  status         text NOT NULL,
  validity       text,
  lat            double precision,
  lng            double precision,
  geocode        text NOT NULL,
  source_url     text NOT NULL,
  retrieved_at   timestamptz NOT NULL,
  ord            int NOT NULL
);

-- ── Jobs ────────────────────────────────────────────────────────────────────
CREATE TABLE ingestion_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('ingest','reprocess','reembed')),
  state        text NOT NULL CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
  step         text,
  progress     jsonb NOT NULL DEFAULT '{}',
  attempts     int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  error        text,
  lease_until  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX jobs_claim ON ingestion_jobs(state, created_at) WHERE state = 'queued';
CREATE TABLE job_logs (
  id      bigserial PRIMARY KEY,
  job_id  uuid NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  at      timestamptz NOT NULL DEFAULT now(),
  level   text NOT NULL,
  step    text,
  message text NOT NULL,
  data    jsonb
);
CREATE INDEX job_logs_job ON job_logs(job_id, id);

-- ── Audit, index freshness ──────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES users(id),
  action      text NOT NULL,
  target_kind text,
  target_id   text,
  before      jsonb,
  after       jsonb
);
CREATE TABLE index_state (
  id         int PRIMARY KEY CHECK (id = 1),
  version    bigint NOT NULL,
  changed_at timestamptz NOT NULL
);
INSERT INTO index_state VALUES (1, 1, now());

-- ── Searchable set: chunks of published editions + published amendments of published editions ──
CREATE VIEW searchable_chunks AS
SELECT c.*, v.document_id, v.edition_label, v.edition_year, v.kind AS version_kind
FROM chunks c
JOIN document_versions v ON v.id = c.version_id
WHERE v.status = 'published'
  AND (v.kind = 'edition'
       OR EXISTS (SELECT 1 FROM document_versions b WHERE b.id = v.base_version_id AND b.status = 'published'));
