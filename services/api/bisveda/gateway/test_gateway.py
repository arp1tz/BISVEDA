import json
from pathlib import Path
import sys

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from fastapi.testclient import TestClient
from bisveda.gateway.app import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v8/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["taxonomy_valid"] is True
    assert data["version"] == "8.0.0"
    print("Health endpoint verified!")

def test_standards_search_endpoint():
    response = client.get("/api/v8/standards?q=pressure+cooker")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    top_std = data["standards"][0]
    assert "2347" in (top_std.get("standard_number") or top_std.get("is_number"))
    print(f"Standards search verified: found {top_std.get('standard_number')}")

def test_labs_endpoint():
    response = client.get("/api/v8/labs?city=Noida")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    print(f"Labs search verified: found {data['total']} labs in Noida")

def test_qcos_endpoint():
    response = client.get("/api/v8/qcos?q=pressure+cooker")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    print(f"QCO endpoint verified: found {data['total']} QCO records")

def test_sync_dossier_endpoint():
    payload = {
        "query": "domestic pressure cooker stainless steel",
        "user_type": "msme",
        "language": "en",
        "entities": {"product": "pressure cooker", "material": "stainless steel"}
    }
    response = client.post("/api/v8/dossier", json=payload)
    assert response.status_code == 200
    dossier = response.json()
    assert dossier["standards"][0]["is_number"] == "IS 2347"
    assert dossier["certification_route"]["indicative_fee"]["msme_subsidy_percentage"] == 80
    assert dossier["trust"]["grounding_state"] == "verified"
    print("Synchronous Dossier endpoint verified!")

def test_streaming_query_endpoint():
    payload = {
        "query": "domestic pressure cooker stainless steel",
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

    stages_started = [e.get("stage") for e in events if e.get("event") == "stage.started"]
    stages_completed = [e.get("stage") for e in events if e.get("event") == "stage.completed"]
    dossier_events = [e for e in events if e.get("type") == "dossier"]

    assert "understand" in stages_started and "understand" in stages_completed
    assert "retrieve" in stages_started and "retrieve" in stages_completed
    assert "adjudicate" in stages_started and "adjudicate" in stages_completed
    assert "generate" in stages_started and "generate" in stages_completed
    assert "trust" in stages_started and "trust" in stages_completed
    assert len(dossier_events) == 1
    assert dossier_events[0]["dossier"]["standards"][0]["is_number"] == "IS 2347"
    print("SSE Streaming endpoint verified: Real stage events emitted sequentially!")

if __name__ == "__main__":
    test_health_endpoint()
    test_standards_search_endpoint()
    test_labs_endpoint()
    test_qcos_endpoint()
    test_sync_dossier_endpoint()
    test_streaming_query_endpoint()
    print("All FastAPI Gateway integration tests passed successfully!")
