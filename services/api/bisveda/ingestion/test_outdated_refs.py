import sys
from pathlib import Path
api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

import pytest
from fastapi.testclient import TestClient

from bisveda.gateway.app import app
from bisveda.ingestion.outdated_refs import OutdatedReferenceChecker, OutdatedReferenceReport, CitationFinding


client = TestClient(app)


def test_checker_detects_older_edition():
    checker = OutdatedReferenceChecker()
    text = (
        "The contractor shall use high strength deformed steel bars conforming to IS 1786:1985 "
        "for all reinforced concrete structures."
    )
    report = checker.scan_text(text, doc_name="tender_spec.txt")
    
    assert report.total_citations == 1
    assert report.outdated_count == 1
    finding = report.findings[0]
    assert finding.standard_number == "IS 1786"
    assert finding.cited_year == "1985"
    assert finding.current_year == "2008"
    assert finding.status == "older_edition"
    assert "older edition" in finding.action_required.lower()
    assert "IS 1786:1985" in finding.context_snippet


def test_checker_detects_current_edition():
    checker = OutdatedReferenceChecker()
    text = (
        "All domestic pressure cookers supplied must comply with IS 2347:2017 with safety relief valve."
    )
    report = checker.scan_text(text, doc_name="supply_order.txt")
    
    assert report.total_citations == 1
    assert report.outdated_count == 0
    finding = report.findings[0]
    assert finding.standard_number == "IS 2347"
    assert finding.cited_year == "2017"
    assert finding.status == "current"


def test_checker_multiple_citations():
    checker = OutdatedReferenceChecker()
    text = (
        "Tender specifications:\n"
        "1. Rebar: IS 1786:1985 (high strength bars)\n"
        "2. Packaged water: IS 14543:2016 for site canteen\n"
        "3. Pressure vessels: IS 2347:2017\n"
    )
    report = checker.scan_text(text, doc_name="combined_tender.txt")
    assert report.total_citations == 3
    # IS 1786:1985 is older (current 2008)
    # IS 14543:2016 is older (current 2024)
    # IS 2347:2017 is current
    assert report.outdated_count == 2
    statuses = {f.standard_number: f.status for f in report.findings}
    assert statuses["IS 1786"] == "older_edition"
    assert statuses["IS 14543"] == "older_edition"
    assert statuses["IS 2347"] == "current"


def test_documents_review_api_text_flow():
    payload = {
        "text": "The structural design requires TMT steel according to IS 1786:1985.",
        "filename": "civil_works_boq.txt"
    }
    response = client.post("/api/v8/documents/review", data=payload)
    assert response.status_code == 200
    data = response.json()
    assert "report_id" in data
    assert data["doc_name"] == "civil_works_boq.txt"
    assert data["outdated_count"] >= 1
    assert data["findings"][0]["status"] == "older_edition"

    # Test GET retrieval
    report_id = data["report_id"]
    get_res = client.get(f"/api/v8/documents/reports/{report_id}")
    assert get_res.status_code == 200
    stored_data = get_res.json()
    assert stored_data["report_id"] == report_id
    assert stored_data["outdated_count"] == data["outdated_count"]


def test_documents_review_api_empty_rejects():
    response = client.post("/api/v8/documents/review", data={"text": "   "})
    assert response.status_code == 400
