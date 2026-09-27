from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from bisveda.config.settings import get_settings
from bisveda.connectors.base import BaseConnector
from bisveda.connectors.impl import (
    CatalogueConnector,
    FAQConnector,
    LaboratoryConnector,
    QCOConnector,
    SchemeConnector,
    UpdatesConnector,
)


class ConnectorRegistry:
    """
    V8 Canonical Spec §9.1: Authorized Source Registry & Connector Runner.
    Manages named connectors, executes synchronization runs, and ensures offline snapshot availability.
    """

    def __init__(self, snapshot_dir: Optional[Path] = None):
        settings = get_settings()
        self.snapshot_dir = snapshot_dir or (settings.data_dir / "snapshots")
        self.connectors: Dict[str, BaseConnector] = {}
        self._register_default_connectors()

    def _register_default_connectors(self):
        self.register(CatalogueConnector())
        self.register(LaboratoryConnector())
        self.register(QCOConnector())
        self.register(SchemeConnector())
        self.register(UpdatesConnector())
        self.register(FAQConnector())

    def register(self, connector: BaseConnector):
        self.connectors[connector.source_id] = connector

    def get_connector(self, source_id: str) -> Optional[BaseConnector]:
        return self.connectors.get(source_id)

    def list_sources(self) -> List[Dict[str, Any]]:
        sources = []
        for c in self.connectors.values():
            sources.append(c.get_provenance())
        return sources

    def sync_all(self, export_snapshots: bool = True) -> Dict[str, Any]:
        results = {}
        for source_id, conn in self.connectors.items():
            records = conn.fetch_records(use_offline_snapshot=True)
            snapshot_path = None
            if export_snapshots:
                snapshot_path = str(conn.export_snapshot(self.snapshot_dir))
            results[source_id] = {
                "records_count": len(records),
                "sha256": conn.compute_fingerprint(records),
                "snapshot_path": snapshot_path,
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
        return results

    def load_offline_snapshots(self) -> Dict[str, int]:
        counts = {}
        for source_id, conn in self.connectors.items():
            snapshot_file = self.snapshot_dir / f"{source_id}_latest.json"
            if snapshot_file.exists():
                records = conn.load_snapshot(snapshot_file)
                counts[source_id] = len(records)
            else:
                records = conn.fetch_records(use_offline_snapshot=True)
                counts[source_id] = len(records)
        return counts
