from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional

from bisveda.config.settings import get_settings
from bisveda.contracts.dossier import ComplianceDossier
from bisveda.contracts.mission import ComplianceMission, MissionStatus


class SQLiteStore:
    """
    Persistent SQLite Store for BISVEDA V8.
    Provides durable persistence for:
    - Compliance Missions (V8 Canonical Spec §6)
    - Compliance Dossiers (V8 Canonical Spec §7)
    - Outdated Reference Reports (V8 Canonical Spec §11.4)
    - User Feedback & Audit Logs
    """

    def __init__(self, db_path: Optional[Path] = None):
        settings = get_settings()
        if db_path is not None:
            self.db_path = db_path
        else:
            self.db_path = settings.data_dir / "bisveda.db"

        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._con: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._con is None:
            self._con = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._con.row_factory = sqlite3.Row
            # Enable WAL mode for high concurrency
            if str(self.db_path) != ":memory:":
                self._con.execute("PRAGMA journal_mode=WAL;")
            self._con.execute("PRAGMA foreign_keys=ON;")
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

        # 1. Missions Table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS missions (
                mission_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                product_name TEXT NOT NULL,
                user_type TEXT NOT NULL,
                active_dossier_id TEXT,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_missions_product ON missions(product_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_missions_updated ON missions(updated_at DESC);")

        # 2. Dossiers Table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dossiers (
                dossier_id TEXT PRIMARY KEY,
                query_id TEXT NOT NULL,
                product TEXT,
                qco_status TEXT,
                scheme_name TEXT,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dossiers_created ON dossiers(created_at DESC);")

        # 3. Outdated Reference Reports Table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS outdated_ref_reports (
                report_id TEXT PRIMARY KEY,
                doc_name TEXT NOT NULL,
                total_citations INTEGER NOT NULL,
                outdated_count INTEGER NOT NULL,
                findings_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        # 4. Feedback Table
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                comment TEXT,
                rating INTEGER,
                created_at TEXT NOT NULL
            );
            """
        )

        con.commit()

    # --- Mission Operations ---
    def save_mission(self, mission: ComplianceMission) -> None:
        con = self._get_connection()
        payload = mission.model_dump_json()
        con.execute(
            """
            INSERT INTO missions (
                mission_id, title, status, product_name, user_type,
                active_dossier_id, payload_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mission_id) DO UPDATE SET
                title = excluded.title,
                status = excluded.status,
                product_name = excluded.product_name,
                user_type = excluded.user_type,
                active_dossier_id = excluded.active_dossier_id,
                payload_json = excluded.payload_json,
                updated_at = excluded.updated_at;
            """,
            (
                mission.mission_id,
                mission.title,
                mission.status.value,
                mission.product_identity.name,
                mission.product_identity.user_type,
                mission.active_dossier_id,
                payload,
                mission.created_at,
                mission.updated_at,
            ),
        )
        con.commit()

    def get_mission(self, mission_id: str) -> Optional[ComplianceMission]:
        con = self._get_connection()
        cur = con.execute("SELECT payload_json FROM missions WHERE mission_id = ?", (mission_id,))
        row = cur.fetchone()
        if not row:
            return None
        return ComplianceMission.model_validate_json(row["payload_json"])

    def list_missions(
        self,
        limit: int = 50,
        status: Optional[MissionStatus] = None,
        user_type: Optional[str] = None,
    ) -> List[ComplianceMission]:
        con = self._get_connection()
        query = "SELECT payload_json FROM missions WHERE 1=1"
        params: List[Any] = []
        if status:
            query += " AND status = ?"
            params.append(status.value)
        if user_type:
            query += " AND user_type = ?"
            params.append(user_type)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)

        cur = con.execute(query, params)
        rows = cur.fetchall()
        return [ComplianceMission.model_validate_json(r["payload_json"]) for r in rows]

    def delete_mission(self, mission_id: str) -> bool:
        con = self._get_connection()
        cur = con.execute("DELETE FROM missions WHERE mission_id = ?", (mission_id,))
        con.commit()
        return cur.rowcount > 0

    # --- Dossier Operations ---
    def save_dossier(self, dossier: ComplianceDossier) -> None:
        con = self._get_connection()
        payload = dossier.model_dump_json()
        con.execute(
            """
            INSERT INTO dossiers (
                dossier_id, query_id, product, qco_status, scheme_name, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(dossier_id) DO UPDATE SET
                payload_json = excluded.payload_json;
            """,
            (
                dossier.dossier_id,
                dossier.query_id,
                dossier.interpretation.product,
                dossier.regulatory.qco_status,
                dossier.certification_route.scheme_name,
                payload,
                dossier.created_at,
            ),
        )
        con.commit()

    def get_dossier(self, dossier_id: str) -> Optional[ComplianceDossier]:
        con = self._get_connection()
        cur = con.execute("SELECT payload_json FROM dossiers WHERE dossier_id = ?", (dossier_id,))
        row = cur.fetchone()
        if not row:
            return None
        return ComplianceDossier.model_validate_json(row["payload_json"])

    # --- Outdated Reference Reports ---
    def save_outdated_report(
        self,
        report_id: str,
        doc_name: str,
        findings: List[Dict[str, Any]],
    ) -> None:
        con = self._get_connection()
        outdated_count = sum(1 for f in findings if f.get("status") in ("older_edition", "superseded", "withdrawn"))
        con.execute(
            """
            INSERT INTO outdated_ref_reports (
                report_id, doc_name, total_citations, outdated_count, findings_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(report_id) DO UPDATE SET
                findings_json = excluded.findings_json;
            """,
            (
                report_id,
                doc_name,
                len(findings),
                outdated_count,
                json.dumps(findings),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        con.commit()

    def get_outdated_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        con = self._get_connection()
        cur = con.execute("SELECT * FROM outdated_ref_reports WHERE report_id = ?", (report_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "report_id": row["report_id"],
            "doc_name": row["doc_name"],
            "total_citations": row["total_citations"],
            "outdated_count": row["outdated_count"],
            "findings": json.loads(row["findings_json"]),
            "created_at": row["created_at"],
        }

    # --- Feedback Operations ---
    def save_feedback(
        self,
        turn_id: str,
        reason: str,
        comment: Optional[str] = None,
        rating: Optional[int] = None,
    ) -> int:
        con = self._get_connection()
        cur = con.execute(
            """
            INSERT INTO feedback (turn_id, reason, comment, rating, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                turn_id,
                reason,
                comment,
                rating,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        con.commit()
        return cur.lastrowid

    def list_feedback(self, limit: int = 50) -> List[Dict[str, Any]]:
        con = self._get_connection()
        cur = con.execute("SELECT * FROM feedback ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(r) for r in cur.fetchall()]
