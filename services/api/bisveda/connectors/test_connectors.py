from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from bisveda.connectors.registry import ConnectorRegistry
from bisveda.retrieval.geocoder import LocalPINCentroidGeocoder, haversine_km
from bisveda.gateway.app import app

client = TestClient(app)


def test_haversine_distance():
    # Nagpur (21.1458, 79.0882) to Mumbai (18.9388, 72.8354) is ~680-700 km
    dist = haversine_km(21.1458, 79.0882, 18.9388, 72.8354)
    assert 650.0 < dist < 750.0


def test_geocoder_pin_and_city():
    geocoder = LocalPINCentroidGeocoder()

    # By PIN
    coords_pin = geocoder.geocode("440001")
    assert coords_pin is not None
    assert round(coords_pin[0], 2) == 21.15
    assert round(coords_pin[1], 2) == 79.09

    # By City Name
    coords_city = geocoder.geocode("Nagpur")
    assert coords_city is not None
    assert coords_city == coords_pin

    # Unknown PIN
    assert geocoder.geocode("999999") is None


def test_geocoder_lab_sorting():
    geocoder = LocalPINCentroidGeocoder()
    sample_labs = [
        {"name": "Delhi Lab", "lat": 28.6139, "lng": 77.2090, "city": "Delhi"},
        {"name": "Nagpur Lab", "lat": 21.1458, "lng": 79.0882, "city": "Nagpur"},
        {"name": "Mumbai Lab", "lat": 18.9388, "lng": 72.8354, "city": "Mumbai"},
    ]

    # Sort from Nagpur PIN 440001
    sorted_labs = geocoder.sort_labs_by_distance(sample_labs, "440001")
    assert sorted_labs[0]["name"] == "Nagpur Lab"
    assert sorted_labs[0]["distance_km"] == 0.0
    assert sorted_labs[1]["name"] in ("Mumbai Lab", "Delhi Lab")


def test_connector_registry_and_snapshots(tmp_path: Path):
    reg = ConnectorRegistry(snapshot_dir=tmp_path)
    sources = reg.list_sources()
    assert len(sources) >= 5

    # Run sync with snapshot export
    sync_results = reg.sync_all(export_snapshots=True)
    assert "catalogue" in sync_results
    assert sync_results["catalogue"]["records_count"] >= 100
    assert (tmp_path / "catalogue_latest.json").exists()

    assert "laboratories" in sync_results
    assert sync_results["laboratories"]["records_count"] >= 400


def test_sources_api_endpoints():
    # 1. /api/v8/sources
    resp = client.get("/api/v8/sources")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 5

    # 2. /api/v8/labs with PIN code distance calculation
    resp_labs = client.get("/api/v8/labs?pin=440001&limit=5")
    assert resp_labs.status_code == 200
    labs_data = resp_labs.json()
    assert labs_data["origin"] == "440001"
    assert len(labs_data["labs"]) > 0
    # Top lab near Nagpur should have distance_km populated
    first_lab = labs_data["labs"][0]
    assert "distance_km" in first_lab
    assert first_lab["distance_km"] is not None

    # 3. /api/v8/updates
    resp_upd = client.get("/api/v8/updates")
    assert resp_upd.status_code == 200
    assert resp_upd.json()["total"] >= 1

    # 4. /api/v8/faqs
    resp_faq = client.get("/api/v8/faqs")
    assert resp_faq.status_code == 200
    assert resp_faq.json()["total"] >= 1
