from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from bisveda.contracts.adjudication import KnowledgeTier


class BaseConnector(ABC):
    """
    V8 Canonical Spec §9.1: Authorized Source Connector.
    Features:
    - Canonical source registry metadata (URL, tier, cadence)
    - SHA-256 fingerprinting & provenance tracking
    - Reproducible offline snapshot export and loading (V8 §9.4)
    """

    def __init__(
        self,
        source_id: str,
        source_name: str,
        source_url: str,
        knowledge_tier: KnowledgeTier,
        seed_path: Optional[Path] = None,
    ):
        self.source_id = source_id
        self.source_name = source_name
        self.source_url = source_url
        self.knowledge_tier = knowledge_tier
        self.seed_path = seed_path
        self._records: List[Dict[str, Any]] = []
        self._last_synced_at: Optional[str] = None
        self._fingerprint: Optional[str] = None

    @abstractmethod
    def fetch_records(self, use_offline_snapshot: bool = True) -> List[Dict[str, Any]]:
        """
        Fetches raw or structured records from seed data or source endpoint.
        """
        pass

    def compute_fingerprint(self, records: List[Dict[str, Any]]) -> str:
        serialized = json.dumps(records, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def export_snapshot(self, out_dir: Path) -> Path:
        """
        Exports connector records to a timestamped and 'latest.json' snapshot file.
        """
        out_dir.mkdir(parents=True, exist_ok=True)
        if not self._records:
            self._records = self.fetch_records(use_offline_snapshot=True)

        fp = self.compute_fingerprint(self._records)
        now_iso = datetime.now(timezone.utc).isoformat()
        snapshot_data = {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "source_url": self.source_url,
            "knowledge_tier": self.knowledge_tier.value,
            "retrieved_at": now_iso,
            "sha256": fp,
            "record_count": len(self._records),
            "records": self._records,
        }

        target_file = out_dir / f"{self.source_id}_latest.json"
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(snapshot_data, f, indent=2)

        self._last_synced_at = now_iso
        self._fingerprint = fp
        return target_file

    def load_snapshot(self, snapshot_path: Path) -> List[Dict[str, Any]]:
        if not snapshot_path.exists():
            raise FileNotFoundError(f"Snapshot file not found: {snapshot_path}")

        with open(snapshot_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        records = data.get("records", [])
        self._records = records
        self._last_synced_at = data.get("retrieved_at")
        self._fingerprint = data.get("sha256")
        return records

    def get_provenance(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            "source_url": self.source_url,
            "knowledge_tier": self.knowledge_tier.value,
            "last_synced_at": self._last_synced_at,
            "record_count": len(self._records),
            "sha256": self._fingerprint,
        }
