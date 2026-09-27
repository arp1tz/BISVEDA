from fastapi.testclient import TestClient
import pytest
from bisveda.gateway.app import app

client = TestClient(app)


def test_create_and_get_mission():
    payload = {
        "title": "Domestic Cooker Mission Nagpur",
        "product_name": "Domestic Pressure Cooker",
        "category": "Cookers & Utensils",
        "material": "Stainless Steel",
        "grade": "Grade 304",
        "capacity_rating": "5 Litres",
        "intended_use": "Domestic",
        "market_context": "domestic",
        "user_type": "msme",
        "location_city": "Nagpur",
        "location_state": "Maharashtra",
        "pincode": "440001",
    }
    resp = client.post("/api/v8/missions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Domestic Cooker Mission Nagpur"
    assert data["mission_id"].startswith("MSN-")
    assert data["status"] == "draft"
    mission_id = data["mission_id"]

    # Get mission
    resp_get = client.get(f"/api/v8/missions/{mission_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["mission_id"] == mission_id

    # Update step with 3-question explainability
    step_payload = {
        "step": "product_matching",
        "state": "supported",
        "summary": "Matched IS 2347:2017 Domestic Pressure Cookers",
        "why": "Standard IS 2347 covers domestic pressure cookers up to 10 litres capacity",
        "evidence_ids": ["S1"],
        "change_triggers": ["Change to commercial cooker > 10L requires industrial standard"],
    }
    resp_step = client.patch(f"/api/v8/missions/{mission_id}/step", json=step_payload)
    assert resp_step.status_code == 200
    updated_mission = resp_step.json()
    assert "product_matching" in updated_mission["step_states"]
    step_info = updated_mission["step_states"]["product_matching"]
    assert step_info["state"] == "supported"
    assert step_info["explainability"]["why"].startswith("Standard IS 2347")
    assert step_info["explainability"]["evidence_ids"] == ["S1"]

    # List missions
    resp_list = client.get("/api/v8/missions")
    assert resp_list.status_code == 200
    assert resp_list.json()["total"] >= 1

    # Delete mission
    resp_del = client.delete(f"/api/v8/missions/{mission_id}")
    assert resp_del.status_code == 200
    assert resp_del.json()["deleted"] is True

    # Confirm 404 after delete
    resp_404 = client.get(f"/api/v8/missions/{mission_id}")
    assert resp_404.status_code == 404


def test_feedback_api():
    fb_payload = {
        "turn_id": "TURN-TEST-001",
        "reason": "missing_evidence",
        "comment": "Wanted to see full lab testing clauses",
        "rating": 4,
    }
    resp = client.post("/api/v8/feedback", json=fb_payload)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    resp_list = client.get("/api/v8/feedback")
    assert resp_list.status_code == 200
    assert resp_list.json()["total"] >= 1
