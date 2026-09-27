import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent
from bisveda.config.settings import get_settings
from bisveda.retrieval.geocoder import LocalPINCentroidGeocoder


class LabLocatorAgent(BaseSpecialistAgent):
    """
    AG5: Laboratory & Testing Centre Locator Specialist Agent (Canonical Spec §3.3).
    Matches product standards against recognized BIS/NABL laboratories and computes
    Haversine distances from user PIN or City using LocalPINCentroidGeocoder.
    """

    agent_id = "AG5"
    agent_name = "Laboratory & Testing Centre Locator"
    description = "Locates accredited testing laboratories and sorts by geographic distance."

    def __init__(self, labs_file: Optional[Path] = None):
        settings = get_settings()
        self.labs_file = labs_file or (settings.data_dir / "seed" / "laboratories.json")
        self.labs: List[Dict[str, Any]] = []
        self.geocoder = LocalPINCentroidGeocoder()
        self._load_labs()

    def _load_labs(self):
        if self.labs_file and self.labs_file.exists():
            try:
                with open(self.labs_file, "r", encoding="utf-8") as f:
                    self.labs = json.load(f)
            except Exception:
                self.labs = []

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        primary_cand = context.get("primary_standard") or {}
        std_num = context.get("standard_number") or primary_cand.get("standard_number") or primary_cand.get("is_number") or ""
        norm_std = std_num.replace(" ", "").upper()

        entities = context.get("entities") or {}
        origin = context.get("origin") or entities.get("pin") or entities.get("city") or context.get("city") or None

        # Filter labs that cover this standard or general mechanical/chemical/electrical scope
        matched_labs: List[Dict[str, Any]] = []
        for lab in self.labs:
            stds_tested = [str(s).replace(" ", "").upper() for s in (lab.get("standards_tested") or [])]
            if not norm_std or norm_std in stds_tested or any(norm_std in s for s in stds_tested):
                matched_labs.append(dict(lab))

        # Fallback to labs in same product category if exact standard list is limited
        if not matched_labs:
            matched_labs = [dict(l) for l in self.labs[:10]]

        # Sort by distance if origin provided
        if origin:
            matched_labs = self.geocoder.sort_labs_by_distance(matched_labs, origin)

        return {
            "total_matched": len(matched_labs),
            "origin": origin,
            "standard_number": std_num,
            "laboratories": matched_labs[:5],
            "closest_lab": matched_labs[0] if matched_labs else None,
        }
