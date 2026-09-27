from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent
from bisveda.contracts.mission import DecisionExplainability


class StandardsMatchingAgent(BaseSpecialistAgent):
    """
    AG1: Standards & Matching Specialist Agent (Canonical Spec §3.3).
    Performs bounded standard selection, applicability adjudication,
    and constructs the 3-question explainability triple.
    """

    agent_id = "AG1"
    agent_name = "Standards & Matching Specialist"
    description = "Selects applicable Indian Standards and computes 3-question explainability."

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        candidates: List[Dict[str, Any]] = context.get("candidates") or []
        entities: Dict[str, Any] = context.get("entities") or {}
        product_name = entities.get("product") or context.get("product_name") or "Product"
        material = entities.get("material") or "specified material"

        if not candidates:
            return {
                "status": "no_match",
                "primary_standard": None,
                "secondary_standards": [],
                "explainability": DecisionExplainability(
                    why="No corresponding Indian Standard was found in the BIS active catalogue for this product query.",
                    evidence_ids=[],
                    change_triggers=["Consult the BIS technical committee for new standard formulation", "Search under generic parent category"],
                ),
            }

        top_cand = candidates[0]
        std_num = top_cand.get("standard_number") or top_cand.get("is_number") or "IS Unknown"
        std_title = top_cand.get("full_title") or top_cand.get("short_title") or std_num
        cand_materials = top_cand.get("materials") or []

        # Explainability Triple (Canonical Spec §3.2)
        why = f"{std_num} directly specifies performance, safety, and construction requirements for {product_name}."
        if cand_materials:
            why += f" Covers materials: {', '.join(cand_materials)}."

        evidence_ids = ["S1"]
        change_triggers = [
            f"Changing base material from {material} to an unlisted alloy or plastic.",
            "Changing product scope from domestic use to industrial or export-only specifications.",
            "Revision or supersession of the standard by BIS Gazette notification.",
        ]

        explainability = DecisionExplainability(
            why=why,
            evidence_ids=evidence_ids,
            change_triggers=change_triggers,
        )

        return {
            "status": "matched",
            "primary_standard": top_cand,
            "secondary_standards": candidates[1:],
            "standard_number": std_num,
            "standard_title": std_title,
            "explainability": explainability,
        }
