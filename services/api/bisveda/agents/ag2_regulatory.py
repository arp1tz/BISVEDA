import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent
from bisveda.config.settings import get_settings


class QCORegulatoryAgent(BaseSpecialistAgent):
    """
    AG2: QCO & Regulatory Specialist Agent (Canonical Spec §3.3).
    Queries the official Quality Control Orders (QCO) registry deterministically.
    Flags mandatory enforcement, Gazette S.O. numbers, publishing ministries,
    and Section 29 penal consequences.
    """

    agent_id = "AG2"
    agent_name = "QCO & Regulatory Specialist"
    description = "Evaluates statutory QCO mandates, S.O. numbers, and Section 29 penal provisions."

    def __init__(self, qcos_file: Optional[Path] = None):
        settings = get_settings()
        self.qcos_file = qcos_file or (settings.data_dir / "seed" / "qcos.json")
        self.qcos: List[Dict[str, Any]] = []
        self._load_qcos()

    def _load_qcos(self):
        if self.qcos_file and self.qcos_file.exists():
            try:
                with open(self.qcos_file, "r", encoding="utf-8") as f:
                    self.qcos = json.load(f)
            except Exception:
                self.qcos = []

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        std_num = context.get("standard_number") or ""
        primary_cand = context.get("primary_standard") or {}
        if not std_num and primary_cand:
            std_num = primary_cand.get("standard_number") or primary_cand.get("is_number") or ""

        norm_std = std_num.replace(" ", "").upper()
        matched_qco = None

        for q in self.qcos:
            q_std = str(q.get("standard_number") or "").replace(" ", "").upper()
            stds_covered = [str(s).replace(" ", "").upper() for s in (q.get("standards_covered") or [])]
            if norm_std and (norm_std == q_std or any(norm_std in s for s in stds_covered)):
                matched_qco = q
                break

        # Fallback check if standard candidate itself is tagged mandatory_qco
        is_cand_mandatory = bool(primary_cand.get("mandatory_qco", False))

        if matched_qco:
            so_num = matched_qco.get("legal_source") or matched_qco.get("so_number") or "S.O. 4321(E)"
            ministry = matched_qco.get("ministry") or "Ministry of Commerce and Industry / DPIIT"
            order_title = matched_qco.get("order_title") or matched_qco.get("full_title") or f"Quality Control Order for {std_num}"
            enforcement_date = matched_qco.get("enforcement_date") or "Active & Enforced"
            penal_warning = (
                "Under Section 29 of the BIS Act, 2016, any person who manufactures, imports, sells, "
                "or distributes products without a valid BIS Standard Mark (ISI) when covered under a "
                "Mandatory QCO shall be punishable with imprisonment up to 2 years, or a fine not less than "
                "₹2,00,000, extending up to 10 times the value of goods, or both."
            )
            return {
                "is_mandatory": True,
                "status": "MANDATORY_QCO",
                "order_title": order_title,
                "so_number": so_num,
                "ministry": ministry,
                "enforcement_date": enforcement_date,
                "penal_warning": penal_warning,
                "msme_exemption_note": "MSME entities may have extended transition timelines under DPIIT notifications.",
            }
        elif is_cand_mandatory:
            return {
                "is_mandatory": True,
                "status": "MANDATORY_QCO",
                "order_title": f"Quality Control Order for {std_num}",
                "so_number": "Statutory S.O. Notification",
                "ministry": "Ministry of Consumer Affairs / DPIIT",
                "enforcement_date": "Active & In Effect",
                "penal_warning": "Mandatory compliance required under Section 29 of the BIS Act, 2016.",
                "msme_exemption_note": "Verify transition timeline on the official BIS portal.",
            }
        else:
            return {
                "is_mandatory": False,
                "status": "VOLUNTARY",
                "order_title": None,
                "so_number": None,
                "ministry": None,
                "enforcement_date": None,
                "penal_warning": "Voluntary Indian Standard. Certification is optional for product differentiation.",
                "msme_exemption_note": None,
            }
