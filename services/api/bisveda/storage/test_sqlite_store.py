from pathlib import Path
import pytest
from bisveda.contracts.dossier import (
    ComplianceDossier,
    DossierCertificationRoute,
    DossierInterpretation,
    DossierRegulatory,
    DossierTesting,
    DossierTrust,
)
from bisveda.contracts.adjudication import ConfidenceLabel, GroundingState
from bisveda.contracts.mission import (
    ComplianceMission,
    ComplianceStep,
    DecisionExplainability,
    MissionStatus,
    ProductIdentity,
    StepEvaluationState,
)
from bisveda.storage.sqlite_store import SQLiteStore


@pytest.fixture
def store(tmp_path: Path):
    db_file = tmp_path / "test_bisveda.db"
    s = SQLiteStore(db_path=db_file)
    yield s
    s.close()


def test_mission_crud(store: SQLiteStore):
    identity = ProductIdentity(
        name="Stainless Steel Domestic Pressure Cooker",
        material="Stainless Steel",
        grade="AISI 304",
        user_type="msme",
    )
    mission = ComplianceMission(
        mission_id="MSN-001",
        title="Pressure Cooker MSME Mission",
        status=MissionStatus.DRAFT,
        product_identity=identity,
    )

    # Save
    store.save_mission(mission)

    # Read back
    retrieved = store.get_mission("MSN-001")
    assert retrieved is not None
    assert retrieved.mission_id == "MSN-001"
    assert retrieved.product_identity.material == "Stainless Steel"

    # Update with 3-question explainability
    retrieved.update_step(
        step=ComplianceStep.QCO_COMPLIANCE,
        state=StepEvaluationState.SUPPORTED,
        summary="Mandatory QCO in effect",
        explainability=DecisionExplainability(
            why="Cooker QCO 2020 orders mandatory ISI Mark under Scheme-I",
            evidence_ids=["S1"],
            change_triggers=["New Gazette extension notification"],
        ),
    )
    store.save_mission(retrieved)

    # Verify update persisted
    updated = store.get_mission("MSN-001")
    assert updated is not None
    assert ComplianceStep.QCO_COMPLIANCE.value in updated.step_states
    assert updated.step_states[ComplianceStep.QCO_COMPLIANCE.value].explainability.evidence_ids == ["S1"]

    # List
    all_missions = store.list_missions()
    assert len(all_missions) == 1

    # Delete
    assert store.delete_mission("MSN-001") is True
    assert store.get_mission("MSN-001") is None


def test_dossier_storage(store: SQLiteStore):
    dossier = ComplianceDossier(
        dossier_id="DOS-001",
        created_at="2026-09-24T12:00:00Z",
        query_id="Q-TEST",
        interpretation=DossierInterpretation(product="Pressure Cooker", user_type="msme"),
        regulatory=DossierRegulatory(qco_status="mandatory", ministry="DPIIT"),
        certification_route=DossierCertificationRoute(
            scheme_name="Scheme-I",
            eligibility_result="Eligible for 80% MSME concession",
            portal_name="Manak Online",
            portal_url="https://www.manakonline.in",
        ),
        testing=DossierTesting(tier_permits_testing=True),
        summary="Mandatory certification under IS 2347.",
        trust=DossierTrust(
            grounding_state=GroundingState.VERIFIED,
            confidence_label=ConfidenceLabel.VERIFIED_EVIDENCE,
            relevance_score=0.98,
        ),
    )

    store.save_dossier(dossier)
    reloaded = store.get_dossier("DOS-001")
    assert reloaded is not None
    assert reloaded.dossier_id == "DOS-001"
    assert reloaded.regulatory.qco_status == "mandatory"
    assert reloaded.certification_route.scheme_name == "Scheme-I"


def test_outdated_reference_reports(store: SQLiteStore):
    findings = [
        {"cited": "IS 1786:1985", "status": "older_edition", "current": "IS 1786:2008", "locator": "Clause 4.2"},
        {"cited": "IS 456:2000", "status": "current", "current": "IS 456:2000", "locator": "Table 2"},
    ]
    store.save_outdated_report(
        report_id="REP-001",
        doc_name="tender_spec_rebar.pdf",
        findings=findings,
    )

    report = store.get_outdated_report("REP-001")
    assert report is not None
    assert report["doc_name"] == "tender_spec_rebar.pdf"
    assert report["total_citations"] == 2
    assert report["outdated_count"] == 1
    assert len(report["findings"]) == 2


def test_feedback_logging(store: SQLiteStore):
    fid = store.save_feedback(
        turn_id="TURN-123",
        reason="wrong_standard",
        comment="Expected IS 17475 instead of IS 2347 for thermal flask",
        rating=2,
    )
    assert fid > 0

    all_fb = store.list_feedback()
    assert len(all_fb) == 1
    assert all_fb[0]["reason"] == "wrong_standard"
