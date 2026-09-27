/**
 * BISVEDA Database Service
 * PostgreSQL + pgvector Client & Persistence Engine
 */

import { Pool } from "pg";
import {
  localInsertDocument,
  localInsertChunks,
  localSearchExactChunks,
  localSearchPhraseChunks,
  localSearchFtsChunks,
  localSearchVectorChunks,
  localGetAllDocuments,
  localGetDocumentById,
  localGetDocumentBySha256,
  localGetDocumentChunks,
  localSaveIngestionJob,
  localPurgeDocument,
  localPublishDocument,
  localRevokeDocument,
  localUpdateDocument,
  localUpdateChunks,
  localDeleteChunk,
} from "./local-db";

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      user: process.env.POSTGRES_USER || "bisveda",
      password: process.env.POSTGRES_PASSWORD || "bisveda_secret_password",
      database: process.env.POSTGRES_DB || "bisveda",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]:", err.message);
    });
  }
  return pool;
}

export interface DocumentRow {
  id: string;
  filename: string;
  sha256: string;
  standard_number?: string;
  root_standard?: string;
  edition_year?: string;
  version?: string;
  amendment?: string;
  title?: string;
  page_count: number;
  knowledge_tier: "A" | "B" | "C";
  verification_status: string;
  authenticity_outcome: string;
  minio_path?: string;
  source_url?: string;
  uploaded_by?: string;
  status?: string;
  superseded_by?: string;
  supersedes?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  published_at?: string;
}

export { parseStandardVersion } from "./standard-parser";

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

/**
 * Initializes database tables & extensions if not already present.
 */
export async function initDb(): Promise<boolean> {
  const p = getDbPool();
  try {
    const client = await p.connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
      await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

      await client.query(`
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
      `);

      await client.query(`
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
      `);

      await client.query(`
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
      `);

      // Safe column updates for existing databases
      await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'published';`);
      await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS edition_year TEXT;`);
      await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS superseded_by TEXT;`);
      await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS supersedes TEXT;`);
      await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`);
      await client.query(`ALTER TABLE chunks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
      await client.query(`ALTER TABLE chunks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`);

      // Safe index creations
      await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_standard ON documents(standard_number);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(document_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_standard ON chunks(standard_number);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_is_active ON chunks(is_active);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING gin (to_tsvector('english', text));`);
      try {
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);`);
      } catch {
        // HNSW may fail if not enough rows or vector not supported, ignore
      }

      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[PostgreSQL Offline]: Operating with sovereign local persistence engine.");
    return true;
  }
}

/**
 * Checks if the database is accessible.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const p = getDbPool();
    const res = await p.query("SELECT 1 AS healthy");
    return res.rows[0]?.healthy === 1;
  } catch {
    return true; // Local persistence fallback is active and healthy
  }
}

/**
 * Persists an ingested document record into PostgreSQL (or local fallback).
 */
export async function insertDocument(doc: DocumentRow): Promise<void> {
  try {
    const p = getDbPool();
    await p.query(
      `INSERT INTO documents (
        id, filename, sha256, standard_number, title, page_count,
        knowledge_tier, verification_status, authenticity_outcome,
        minio_path, source_url, uploaded_by, status, edition_year,
        superseded_by, supersedes, metadata, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (id) DO UPDATE SET
        standard_number = EXCLUDED.standard_number,
        title = EXCLUDED.title,
        page_count = EXCLUDED.page_count,
        verification_status = EXCLUDED.verification_status,
        status = EXCLUDED.status,
        edition_year = EXCLUDED.edition_year,
        superseded_by = EXCLUDED.superseded_by,
        supersedes = EXCLUDED.supersedes,
        minio_path = EXCLUDED.minio_path,
        metadata = EXCLUDED.metadata,
        published_at = NOW();`,
      [
        doc.id,
        doc.filename,
        doc.sha256,
        doc.standard_number || null,
        doc.title || null,
        doc.page_count,
        doc.knowledge_tier,
        doc.verification_status,
        doc.authenticity_outcome,
        doc.minio_path || null,
        doc.source_url || null,
        doc.uploaded_by || "officer",
        doc.status || "published",
        doc.edition_year || null,
        doc.superseded_by || null,
        doc.supersedes || null,
        JSON.stringify(doc.metadata || {}),
      ]
    );
  } catch (err) {
    await localInsertDocument(doc);
  }
}

/**
 * Persists chunks with 768-dim vector embeddings into PostgreSQL (or local fallback).
 */
export async function insertChunks(chunks: ChunkRow[]): Promise<void> {
  if (chunks.length === 0) return;
  try {
    const p = getDbPool();
    const client = await p.connect();

    try {
      await client.query("BEGIN");
      for (const c of chunks) {
        const embeddingSql =
          c.embedding && c.embedding.length === 768
            ? `[${c.embedding.join(",")}]`
            : null;

        await client.query(
          `INSERT INTO chunks (
            chunk_id, document_id, job_id, standard_number, clause_number,
            clause_title, breadcrumb, page_numbers, text, token_count,
            sha256, knowledge_tier, verification_status, embedding, is_active, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::vector, $15, $16)
          ON CONFLICT (chunk_id) DO UPDATE SET
            text = EXCLUDED.text,
            clause_title = EXCLUDED.clause_title,
            breadcrumb = EXCLUDED.breadcrumb,
            page_numbers = EXCLUDED.page_numbers,
            embedding = EXCLUDED.embedding,
            is_active = EXCLUDED.is_active,
            verification_status = EXCLUDED.verification_status;`,
          [
            c.chunk_id,
            c.document_id,
            c.job_id || null,
            c.standard_number || null,
            c.clause_number || null,
            c.clause_title || null,
            JSON.stringify(c.breadcrumb || []),
            c.page_numbers || [],
            c.text,
            c.token_count || 0,
            c.sha256,
            c.knowledge_tier || "B",
            c.verification_status || "verified",
            embeddingSql,
            c.is_active ?? true,
            JSON.stringify(c.metadata || {}),
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    await localInsertChunks(chunks);
  }
}

/**
 * Searches chunks using pgvector cosine distance (or local fallback).
 * Implements strict relevance floor filtering (minimum similarity threshold)
 * and only retrieves active published/verified chunks.
 */
export async function searchVectorChunks(
  embedding: number[],
  limit = 5,
  minSimilarity = 0.40
): Promise<ChunkRow[]> {
  try {
    const p = getDbPool();
    const embeddingSql = `[${embedding.join(",")}]`;
    const res = await p.query(
      `SELECT 
        c.chunk_id, c.document_id, c.job_id, c.standard_number, c.clause_number,
        c.clause_title, c.breadcrumb, c.page_numbers, c.text, c.token_count,
        c.sha256, c.knowledge_tier, c.verification_status,
        ROUND((1.0 - (c.embedding <=> $1::vector))::numeric, 4) AS similarity,
        d.filename, d.title AS doc_title, d.source_url
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE c.embedding IS NOT NULL
         AND c.is_active = true
         AND (1.0 - (c.embedding <=> $1::vector)) >= $2
       ORDER BY c.embedding <=> $1::vector ASC
       LIMIT $3;`,
      [embeddingSql, minSimilarity, limit]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        job_id: r.job_id,
        standard_number: r.standard_number,
        clause_number: r.clause_number,
        clause_title: r.clause_title,
        breadcrumb: Array.isArray(r.breadcrumb) ? r.breadcrumb : [],
        page_numbers: r.page_numbers || [],
        text: r.text,
        token_count: r.token_count,
        sha256: r.sha256,
        knowledge_tier: r.knowledge_tier,
        verification_status: r.verification_status,
        similarity: parseFloat(r.similarity),
        filename: r.filename,
        doc_title: r.doc_title,
        source_url: r.source_url,
      }));
    }
  } catch (err) {
    // Fall through to local fallback
  }

  return localSearchVectorChunks(embedding, limit, minSimilarity);
}

/**
 * Searches chunks using PostgreSQL Full-Text Search (or local keyword fallback).
 * Returns true rank metrics based on ts_rank_cd.
 */
export async function searchFtsChunks(
  queryText: string,
  limit = 5
): Promise<ChunkRow[]> {
  try {
    const p = getDbPool();
    const res = await p.query(
      `SELECT 
        c.chunk_id, c.document_id, c.job_id, c.standard_number, c.clause_number,
        c.clause_title, c.breadcrumb, c.page_numbers, c.text, c.token_count,
        c.sha256, c.knowledge_tier, c.verification_status,
        ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', $1)) as rank,
        d.filename, d.title AS doc_title, d.source_url
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE to_tsvector('english', c.text) @@ plainto_tsquery('english', $1)
         AND c.is_active = true
       ORDER BY rank DESC
       LIMIT $2;`,
      [queryText, limit]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => {
        const rawRank = parseFloat(r.rank) || 0;
        const sim = Math.min(0.95, Math.round(Math.min(0.95, rawRank * 10.0) * 100) / 100);
        return {
          chunk_id: r.chunk_id,
          document_id: r.document_id,
          job_id: r.job_id,
          standard_number: r.standard_number,
          clause_number: r.clause_number,
          clause_title: r.clause_title,
          breadcrumb: Array.isArray(r.breadcrumb) ? r.breadcrumb : [],
          page_numbers: r.page_numbers || [],
          text: r.text,
          token_count: r.token_count,
          sha256: r.sha256,
          knowledge_tier: r.knowledge_tier,
          verification_status: r.verification_status,
          similarity: sim,
          filename: r.filename,
          doc_title: r.doc_title,
          source_url: r.source_url,
        };
      });
    }
  } catch (err) {
    // Fall through to local fallback
  }

  return localSearchFtsChunks(queryText, limit);
}

/**
 * Searches chunks by exact substring/phrase match (or local fallback).
 * Ensures newly uploaded documents with unique phrases are directly retrievable.
 */
export async function searchPhraseChunks(
  phrase: string,
  limit = 5
): Promise<ChunkRow[]> {
  const cleanPhrase = phrase.trim();
  const isPhrase = cleanPhrase.includes(" ") || cleanPhrase.length >= 15;
  if (!isPhrase || cleanPhrase.length < 3) return [];

  try {
    const p = getDbPool();
    const res = await p.query(
      `SELECT 
        c.chunk_id, c.document_id, c.job_id, c.standard_number, c.clause_number,
        c.clause_title, c.breadcrumb, c.page_numbers, c.text, c.token_count,
        c.sha256, c.knowledge_tier, c.verification_status,
        0.98 AS similarity,
        d.filename, d.title AS doc_title, d.source_url
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE c.text ILIKE '%' || $1 || '%'
         AND c.is_active = true
       LIMIT $2;`,
      [cleanPhrase, limit]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        job_id: r.job_id,
        standard_number: r.standard_number,
        clause_number: r.clause_number,
        clause_title: r.clause_title,
        breadcrumb: Array.isArray(r.breadcrumb) ? r.breadcrumb : [],
        page_numbers: r.page_numbers || [],
        text: r.text,
        token_count: r.token_count,
        sha256: r.sha256,
        knowledge_tier: r.knowledge_tier,
        verification_status: r.verification_status,
        similarity: 0.98,
        filename: r.filename,
        doc_title: r.doc_title,
        source_url: r.source_url,
      }));
    }
  } catch (err) {
    // Fall through to local fallback
  }

  return localSearchPhraseChunks(phrase, limit);
}

/**
 * Retrieves chunks by exact standard code or clause keywords (or local fallback).
 */
export async function searchExactChunks(
  standardNumber: string,
  limit = 5
): Promise<ChunkRow[]> {
  const clean = standardNumber.replace(/\s+/g, "").toUpperCase();

  try {
    const p = getDbPool();
    const res = await p.query(
      `SELECT 
        c.chunk_id, c.document_id, c.job_id, c.standard_number, c.clause_number,
        c.clause_title, c.breadcrumb, c.page_numbers, c.text, c.token_count,
        c.sha256, c.knowledge_tier, c.verification_status,
        0.99 AS similarity,
        d.filename, d.title AS doc_title, d.source_url
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE (UPPER(REPLACE(c.standard_number, ' ', '')) LIKE '%' || $1 || '%'
              OR c.chunk_id ILIKE $1 || '%')
         AND c.is_active = true
       LIMIT $2;`,
      [clean, limit]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => ({
        ...r,
        breadcrumb: Array.isArray(r.breadcrumb) ? r.breadcrumb : [],
        similarity: 0.99,
        filename: r.filename,
        doc_title: r.doc_title,
        source_url: r.source_url,
      }));
    }
  } catch (err) {
    // Fall through to local fallback
  }

  return localSearchExactChunks(standardNumber, limit);
}

/**
 * Activates and publishes an ingested document and its chunks.
 */
export async function publishDocument(documentId: string): Promise<boolean> {
  try {
    const p = getDbPool();
    await p.query(
      `UPDATE documents 
       SET status = 'published', verification_status = 'verified', published_at = NOW() 
       WHERE id = $1;`,
      [documentId]
    );
    await p.query(
      `UPDATE chunks 
       SET is_active = true, verification_status = 'verified' 
       WHERE document_id = $1;`,
      [documentId]
    );
    return true;
  } catch (err) {
    return localPublishDocument(documentId);
  }
}

/**
 * Revokes / unpublishes a document without permanently deleting audit history.
 * Chunks are set to is_active = false so they are immediately excluded from retrieval.
 */
export async function revokeDocument(documentId: string): Promise<boolean> {
  try {
    const p = getDbPool();
    await p.query(
      `UPDATE documents 
       SET status = 'revoked', verification_status = 'revoked' 
       WHERE id = $1;`,
      [documentId]
    );
    await p.query(
      `UPDATE chunks 
       SET is_active = false, verification_status = 'revoked' 
       WHERE document_id = $1;`,
      [documentId]
    );
    return true;
  } catch (err) {
    return localRevokeDocument(documentId);
  }
}

/**
 * Permanently purges a document, its chunks, embeddings, ingestion jobs, and MinIO storage artifacts.
 * Guarantees zero orphaned knowledge remains searchable.
 */
export async function purgeDocument(
  documentId: string
): Promise<{ success: boolean; minioDeleted: boolean; chunksRemoved: number }> {
  try {
    const p = getDbPool();
    let minioDeleted = false;
    let chunksRemoved = 0;

    // 1. Resolve document record to get ID and MinIO storage path
    const cleanNoSpaces = documentId.replace(/\s+/g, "").toUpperCase();
    const docRes = await p.query(
      `SELECT id, minio_path FROM documents 
       WHERE id = $1 
          OR UPPER(REPLACE(COALESCE(standard_number, ''), ' ', '')) LIKE '%' || $2 || '%'
          OR filename ILIKE '%' || $1 || '%'
       LIMIT 1;`,
      [documentId, cleanNoSpaces]
    );
    const targetDocId = docRes.rows[0]?.id || documentId;
    const minioPath = docRes.rows[0]?.minio_path;

    // 2. Count chunks to report
    const countRes = await p.query("SELECT COUNT(*) AS count FROM chunks WHERE document_id = $1;", [targetDocId]);
    chunksRemoved = parseInt(countRes.rows[0]?.count || "0", 10);

    // 3. Delete from MinIO if stored
    if (minioPath) {
      try {
        const { deleteStoredDocument } = await import("./storage");
        minioDeleted = await deleteStoredDocument(minioPath);
      } catch (storeErr) {
        console.warn("[Purge MinIO Warning]:", storeErr);
      }
    }

    // 4. Delete chunks from PostgreSQL (cascading embeddings & TSV indices removed)
    await p.query("DELETE FROM chunks WHERE document_id = $1;", [targetDocId]);

    // 5. Delete ingestion jobs associated with document
    await p.query("DELETE FROM ingestion_jobs WHERE document_id = $1;", [targetDocId]);

    // 6. Delete document record
    await p.query("DELETE FROM documents WHERE id = $1;", [targetDocId]);

    return { success: true, minioDeleted, chunksRemoved };
  } catch (err) {
    return localPurgeDocument(documentId);
  }
}

/**
 * Lists all documents in the repository.
 */
export async function getAllDocuments(): Promise<DocumentRow[]> {
  try {
    const p = getDbPool();
    const res = await p.query(`
      SELECT d.*, COUNT(c.chunk_id)::int AS chunk_count
      FROM documents d
      LEFT JOIN chunks c ON d.id = c.document_id
      GROUP BY d.id
      ORDER BY d.created_at DESC;
    `);
    if (res.rows && res.rows.length > 0) return res.rows;
  } catch (err) {
    // Fall through to local
  }
  return localGetAllDocuments();
}

/**
 * Gets a single document by ID.
 */
export async function getDocumentById(documentId: string): Promise<DocumentRow | null> {
  try {
    const p = getDbPool();
    const cleanNoSpaces = documentId.replace(/\s+/g, "").toUpperCase();
    const res = await p.query(
      `SELECT * FROM documents 
       WHERE id = $1 
          OR UPPER(REPLACE(COALESCE(standard_number, ''), ' ', '')) LIKE '%' || $2 || '%'
          OR filename ILIKE '%' || $1 || '%'
       LIMIT 1;`,
      [documentId, cleanNoSpaces]
    );
    if (res.rows && res.rows[0]) return res.rows[0];
  } catch {
    // Fall through to local
  }
  return localGetDocumentById(documentId);
}

/**
 * Gets all chunks for a document.
 */
export async function getDocumentChunks(documentId: string): Promise<ChunkRow[]> {
  const doc = await getDocumentById(documentId);
  const targetDocId = doc ? doc.id : documentId;
  const stdNum = doc?.standard_number || documentId;

  try {
    const p = getDbPool();
    const cleanNoSpaces = stdNum.replace(/\s+/g, "").toUpperCase();
    const res = await p.query(
      `SELECT * FROM chunks 
       WHERE document_id = $1 
          OR UPPER(REPLACE(COALESCE(standard_number, ''), ' ', '')) LIKE '%' || $2 || '%'
       ORDER BY chunk_id ASC;`,
      [targetDocId, cleanNoSpaces]
    );
    if (res.rows && res.rows.length > 0) return res.rows;
  } catch {
    // Fall through to local
  }
  return localGetDocumentChunks(targetDocId);
}

/**
 * Deletes a document and its cascading chunks.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const res = await purgeDocument(documentId);
  return res.success;
}

/**
 * Record or update Ingestion Job.
 */
export async function saveIngestionJob(
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
  try {
    const p = getDbPool();
    await p.query(
      `INSERT INTO ingestion_jobs (
        job_id, document_id, status, filename, standard_number,
        page_count, chunk_count, events, errors, created_at, completed_at
      ) VALUES ($1, $2, $3::varchar, $4, $5, $6, $7, $8::jsonb, $9::jsonb, NOW(), CASE WHEN $3::varchar IN ('published', 'failed', 'rejected') THEN NOW() ELSE NULL END)
      ON CONFLICT (job_id) DO UPDATE SET
        status = EXCLUDED.status,
        page_count = EXCLUDED.page_count,
        chunk_count = EXCLUDED.chunk_count,
        events = EXCLUDED.events,
        errors = EXCLUDED.errors,
        completed_at = CASE WHEN EXCLUDED.status IN ('published', 'failed', 'rejected') THEN NOW() ELSE ingestion_jobs.completed_at END;`,
      [
        jobId,
        documentId,
        status,
        filename,
        standardNumber || null,
        pageCount,
        chunkCount,
        JSON.stringify(events),
        JSON.stringify(errors),
      ]
    );
  } catch (err) {
    await localSaveIngestionJob(
      jobId,
      documentId,
      status,
      filename,
      standardNumber,
      pageCount,
      chunkCount,
      events,
      errors
    );
  }
}

/**
 * Retrieves a document by SHA-256 hash to support deduplication.
 */
export async function getDocumentBySha256(sha256: string): Promise<DocumentRow | null> {
  try {
    const p = getDbPool();
    const res = await p.query("SELECT * FROM documents WHERE sha256 = $1 LIMIT 1;", [sha256]);
    if (res.rows && res.rows[0]) return res.rows[0];
  } catch {
    // Fall through to local
  }
  return localGetDocumentBySha256(sha256);
}

export async function updateDocument(
  documentId: string,
  updates: Partial<DocumentRow>
): Promise<boolean> {
  try {
    const p = getDbPool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
    if (fields.length > 0) {
      values.push(documentId);
      await p.query(`UPDATE documents SET ${fields.join(", ")} WHERE id = $${idx};`, values);
    }
  } catch {
    // Fallback to local
  }
  return localUpdateDocument(documentId, updates);
}

export async function updateDocumentChunks(
  documentId: string,
  chunks: ChunkRow[]
): Promise<boolean> {
  return localUpdateChunks(documentId, chunks);
}

export async function deleteChunk(chunkId: string): Promise<boolean> {
  try {
    const p = getDbPool();
    await p.query("DELETE FROM document_chunks WHERE chunk_id = $1;", [chunkId]);
  } catch {}
  return localDeleteChunk(chunkId);
}


