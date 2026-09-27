from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional

from bisveda.config.settings import get_settings
from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.contracts.evidence import EvidenceClass
from bisveda.ingestion.chunker import DocumentChunk


class CatalogStorage:
    """
    SQLite FTS5 Storage for Ingested Standards, QCOs, and Chunks.
    Supports Blue-Green staging before atomic publishing into the live index.
    """

    def __init__(self, db_path: Optional[Path] = None):
        settings = get_settings()
        self.db_path = db_path or (settings.storage_root / "bisveda_catalog.db")
        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._con: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._con is None:
            self._con = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._con.row_factory = sqlite3.Row
        return self._con

    def close(self):
        if self._con is not None:
            self._con.close()
            self._con = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _init_db(self):
        con = self._get_connection()
        cur = con.cursor()
        # Documents table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                standard_number TEXT,
                doc_type TEXT NOT NULL,
                committee TEXT,
                status TEXT NOT NULL,  -- staged, published, quarantined
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                published_at TEXT
            );
            """
        )
        # Staged chunks table (Awaiting review)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS staged_chunks (
                chunk_id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                standard_number TEXT,
                clause_number TEXT,
                tier TEXT NOT NULL,
                kind TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                evidence_class TEXT NOT NULL,
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
            """
        )
        # Published chunks table (Active live index)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS published_chunks (
                chunk_id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                standard_number TEXT,
                clause_number TEXT,
                tier TEXT NOT NULL,
                kind TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                evidence_class TEXT NOT NULL,
                metadata_json TEXT,
                published_at TEXT NOT NULL,
                FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
            """
        )
        # SQLite FTS5 Virtual Table for full-text clause search
        cur.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                chunk_id UNINDEXED,
                document_id UNINDEXED,
                standard_number,
                clause_number,
                tier,
                kind,
                page_number UNINDEXED,
                title,
                content
            );
            """
        )
        con.commit()

    def stage_document(
        self,
        doc_id: str,
        title: str,
        standard_number: Optional[str],
        doc_type: str,
        committee: str,
        metadata: Dict[str, Any],
        chunks: List[DocumentChunk],
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as con:
            cur = con.cursor()
            # Upsert document in staged state
            cur.execute(
                """
                INSERT OR REPLACE INTO documents 
                (id, title, standard_number, doc_type, committee, status, metadata_json, created_at, published_at)
                VALUES (?, ?, ?, ?, ?, 'staged', ?, ?, NULL);
                """,
                (doc_id, title, standard_number, doc_type, committee, json.dumps(metadata), now),
            )

            # Clear any prior staged chunks for this document
            cur.execute("DELETE FROM staged_chunks WHERE document_id = ?;", (doc_id,))

            # Insert new staged chunks
            for chk in chunks:
                cur.execute(
                    """
                    INSERT INTO staged_chunks
                    (chunk_id, document_id, standard_number, clause_number, tier, kind, page_number, title, content, evidence_class, metadata_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        chk.chunk_id,
                        chk.document_id,
                        chk.standard_number,
                        chk.clause_number,
                        chk.tier.value if isinstance(chk.tier, KnowledgeTier) else str(chk.tier),
                        chk.kind,
                        chk.page_number,
                        chk.title,
                        chk.content,
                        chk.evidence_class.value if isinstance(chk.evidence_class, EvidenceClass) else str(chk.evidence_class),
                        json.dumps(chk.metadata),
                        now,
                    ),
                )
            con.commit()

    def publish_document(self, doc_id: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as con:
            cur = con.cursor()
            # Check document exists
            cur.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
            doc_row = cur.fetchone()
            if not doc_row:
                return False

            # Fetch staged chunks
            cur.execute("SELECT * FROM staged_chunks WHERE document_id = ?;", (doc_id,))
            staged = cur.fetchall()

            # Insert into published_chunks
            for chk in staged:
                cur.execute(
                    """
                    INSERT OR REPLACE INTO published_chunks
                    (chunk_id, document_id, standard_number, clause_number, tier, kind, page_number, title, content, evidence_class, metadata_json, published_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        chk["chunk_id"],
                        chk["document_id"],
                        chk["standard_number"],
                        chk["clause_number"],
                        chk["tier"],
                        chk["kind"],
                        chk["page_number"],
                        chk["title"],
                        chk["content"],
                        chk["evidence_class"],
                        chk["metadata_json"],
                        now,
                    ),
                )
                # Insert into chunks_fts virtual table
                cur.execute(
                    """
                    INSERT INTO chunks_fts 
                    (chunk_id, document_id, standard_number, clause_number, tier, kind, page_number, title, content)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        chk["chunk_id"],
                        chk["document_id"],
                        chk["standard_number"] or "",
                        chk["clause_number"] or "",
                        chk["tier"],
                        chk["kind"],
                        chk["page_number"],
                        chk["title"],
                        chk["content"],
                    ),
                )

            # Delete from staged
            cur.execute("DELETE FROM staged_chunks WHERE document_id = ?;", (doc_id,))

            # Update document status
            cur.execute(
                """
                UPDATE documents 
                SET status = 'published', published_at = ? 
                WHERE id = ?;
                """,
                (now, doc_id),
            )
            con.commit()
            return True

    def search_chunks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        clean_q = "".join([c if c.isalnum() or c.isspace() else " " for c in query]).strip()
        if not clean_q:
            return []

        tokens = clean_q.split()
        # Formulate FTS5 query with prefix search
        fts_query = " OR ".join([f"{t}*" for t in tokens])

        with self._get_connection() as con:
            cur = con.cursor()
            try:
                cur.execute(
                    """
                    SELECT chunk_id, document_id, standard_number, clause_number, tier, kind, page_number, title, content, rank
                    FROM chunks_fts
                    WHERE chunks_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?;
                    """,
                    (fts_query, limit),
                )
                rows = cur.fetchall()
                results = []
                for r in rows:
                    results.append(
                        {
                            "chunk_id": r["chunk_id"],
                            "document_id": r["document_id"],
                            "standard_number": r["standard_number"],
                            "clause_number": r["clause_number"],
                            "tier": r["tier"],
                            "kind": r["kind"],
                            "page_number": r["page_number"],
                            "title": r["title"],
                            "content": r["content"],
                            "rank": r["rank"],
                        }
                    )
                return results
            except sqlite3.OperationalError:
                return []

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as con:
            cur = con.cursor()
            cur.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
            row = cur.fetchone()
            if not row:
                return None
            res = dict(row)
            if res.get("metadata_json"):
                res["metadata"] = json.loads(res["metadata_json"])
            return res

    def list_documents(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as con:
            cur = con.cursor()
            if status:
                cur.execute("SELECT * FROM documents WHERE status = ? ORDER BY created_at DESC;", (status,))
            else:
                cur.execute("SELECT * FROM documents ORDER BY created_at DESC;")
            rows = cur.fetchall()
            docs = []
            for r in rows:
                d = dict(r)
                if d.get("metadata_json"):
                    d["metadata"] = json.loads(d["metadata_json"])
                docs.append(d)
            return docs

    def get_document_chunks(self, doc_id: str, staged_only: bool = False) -> List[Dict[str, Any]]:
        table = "staged_chunks" if staged_only else "published_chunks"
        with self._get_connection() as con:
            cur = con.cursor()
            cur.execute(f"SELECT * FROM {table} WHERE document_id = ? ORDER BY page_number ASC;", (doc_id,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
