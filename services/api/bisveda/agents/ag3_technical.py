from typing import Any, Dict, List, Optional
from bisveda.agents.base import BaseSpecialistAgent
from bisveda.contracts.adjudication import KnowledgeTier


class TechnicalSpecsAgent(BaseSpecialistAgent):
    """
    AG3: Technical Specifications & Limits Specialist Agent (Canonical Spec §3.3).
    Tier-gated: Returns technical clauses, tolerances, test limits, and material chemistry.
    For Tier A (metadata only), strictly emits tier boundary notices per Rule 7.
    """

    agent_id = "AG3"
    agent_name = "Technical Specifications Specialist"
    description = "Provides tier-gated technical requirements, test limits, and engineering parameters."

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        primary_cand = context.get("primary_standard") or {}
        tier = context.get("tier") or primary_cand.get("tier") or KnowledgeTier.TIER_C

        std_num = primary_cand.get("standard_number") or primary_cand.get("is_number") or "IS Unknown"
        testing_params = primary_cand.get("key_testing_parameters") or []
        materials = primary_cand.get("materials") or []
        matched_clauses = primary_cand.get("matched_clauses") or []

        # Tier A Boundary Policy (Rule 7 / D35)
        if tier == KnowledgeTier.TIER_A:
            return {
                "tier": KnowledgeTier.TIER_A.value,
                "tier_notice": (
                    f"Full technical clauses and numerical limits for {std_num} are restricted under Tier A (Catalogue Metadata only). "
                    "Authorized full-text access requires BIS license or Tier B/C public gazette status."
                ),
                "scope": primary_cand.get("scope", ""),
                "key_testing_parameters": testing_params,
                "materials_allowed": materials,
                "numerical_limits": [],
            }

        # Specific known statutory limits for seed standards (IS 2347, IS 1786, IS 14543, etc.)
        limits = []
        if "2347" in std_num:
            limits = [
                {"parameter": "Hydrostatic Pressure Test", "clause": "Clause 8.1", "limit": "200 kPa for 1 minute without leakage or permanent distortion"},
                {"parameter": "Bursting Pressure", "clause": "Clause 8.2", "limit": "Minimum 300 kPa"},
                {"parameter": "Safety Relief Valve Operation", "clause": "Clause 7.4", "limit": "Release between 100 kPa and 140 kPa"},
                {"parameter": "Lead Leaching Limit", "clause": "Clause 4.3", "limit": "Not more than 0.01 mg/L"},
            ]
        elif "1786" in std_num:
            limits = [
                {"parameter": "0.2% Proof Stress / Yield Stress", "clause": "Clause 9.1", "limit": "Min 500 N/mm² (Fe 500), 550 N/mm² (Fe 550D)"},
                {"parameter": "Tensile Strength (TS/YS Ratio)", "clause": "Clause 9.1", "limit": "Min 1.10 (Fe 500), Min 1.12 (Fe 500D)"},
                {"parameter": "Elongation at Gauge Length", "clause": "Clause 9.2", "limit": "Min 12.0% (Fe 500), Min 16.0% (Fe 500D)"},
                {"parameter": "Carbon Equivalent (CE)", "clause": "Clause 4.2", "limit": "Max 0.42% for weldability"},
            ]
        elif "14543" in std_num:
            limits = [
                {"parameter": "Total Dissolved Solids (TDS)", "clause": "Table 1", "limit": "75 to 500 mg/L"},
                {"parameter": "pH Value", "clause": "Table 1", "limit": "6.5 to 8.5"},
                {"parameter": "E. coli and Coliform", "clause": "Table 3", "limit": "Nil in 250 ml"},
                {"parameter": "Pesticide Residues (Individual)", "clause": "Clause 5.3", "limit": "Not more than 0.0001 mg/L"},
            ]
        elif "17526" in std_num:
            limits = [
                {"parameter": "Thermal Insulation Retention", "clause": "Clause 5.2", "limit": "Maintain liquid temp above 60°C after 6 hours (from 95°C)"},
                {"parameter": "Material Composition", "clause": "Clause 4.1", "limit": "Austenitic Stainless Steel Grade 304 (SS 304)"},
                {"parameter": "Leakage Test", "clause": "Clause 6.1", "limit": "Zero liquid egress at 0.5 bar inverted hold for 5 min"},
            ]
        else:
            for p in testing_params:
                limits.append({"parameter": p, "clause": "Standard Spec", "limit": "As prescribed in active standard"})

        return {
            "tier": tier.value if hasattr(tier, "value") else str(tier),
            "tier_notice": None,
            "scope": primary_cand.get("scope", ""),
            "key_testing_parameters": testing_params,
            "materials_allowed": materials,
            "numerical_limits": limits,
            "matched_clauses": matched_clauses,
        }
