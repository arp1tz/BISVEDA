from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from bisveda.agents.ag1_matching import StandardsMatchingAgent
from bisveda.agents.ag2_regulatory import QCORegulatoryAgent
from bisveda.agents.ag3_technical import TechnicalSpecsAgent
from bisveda.agents.ag4_certification import CertificationLicensingAgent
from bisveda.agents.ag5_labs import LabLocatorAgent
from bisveda.contracts.mission import (
    ComplianceMission,
    ComplianceStep,
    MissionStatus,
    ProductIdentity,
    StepEvaluationState,
)
from bisveda.storage.sqlite_store import SQLiteStore


class MissionManager:
    """
    Mission Manager Orchestrator (Canonical Spec §3.3 & §3.4).
    Coordinates specialist agents (AG1-AG5), evaluates step progression,
    populates 3-question explainability triples, and manages lifecycle in SQLite WAL storage.
    """

    def __init__(self, store: Optional[SQLiteStore] = None):
        self.store = store or SQLiteStore()
        self.ag1 = StandardsMatchingAgent()
        self.ag2 = QCORegulatoryAgent()
        self.ag3 = TechnicalSpecsAgent()
        self.ag4 = CertificationLicensingAgent()
        self.ag5 = LabLocatorAgent()

    def create_or_update_mission_for_query(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        entities: Dict[str, Any],
        user_type: str = "msme",
        market: str = "domestic",
        origin: Optional[str] = None,
        dossier_id: Optional[str] = None,
    ) -> ComplianceMission:
        """
        Executes bounded specialist agents and builds a complete, stateful ComplianceMission.
        """
        mission_id = f"MIS-{uuid.uuid4().hex[:8].upper()}"
        product_name = entities.get("product") or query
        material = entities.get("material")

        identity = ProductIdentity(
            name=product_name,
            material=material,
            intended_use=entities.get("intended_use") or market,
            user_type=user_type,
            origin_pin=entities.get("pin") or origin,
        )

        mission = ComplianceMission(
            mission_id=mission_id,
            title=f"BIS Compliance Pathway: {product_name.title()}",
            status=MissionStatus.ACTIVE,
            product_identity=identity,
            active_dossier_id=dossier_id,
        )

        # Agent Execution Context
        context = {
            "query": query,
            "candidates": candidates,
            "entities": entities,
            "product_name": product_name,
            "user_type": user_type,
            "market": market,
            "origin": origin or entities.get("pin") or entities.get("city"),
        }

        # Step 1: AG1 Standards & Matching (PRODUCT_MATCHING)
        ag1_res = self.ag1.run(context)
        primary_std = ag1_res.get("primary_standard")
        std_num = ag1_res.get("standard_number") or "IS Unknown"

        if primary_std:
            mission.update_step(
                step=ComplianceStep.PRODUCT_MATCHING,
                state=StepEvaluationState.SUPPORTED,
                summary=f"Applicable standard identified as {std_num} ({ag1_res.get('standard_title')}).",
                explainability=ag1_res.get("explainability"),
            )
        else:
            mission.update_step(
                step=ComplianceStep.PRODUCT_MATCHING,
                state=StepEvaluationState.CANDIDATE,
                summary="Awaiting exact standard determination.",
                explainability=ag1_res.get("explainability"),
            )

        context["primary_standard"] = primary_std
        context["standard_number"] = std_num

        # Step 2: AG2 QCO & Regulatory (QCO_COMPLIANCE)
        ag2_res = self.ag2.run(context)
        if ag2_res.get("is_mandatory"):
            mission.update_step(
                step=ComplianceStep.QCO_COMPLIANCE,
                state=StepEvaluationState.SUPPORTED,
                summary=(
                    f"Mandatory under {ag2_res.get('order_title')} ({ag2_res.get('so_number')}). "
                    f"Penal warning: {ag2_res.get('penal_warning')}"
                ),
            )
        else:
            mission.update_step(
                step=ComplianceStep.QCO_COMPLIANCE,
                state=StepEvaluationState.SUPPORTED,
                summary="Standard is voluntary for domestic sale. Certification grants ISI mark differentiation.",
            )

        # Step 3: AG3 Technical Specifications & Testing Limits (TESTING_REQUIREMENTS)
        ag3_res = self.ag3.run(context)
        limits_count = len(ag3_res.get("numerical_limits", []))
        mission.update_step(
            step=ComplianceStep.TESTING_REQUIREMENTS,
            state=StepEvaluationState.SUPPORTED if limits_count > 0 else StepEvaluationState.CANDIDATE,
            summary=f"Evaluated {limits_count} technical test parameters and critical tolerances.",
        )

        # Step 4: AG5 Lab & Centre Selection (LAB_IDENTIFICATION)
        ag5_res = self.ag5.run(context)
        closest_lab = ag5_res.get("closest_lab")
        if closest_lab:
            dist_str = f" ({closest_lab.get('distance_km')} km away)" if closest_lab.get("distance_km") is not None else ""
            mission.update_step(
                step=ComplianceStep.LAB_IDENTIFICATION,
                state=StepEvaluationState.SUPPORTED,
                summary=f"Closest recognized laboratory: {closest_lab.get('name')} in {closest_lab.get('city')}{dist_str}.",
            )
        else:
            mission.update_step(
                step=ComplianceStep.LAB_IDENTIFICATION,
                state=StepEvaluationState.CANDIDATE,
                summary="Locating accredited laboratories for test parameters.",
            )

        # Step 5: AG4 Certification Pathway & Fee Breakdown (CERTIFICATION_ROUTE)
        ag4_res = self.ag4.run(context)
        fee_info = ag4_res.get("fee_breakdown", {})
        concession_text = f" with {ag4_res.get('concession_percentage')}% MSME fee concession" if ag4_res.get("msme_concession_applied") else ""
        mission.update_step(
            step=ComplianceStep.CERTIFICATION_ROUTE,
            state=StepEvaluationState.CANDIDATE,
            summary=(
                f"Certification route: {ag4_res.get('scheme_name')}{concession_text}. "
                f"Estimated initial cost: ₹{fee_info.get('total_estimated_initial_cost', 0):,}."
            ),
        )

        # Check overall mission completion status
        if all(s.state == StepEvaluationState.SUPPORTED for s in mission.step_states.values() if s.step != ComplianceStep.CERTIFICATION_ROUTE):
            mission.status = MissionStatus.ACTIVE

        # Persist in SQLiteStore
        self.store.save_mission(mission)
        return mission
