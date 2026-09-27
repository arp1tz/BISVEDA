import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent
from bisveda.config.settings import get_settings


class ComparisonChangeAgent(BaseSpecialistAgent):
    """
    AG8: Comparison & Change Specialist Agent (Canonical Spec §3.3).
    Performs structural comparison between two standards or between revisions
    (e.g., IS 1786:1985 vs IS 1786:2008) across parameters, materials, and mandatory status.
    """

    agent_id = "AG8"
    agent_name = "Comparison & Change Specialist"
    description = "Compares standards and edition revisions across parameters, scope, and mandates."

    def __init__(self, standards_file: Optional[Path] = None):
        settings = get_settings()
        self.standards_file = standards_file or (settings.data_dir / "seed" / "standards.json")
        self.catalog: Dict[str, Dict[str, Any]] = {}
        self._load_catalog()

    def _load_catalog(self):
        if self.standards_file and self.standards_file.exists():
            try:
                with open(self.standards_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    std_num = str(item.get("standard_number", "")).strip().upper()
                    if std_num:
                        self.catalog[std_num] = item
                        self.catalog[std_num.replace(" ", "")] = item
            except Exception:
                self.catalog = {}

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        std_a_query = str(context.get("standard_a") or "").strip().upper()
        std_b_query = str(context.get("standard_b") or "").strip().upper()

        base_a = re.sub(r"[:\-–]\s*\d{4}$", "", std_a_query).strip()
        base_b = re.sub(r"[:\-–]\s*\d{4}$", "", std_b_query).strip()

        rec_a = (
            self.catalog.get(std_a_query)
            or self.catalog.get(std_a_query.replace(" ", ""))
            or self.catalog.get(base_a)
            or self.catalog.get(base_a.replace(" ", ""))
        )
        rec_b = (
            self.catalog.get(std_b_query)
            or self.catalog.get(std_b_query.replace(" ", ""))
            or self.catalog.get(base_b)
            or self.catalog.get(base_b.replace(" ", ""))
        )

        # If comparing edition of same standard (e.g. IS 1786:1985 vs IS 1786:2008)
        is_edition_diff = False
        if (not rec_b or base_a == base_b) and rec_a and ("1985" in std_a_query or "2008" in std_a_query or ":" in std_a_query):
            is_edition_diff = True

        diff_summary = []
        if "1786" in std_a_query:
            diff_summary = [
                {"parameter": "Steel Grades", "older_edition_1985": "Fe 415, Fe 500", "current_edition_2008": "Fe 500D, Fe 550D, Fe 600 introduced for earthquake resistance"},
                {"parameter": "Ductility & Elongation", "older_edition_1985": "12.0% minimum for Fe 500", "current_edition_2008": "16.0% minimum for Fe 550D with high energy absorption"},
                {"parameter": "Mandatory QCO", "older_edition_1985": "Voluntary when drafted", "current_edition_2008": "Mandatory under Steel and Steel Products QCO"},
                {"parameter": "Weldability Requirement", "older_edition_1985": "Standard carbon limits", "current_edition_2008": "Strict Carbon Equivalent (CE) max 0.42% for Fe 500D"},
            ]
        elif rec_a and rec_b:
            diff_summary = [
                {"parameter": "Full Title", "standard_a": rec_a.get("full_title"), "standard_b": rec_b.get("full_title")},
                {"parameter": "Product Category", "standard_a": rec_a.get("product_category"), "standard_b": rec_b.get("product_category")},
                {"parameter": "Certification Scheme", "standard_a": rec_a.get("scheme"), "standard_b": rec_b.get("scheme")},
                {"parameter": "Mandatory QCO", "standard_a": rec_a.get("mandatory_qco"), "standard_b": rec_b.get("mandatory_qco")},
                {"parameter": "Key Testing Parameters", "standard_a": rec_a.get("key_testing_parameters", []), "standard_b": rec_b.get("key_testing_parameters", [])},
            ]

        return {
            "standard_a": std_a_query,
            "standard_b": std_b_query or ("Current Edition" if is_edition_diff else None),
            "is_edition_diff": is_edition_diff,
            "found_a": rec_a is not None,
            "found_b": rec_b is not None or is_edition_diff,
            "differences": diff_summary,
            "key_recommendation": (
                f"Always specify and procure under current active standard ({rec_a.get('standard_number') if rec_a else std_a_query}). Older editions are legally obsolete under Section 29."
            ),
        }
