import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from bisveda.gateway.app import app
from bisveda.retrieval.engine import RetrievalEngine
from bisveda.agents.mission_manager import MissionManager
from bisveda.contracts.mission import ComplianceStep, StepEvaluationState
from bisveda.storage.sqlite_store import SQLiteStore

client = TestClient(app)


def test_flagship_water_bottle_nagpur_retrieval():
    """
    Verification Exit Gate (Plan §4.4):
    Flagship query 'stainless-steel water bottles in Nagpur' retrieves IS 17526 Top 1.
    """
    engine = RetrievalEngine()
    results = engine.search("stainless-steel water bottles in Nagpur", limit=5)
    assert len(results) > 0
    top = results[0]
    assert top["standard_number"] == "IS 17526"
    assert top["relevance_score"] >= 0.85


def test_flagship_water_bottle_nagpur_mission():
    """
    Verification Exit Gate (Plan §4.4):
    Flagship query produces complete Compliance Mission with IS 17526,
    mandatory QCO, Scheme-I roadmap, and labs sorted by distance from Nagpur.
    """
    store = SQLiteStore()
    manager = MissionManager(store=store)
    engine = RetrievalEngine()

    query = "stainless-steel water bottles in Nagpur"
    candidates = engine.search(query, limit=5)
    entities = {
        "product": "water bottle",
        "material": "stainless steel",
        "city": "Nagpur",
    }

    mission = manager.create_or_update_mission_for_query(
        query=query,
        candidates=candidates,
        entities=entities,
        user_type="msme",
        origin="Nagpur",
    )

    assert mission.mission_id.startswith("MIS-")
    assert "Water Bottle" in mission.title

    # 1. Product Matching (IS 17526)
    step1 = mission.step_states[ComplianceStep.PRODUCT_MATCHING.value]
    assert step1.state == StepEvaluationState.SUPPORTED
    assert "IS 17526" in step1.summary
    assert step1.explainability is not None
    assert "IS 17526" in step1.explainability.why
    assert len(step1.explainability.change_triggers) >= 2

    # 2. QCO Compliance
    step2 = mission.step_states[ComplianceStep.QCO_COMPLIANCE.value]
    assert step2.state == StepEvaluationState.SUPPORTED
    assert "Mandatory" in step2.summary

    # 3. Technical Requirements
    step3 = mission.step_states[ComplianceStep.TESTING_REQUIREMENTS.value]
    assert step3.state == StepEvaluationState.SUPPORTED
    assert "test parameters" in step3.summary.lower()

    # 4. Lab Identification (sorted from Nagpur)
    step4 = mission.step_states[ComplianceStep.LAB_IDENTIFICATION.value]
    assert step4.state == StepEvaluationState.SUPPORTED
    assert "closest" in step4.summary.lower()
    assert "km" in step4.summary.lower()

    # 5. Certification Route (80% MSME concession)
    step5 = mission.step_states[ComplianceStep.CERTIFICATION_ROUTE.value]
    assert step5.state == StepEvaluationState.CANDIDATE
    assert "80% MSME fee concession" in step5.summary


def test_flagship_water_bottle_nagpur_dossier_and_stream():
    """
    Test Step 3: SSE Streaming /api/v8/query emits real sequential StageEvents
    and emits the complete ComplianceDossier for stainless-steel water bottles.
    """
    payload = {
        "query": "stainless-steel water bottles in Nagpur",
        "user_type": "msme",
        "language": "en",
        "market": "domestic",
        "entities": {"product": "water bottle", "material": "stainless steel", "city": "Nagpur"},
    }

    # Synchronous endpoint test
    res = client.post("/api/v8/dossier", json=payload)
    assert res.status_code == 200
    dossier = res.json()
    assert len(dossier["standards"]) > 0
    assert dossier["standards"][0]["is_number"] == "IS 17526"
    assert dossier["standards"][0]["applicability"] == "directly_applicable"

    # Streaming SSE test
    with client.stream("POST", "/api/v8/query", json=payload) as response:
        assert response.status_code == 200
        lines = [line for line in response.iter_lines() if line.startswith("data: ")]
        assert len(lines) >= 6  # At least Understand, Retrieve, Adjudicate, Generate, Trust, Dossier
