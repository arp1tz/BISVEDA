-- BISVEDA V8 PostgreSQL + pgvector Schema

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    standard_number TEXT,
    title TEXT,
    page_count INT DEFAULT 1,
    knowledge_tier VARCHAR(10) DEFAULT 'B',
    verification_status VARCHAR(20) DEFAULT 'verified',
    authenticity_outcome VARCHAR(30) DEFAULT 'VERIFIED',
    minio_path TEXT,
    source_url TEXT,
    uploaded_by TEXT DEFAULT 'officer',
    status VARCHAR(30) DEFAULT 'published',
    edition_year TEXT,
    superseded_by TEXT,
    supersedes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks Table with 768-dim Vector Embeddings
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    job_id TEXT,
    standard_number TEXT,
    clause_number TEXT,
    clause_title TEXT,
    breadcrumb JSONB DEFAULT '[]'::jsonb,
    page_numbers INT[] DEFAULT '{}',
    text TEXT NOT NULL,
    token_count INT DEFAULT 0,
    sha256 TEXT NOT NULL,
    knowledge_tier VARCHAR(10) DEFAULT 'B',
    verification_status VARCHAR(20) DEFAULT 'verified',
    embedding vector(768),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion Jobs Table
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id TEXT PRIMARY KEY,
    document_id TEXT,
    status VARCHAR(30) NOT NULL,
    filename TEXT NOT NULL,
    standard_number TEXT,
    page_count INT DEFAULT 0,
    chunk_count INT DEFAULT 0,
    events JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256);
CREATE INDEX IF NOT EXISTS idx_documents_standard ON documents(standard_number);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_standard ON chunks(standard_number);
CREATE INDEX IF NOT EXISTS idx_chunks_is_active ON chunks(is_active);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING gin (to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_chunks_trgm ON chunks USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
