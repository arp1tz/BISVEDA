import json
from pathlib import Path
import sys

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

import pytest
from fastapi.testclient import TestClient

from bisveda.gateway.app import app
from bisveda.retrieval.fts_engine import FTSRetrievalEngine
from bisveda.adjudication.adjudicator import EvidenceAdjudicator
from bisveda.generation.llm_client import MultiProviderLLMClient
from bisveda.trust.trust_gate import TrustGate
from bisveda.orchestration.dossier_builder import DossierBuilder
from bisveda.contracts.adjudication import ApplicabilityClass, GroundingState, KnowledgeTier

client = TestClient(app)


def test_flagship_fts_retrieval_cooker():
    """
    Test Step 1: SQLite FTS5 Engine retrieves IS 2347 Top 1 with clause chunks.
    """
    engine = FTSRetrievalEngine()
    results = engine.search("domestic pressure cookers stainless steel", limit=5)

    assert len(results) > 0, "No retrieval results returned"
    top = results[0]
    assert top["standard_number"] == "IS 2347", f"Expected IS 2347, got {top.get('standard_number')}"
    assert top["relevance_score"] >= 0.95, f"Expected relevance >= 0.95, got {top['relevance_score']}"
    assert "fts5_bm25" in top["search_channels"]
    assert "matched_clauses" in top and len(top["matched_clauses"]) > 0


def test_flagship_end_to_end_dossier():
    """
    Test Step 2: Full synchronous dossier pipeline returns IS 2347,
    real statutory testing clauses, and 80% MSME subsidy.
    """
    payload = {
        "query": "domestic pressure cookers stainless steel",
        "user_type": "msme",
        "language": "en",
        "market": "domestic",
        "entities": {"product": "pressure cooker", "material": "stainless steel"}
    }
    response = client.post("/api/v8/dossier", json=payload)
    assert response.status_code == 200, f"Dossier failed with {response.status_code}: {response.text}"

    dossier = response.json()

    # 1. Primary Standard Check
    assert len(dossier["standards"]) > 0
    primary_std = dossier["standards"][0]
    assert primary_std["is_number"] == "IS 2347"
    assert primary_std["applicability"] == "directly_applicable"
    assert primary_std["tier"] == "C"

    # 2. Regulatory QCO Check
    assert dossier["regulatory"]["qco_status"] == "mandatory"
    assert "Pressure Cooker" in (dossier["regulatory"]["order_reference"] or "")
    assert "Section 29" in dossier["regulatory"]["penal_provision"]

    # 3. Certification Route & 80% MSME Subsidy Check
    cert = dossier["certification_route"]
    assert "Scheme-I" in cert["scheme_name"]
    assert "30-Day MSME" in cert["eligibility_result"]
    assert cert["indicative_fee"]["msme_subsidy_percentage"] == 80
    assert cert["indicative_fee"]["application_fee_inr"] == 200
    assert cert["indicative_fee"]["audit_fee_per_day_inr"] == 1400

    # 4. Mandatory Testing Clauses Check
    testing = dossier["testing"]
    assert testing["tier_permits_testing"] is True
    assert len(testing["clauses"]) >= 2
    clause_texts = " ".join(c["description"] for c in testing["clauses"]).lower()
    assert "pressure" in clause_texts or "valve" in clause_texts or "bursting" in clause_texts

    # 5. Trust Gate & Citations
    trust = dossier["trust"]
    assert trust["grounding_state"] == "verified"
    assert trust["confidence_label"] == "verified_evidence"
    assert trust["relevance_score"] >= 0.95

    # 6. Summary Text Check
    assert "IS 2347" in dossier["summary"]
    assert "80%" in dossier["summary"]


def test_flagship_sse_streaming_stages():
    """
    Test Step 3: SSE Streaming /api/v8/query emits real sequential StageEvents
    and emits the complete ComplianceDossier.
    """
    payload = {
        "query": "domestic pressure cookers stainless steel",
        "user_type": "msme",
    }
    with client.stream("POST", "/api/v8/query", json=payload) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                raw_json = line[6:]
                event_data = json.loads(raw_json)
                events.append(event_data)

    # Validate stages
    stages_started = [e.get("stage") for e in events if e.get("event") == "stage.started"]
    stages_completed = [e.get("stage") for e in events if e.get("event") == "stage.completed"]

    for expected_stage in ["understand", "retrieve", "adjudicate", "generate", "trust"]:
        assert expected_stage in stages_started, f"Missing stage.started for {expected_stage}"
        assert expected_stage in stages_completed, f"Missing stage.completed for {expected_stage}"

    # Validate emitted dossier
    dossier_events = [e for e in events if e.get("type") == "dossier"]
    assert len(dossier_events) == 1, "Expected exactly 1 dossier event emitted"
    dossier = dossier_events[0]["dossier"]

    assert dossier["standards"][0]["is_number"] == "IS 2347"
    assert dossier["certification_route"]["indicative_fee"]["msme_subsidy_percentage"] == 80
    assert len(dossier["testing"]["clauses"]) > 0


if __name__ == "__main__":
    test_flagship_fts_retrieval_cooker()
    test_flagship_end_to_end_dossier()
    test_flagship_sse_streaming_stages()
    print("All Flagship Pressure Cooker tests passed successfully!")
