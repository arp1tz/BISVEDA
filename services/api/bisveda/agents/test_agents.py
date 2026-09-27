import pytest
from bisveda.agents import (
    StandardsMatchingAgent,
    QCORegulatoryAgent,
    TechnicalSpecsAgent,
    CertificationLicensingAgent,
    LabLocatorAgent,
    ConsumerAssistanceAgent,
    ComparisonChangeAgent,
    MissionManager,
)
from bisveda.contracts.adjudication import KnowledgeTier
from bisveda.contracts.mission import ComplianceStep, StepEvaluationState
from bisveda.storage.sqlite_store import SQLiteStore


def test_ag1_standards_matching_and_explainability():
    agent = StandardsMatchingAgent()
    candidates = [
        {
            "standard_id": "BIS-STD-002",
            "standard_number": "IS 2347",
            "full_title": "Domestic Pressure Cookers - Specification",
            "materials": ["Stainless Steel", "Aluminium Alloy"],
            "relevance_score": 0.96,
        }
    ]
    res = agent.run({
        "candidates": candidates,
        "entities": {"product": "pressure cooker", "material": "stainless steel"},
    })

    assert res["status"] == "matched"
    assert res["standard_number"] == "IS 2347"
    exp = res["explainability"]
    assert exp is not None
    assert "IS 2347 directly specifies" in exp.why
    assert exp.evidence_ids == ["S1"]
    assert len(exp.change_triggers) >= 2


def test_ag2_qco_regulatory_mandatory_and_penal():
    agent = QCORegulatoryAgent()
    res = agent.run({"standard_number": "IS 2347"})

    assert res["is_mandatory"] is True
    assert res["status"] == "MANDATORY_QCO"
    assert "Section 29" in res["penal_warning"]
    assert "2 years" in res["penal_warning"]
    assert res["so_number"] is not None


def test_ag3_technical_specs_tier_gating():
    agent = TechnicalSpecsAgent()

    # Tier A Gated Test
    res_tier_a = agent.run({
        "primary_standard": {
            "standard_number": "IS 2347",
            "key_testing_parameters": ["Hydrostatic test"],
            "materials": ["Stainless Steel"],
            "tier": KnowledgeTier.TIER_A,
        },
        "tier": KnowledgeTier.TIER_A,
    })
    assert res_tier_a["tier_notice"] is not None
    assert "restricted under Tier A" in res_tier_a["tier_notice"]
    assert len(res_tier_a["numerical_limits"]) == 0

    # Tier C Full Access Test
    res_tier_c = agent.run({
        "primary_standard": {
            "standard_number": "IS 2347",
            "tier": KnowledgeTier.TIER_C,
        },
        "tier": KnowledgeTier.TIER_C,
    })
    assert res_tier_c["tier_notice"] is None
    assert len(res_tier_c["numerical_limits"]) >= 3
    params = [lim["parameter"] for lim in res_tier_c["numerical_limits"]]
    assert "Hydrostatic Pressure Test" in params


def test_ag4_certification_msme_concession():
    agent = CertificationLicensingAgent()

    # MSME User Test
    res_msme = agent.run({
        "primary_standard": {"standard_number": "IS 2347", "scheme": "Scheme-I"},
        "user_type": "msme",
    })
    assert res_msme["msme_concession_applied"] is True
    assert res_msme["fee_breakdown"]["application_fee"] == 1000  # 80% off 5000
    assert len(res_msme["roadmap_steps"]) == 5

    # Large Enterprise Test
    res_large = agent.run({
        "primary_standard": {"standard_number": "IS 2347"},
        "user_type": "large",
    })
    assert res_large["msme_concession_applied"] is False
    assert res_large["fee_breakdown"]["application_fee"] == 5000


def test_ag5_lab_locator_with_distance():
    agent = LabLocatorAgent()
    res = agent.run({
        "standard_number": "IS 2347",
        "origin": "Nagpur",
    })
    assert res["total_matched"] >= 1
    assert len(res["laboratories"]) >= 1
    closest = res["closest_lab"]
    assert closest is not None
    assert "distance_km" in closest


def test_ag6_consumer_shape_verification():
    agent = ConsumerAssistanceAgent()

    # Valid CM/L
    res_valid_cml = agent.run({"mark_type": "cml", "identifier": "8765432"})
    assert res_valid_cml["is_valid_format"] is True
    assert "8765432" in res_valid_cml["official_portal_url"]

    # Invalid CM/L
    res_bad_cml = agent.run({"mark_type": "cml", "identifier": "123"})
    assert res_bad_cml["is_valid_format"] is False

    # Valid HUID
    res_huid = agent.run({"mark_type": "huid", "identifier": "A1B2C3"})
    assert res_huid["is_valid_format"] is True


def test_ag8_comparison_editions():
    agent = ComparisonChangeAgent()
    res = agent.run({
        "standard_a": "IS 1786:1985",
        "standard_b": "IS 1786:2008",
    })
    assert res["found_a"] is True
    assert len(res["differences"]) >= 3
    params = [d["parameter"] for d in res["differences"]]
    assert "Steel Grades" in params


def test_mission_manager_orchestration():
    store = SQLiteStore()
    manager = MissionManager(store=store)

    candidates = [
        {
            "standard_id": "BIS-STD-002",
            "standard_number": "IS 2347",
            "full_title": "Domestic Pressure Cookers - Specification",
            "materials": ["Stainless Steel"],
            "relevance_score": 0.96,
            "mandatory_qco": True,
        }
    ]
    entities = {
        "product": "domestic pressure cooker",
        "material": "stainless steel",
        "city": "Nagpur",
    }

    mission = manager.create_or_update_mission_for_query(
        query="domestic pressure cookers stainless steel in Nagpur",
        candidates=candidates,
        entities=entities,
        user_type="msme",
        origin="Nagpur",
    )

    assert mission.mission_id.startswith("MIS-")
    assert "Pressure Cooker" in mission.title

    # Verify all 5 steps are populated
    steps = mission.step_states
    assert steps[ComplianceStep.PRODUCT_MATCHING.value].state == StepEvaluationState.SUPPORTED
    assert steps[ComplianceStep.PRODUCT_MATCHING.value].explainability is not None
    assert "IS 2347" in steps[ComplianceStep.PRODUCT_MATCHING.value].summary

    assert steps[ComplianceStep.QCO_COMPLIANCE.value].state == StepEvaluationState.SUPPORTED
    assert "Mandatory" in steps[ComplianceStep.QCO_COMPLIANCE.value].summary

    assert steps[ComplianceStep.TESTING_REQUIREMENTS.value].state == StepEvaluationState.SUPPORTED

    assert steps[ComplianceStep.LAB_IDENTIFICATION.value].state == StepEvaluationState.SUPPORTED
    assert "closest" in steps[ComplianceStep.LAB_IDENTIFICATION.value].summary.lower()

    assert steps[ComplianceStep.CERTIFICATION_ROUTE.value].state == StepEvaluationState.CANDIDATE
    assert "80% MSME fee concession" in steps[ComplianceStep.CERTIFICATION_ROUTE.value].summary

    # Verify persistent store retrieval
    stored = store.get_mission(mission.mission_id)
    assert stored is not None
    assert stored.mission_id == mission.mission_id
