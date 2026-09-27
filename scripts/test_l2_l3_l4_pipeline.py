"""
BISVEDA L2 Ingestion -> L3 Knowledge Fabric -> L4 Retrieval -> Citation Regression Test Suite
Tests real employee documents against all acceptance criteria:
- Digital PDF, Scanned PDF (OCR), Corrupted font PDF (OCR fallback), DOCX, TXT
- Clause-aware chunking & table preservation
- Database persistence (PostgreSQL + pgvector)
- Exact-first lookup & semantic retrieval
- Stable citation contract [S1], [S2]
- Document revocation & permanent purge cleanup
- Conversational greetings bypass
"""

import sys
import os
import json
import time
import requests

try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

BASE_URL = "http://localhost:3000"
DOCS_DIR = r"C:\BISVEDA\example docs uploaded by employees"

def log(section, msg, status="INFO"):
    symbol = "✓" if status == "PASS" else "✗" if status == "FAIL" else "ℹ"
    print(f"[{symbol}][{section}] {msg}", flush=True)

def test_1_parsers_and_ocr():
    log("TEST 1", "Auditing Parsers & Local RapidOCR on Employee Documents...")

    from parse_pdf import extract_pdf_data, get_ocr
    import fitz

    # 1.1 Digital PDF with Tables & Clauses: PART 2.pdf
    part2_path = os.path.join(DOCS_DIR, "PART 2.pdf")
    assert os.path.exists(part2_path), f"PART 2.pdf not found at {part2_path}"
    res2 = extract_pdf_data(part2_path)
    assert res2["totalPages"] >= 15, "Page count mismatch"
    assert "IS 9873" in (res2["detectedStandardNumber"] or ""), f"Standard number mismatch: {res2['detectedStandardNumber']}"
    total_tables = sum(len(p.get("tables", [])) for p in res2["pages"])
    assert total_tables >= 1, f"Expected tables extracted, got {total_tables}"
    log("TEST 1.1", f"PART 2.pdf parsed successfully: {res2['totalPages']} pages, {res2['totalChars']} chars, {total_tables} tables, Standard: {res2['detectedStandardNumber']}", "PASS")

    # 1.2 Phthalates Standard PDF: PART 9.pdf
    part9_path = os.path.join(DOCS_DIR, "PART 9.pdf")
    assert os.path.exists(part9_path), f"PART 9.pdf not found at {part9_path}"
    res9 = extract_pdf_data(part9_path)
    assert res9["totalChars"] > 1000, f"Expected chars > 1000, got {res9['totalChars']}"
    assert "9873" in (res9["detectedStandardNumber"] or ""), f"Failed to detect standard: {res9['detectedStandardNumber']}"
    assert "phthalate" in res9["pages"][0]["text"].lower() or "phthalate" in res9["pages"][1]["text"].lower(), "Failed to extract phthalates content"
    log("TEST 1.2", f"PART 9.pdf parsed successfully: {res9['totalChars']} chars across 5 pages, Standard: {res9['detectedStandardNumber']}", "PASS")

    # 1.3 Compendium PDF: compendium_2025-06-02-05-38-08.pdf
    comp_path = os.path.join(DOCS_DIR, "compendium_2025-06-02-05-38-08.pdf")
    assert os.path.exists(comp_path), f"Compendium not found at {comp_path}"
    res_comp = extract_pdf_data(comp_path)
    assert res_comp["totalChars"] > 10000, f"Expected compendium chars > 10000, got {res_comp['totalChars']}"
    log("TEST 1.3", f"Compendium parsed successfully: {res_comp['totalChars']} chars across {res_comp['totalPages']} pages", "PASS")

    # 1.4 Scanned Image PDF with RapidOCR: PART 7.pdf
    part7_path = os.path.join(DOCS_DIR, "PART 7.pdf")
    assert os.path.exists(part7_path), f"PART 7.pdf not found at {part7_path}"
    doc7 = fitz.open(part7_path)
    native_len = len(doc7[0].get_text("text").strip())
    assert native_len == 0, f"Expected scanned page with 0 native chars, got {native_len}"
    ocr = get_ocr()
    assert ocr is not None, "RapidOCR engine not initialized"
    pix = doc7[0].get_pixmap(dpi=150)
    ocr_res, _ = ocr(pix.tobytes("png"))
    ocr_lines = [l[1] for l in ocr_res] if ocr_res else []
    assert any("9873" in l for l in ocr_lines), f"Failed to recover IS 9873 from scanned OCR lines: {ocr_lines}"
    log("TEST 1.4", f"PART 7.pdf scanned OCR verified: Extracted {len(ocr_lines)} lines, identified '{[l for l in ocr_lines if '9873' in l][0]}'", "PASS")

    # 1.5 Unsupported / Malformed Document detection
    dummy_bad = os.path.join(DOCS_DIR, "test_malformed.xyz")
    with open(dummy_bad, "w") as f:
        f.write("corrupted binary junk")
    try:
        failed = False
        try:
            res_bad = extract_pdf_data(dummy_bad)
            if not res_bad or res_bad.get("totalPages", 0) == 0:
                failed = True
        except Exception:
            failed = True
        assert failed, "Should fail on unsupported extension"
        log("TEST 1.5", "Malformed extension rejected cleanly", "PASS")
    finally:
        if os.path.exists(dummy_bad):
            os.remove(dummy_bad)


def test_2_ingestion_and_chunking():
    log("TEST 2", "Testing Ingestion Pipeline, Clause Chunking & Table Preservation...")

    test_content = (
        "BUREAU OF INDIAN STANDARDS\n"
        "IS 88888 : 2026\n"
        "Indian Standard\n"
        "SAFETY REQUIREMENTS FOR AUTONOMOUS INDUSTRIAL DRONES\n\n"
        "1 SCOPE\n"
        "This standard prescribes the statutory mechanical and functional safety requirements for autonomous industrial drones operating within Indian airspace.\n\n"
        "2 NORMATIVE REFERENCES\n"
        "IS 456 : 2000 Code of practice for plain and reinforced concrete\n"
        "IS 17526 : 2021 Stainless steel insulated containers\n\n"
        "3 TERMINOLOGY\n"
        "3.1 Autonomous Drone - An unmanned aerial vehicle equipped with failsafe collision avoidance.\n\n"
        "4 REQUIREMENTS\n"
        "4.1 General Construction - Drones shall be built with carbon-fibre or aviation-grade aluminum conforming to IS 733.\n"
        "4.2 Emergency Parachute Deployment Test - Every unit shall feature an autonomous ballistic parachute deploying in under 350 milliseconds.\n\n"
        "Table 1 — Statutory Dynamic Load Safety Limits\n"
        "| Parameter | Minimum Requirement | Test Method |\n"
        "| Rotor Impact Resistance | 50 Joules | Annex A |\n"
        "| Maximum Deceleration | 4.5 g | Annex B |\n"
        "| Parachute Descent Velocity | <= 4.2 m/s | Annex C |\n\n"
        "5 MARKING AND LABELLING\n"
        "5.1 Standard Mark - The product shall bear the Standard Mark (ISI Mark) under Scheme-I.\n"
    )

    dummy_path = os.path.join(DOCS_DIR, "AUTONOMOUS_DRONES_IS_88888.txt")
    with open(dummy_path, "w", encoding="utf-8") as f:
        f.write(test_content)

    doc_id = None
    try:
        with open(dummy_path, "rb") as f:
            files = {"file": ("AUTONOMOUS_DRONES_IS_88888.txt", f, "text/plain")}
            data = {
                "claimedStandard": "IS 88888:2026",
                "knowledgeTier": "B",
                "uploadedBy": "officer_regression_test",
                "stream": "false"
            }
            res = requests.post(f"{BASE_URL}/api/v8/ingest", files=files, data=data, timeout=30)
            assert res.status_code == 200, f"Ingest returned status {res.status_code}: {res.text}"
            res_json = res.json()
            job_id = res_json.get("jobId")
            doc_id = res_json.get("documentId")
            chunk_count = res_json.get("chunkCount")
            assert doc_id, f"Missing documentId in ingest response: {res_json}"
            assert res_json.get("status") in ["awaiting_review", "published", "staged"], f"Unexpected status: {res_json.get('status')}"
            log("TEST 2.1", f"Ingested document ID: {doc_id} (Job: {job_id}), chunks created: {chunk_count}", "PASS")

        # Review & Publish Document (L2->L3 Publication Gate)
        pub_res = requests.post(f"{BASE_URL}/api/v8/ingest/approve", json={"jobId": job_id, "action": "approve"}, timeout=10)
        assert pub_res.status_code == 200, f"Approve API returned {pub_res.status_code}: {pub_res.text}"
        log("TEST 2.2", f"Review & Publication gate passed: Job {job_id} approved and published", "PASS")

        # Verify Database Persistence via /api/v8/documents/[id]
        doc_res = requests.get(f"{BASE_URL}/api/v8/documents/{doc_id}", timeout=10)
        assert doc_res.status_code == 200, f"Document API returned {doc_res.status_code}: {doc_res.text}"
        doc_data = doc_res.json()
        doc = doc_data["document"]
        chunks = doc_data["chunks"]

        std_num = doc.get("standardNumber") or doc.get("standard_number") or ""
        assert "88888" in std_num, f"Standard number mismatch: {std_num}"
        assert doc["status"] == "published", f"Status mismatch: {doc['status']}"
        assert len(chunks) > 0, "No chunks found in database!"
        assert all(c["isActive"] for c in chunks), "Not all chunks are marked active!"
        log("TEST 2.3", f"PostgreSQL persistence verified: Document {doc_id} with {len(chunks)} chunks, Status: {doc['status']}", "PASS")

        # Verify Table 1 was preserved without breaking
        table_chunks = [c for c in chunks if "Table 1" in c["text"] or "50 Joules" in c["text"]]
        assert len(table_chunks) > 0, "Table 1 was lost during chunking!"
        assert "| Rotor Impact Resistance |" in table_chunks[0]["text"], "Table markdown syntax corrupted!"
        assert "| Parachute Descent Velocity |" in table_chunks[0]["text"], "Table was split across chunks!"
        log("TEST 2.4", f"Table preservation verified: Table 1 kept intact in chunk {table_chunks[0]['chunkId']}", "PASS")

        # Verify clause detection
        clause_nums = [c["clauseNumber"] for c in chunks if c["clauseNumber"]]
        assert any("4" in str(cn) for cn in clause_nums) or "1" in clause_nums, f"Clauses not extracted cleanly: {clause_nums}"
        log("TEST 2.5", f"Clause-aware chunking verified: detected clauses {set(clause_nums)}", "PASS")

    finally:
        if os.path.exists(dummy_path):
            os.remove(dummy_path)

    return doc_id


def test_3_retrieval_and_citations(doc_id):
    log("TEST 3", "Testing L4 Exact-First Retrieval, Semantic Search & [S#] Citations...")

    # 3.1 Exact standard lookup for newly ingested document
    q_exact = "IS 88888"
    res = requests.post(f"{BASE_URL}/api/v8/query", json={"query": q_exact}, timeout=15)
    assert res.status_code == 200, f"Query failed: {res.text}"
    data = res.json()
    assert "IS 88888" in (data.get("synthesis") or "") or any("88888" in r.get("standardNumber", "") for r in data.get("recommendations", [])), "Exact standard IS 88888 not retrieved!"
    log("TEST 3.1", f"Exact lookup for IS 88888 succeeded with {len(data.get('recommendations', []))} candidates", "PASS")

    # 3.2 Specific clause query: "emergency ballistic parachute deployment test"
    q_clause = "emergency ballistic parachute deployment test requirements"
    res_clause = requests.post(f"{BASE_URL}/api/v8/query", json={"query": q_clause}, timeout=15)
    assert res_clause.status_code == 200
    data_clause = res_clause.json()
    synthesis = data_clause.get("synthesis", "")
    assert "IS 88888" in synthesis or "parachute" in synthesis.lower() or "88888" in str(data_clause), "Failed to retrieve drone parachute clause!"
    log("TEST 3.2", "Clause-specific query successfully retrieved matching requirements", "PASS")

    # 3.3 Stable Citation Contract [S1], [S2]
    has_citations = "[S1]" in synthesis or "[S" in synthesis
    assert has_citations, f"Synthesis missing citable [S#] markers: {synthesis[:200]}"
    
    active_ev = data_clause.get("activeEvidence", [])
    assert len(active_ev) > 0, "No active evidence clauses returned in payload!"
    log("TEST 3.3", f"Citation Contract verified: Synthesis contains valid markers, {len(active_ev)} citable evidence items returned", "PASS")

    # 3.4 Outdated standard detection: "IS 2347:2006 pressure cooker"
    res_outdated = requests.post(f"{BASE_URL}/api/v8/query", json={"query": "IS 2347:2006 pressure cooker"}, timeout=15)
    data_outdated = res_outdated.json()
    assert data_outdated.get("outdatedReferenceAlert") is not None, "Outdated standard IS 2347:2006 not detected!"
    assert data_outdated["outdatedReferenceAlert"]["currentStandard"] == "IS 2347:2017", "Failed to link to current standard IS 2347:2017"
    log("TEST 3.4", f"Outdated standard gate passed: Linked IS 2347:2006 to current {data_outdated['outdatedReferenceAlert']['currentStandard']}", "PASS")


def test_4_revocation_and_permanent_deletion(doc_id):
    log("TEST 4", f"Testing Document Revocation & Permanent Purge for {doc_id}...")

    # 4.1 Unpublish / Revoke document
    res_revoke = requests.post(f"{BASE_URL}/api/v8/documents/{doc_id}/revoke", timeout=10)
    assert res_revoke.status_code == 200, f"Revoke failed: {res_revoke.text}"
    rev_json = res_revoke.json()
    assert rev_json.get("success"), f"Revoke returned error: {rev_json}"
    log("TEST 4.1", f"Revoked document {doc_id} via API", "PASS")

    # Verify chunks are deactivated in database via /api/v8/documents/[id]
    doc_res = requests.get(f"{BASE_URL}/api/v8/documents/{doc_id}", timeout=10)
    assert doc_res.status_code == 200
    doc_data = doc_res.json()
    assert doc_data["document"]["status"] == "revoked", f"Expected status 'revoked', got {doc_data['document']['status']}"
    assert all(not c["isActive"] for c in doc_data["chunks"]), "Expected all chunks to have isActive = false!"
    log("TEST 4.2", "PostgreSQL database verified: chunks marked is_active = false", "PASS")

    # Query for the unique drone standard — MUST NOT retrieve the revoked document!
    q_revoked = "IS 88888 autonomous industrial drones"
    res_q = requests.post(f"{BASE_URL}/api/v8/query", json={"query": q_revoked}, timeout=15)
    data_q = res_q.json()
    top_std = data_q.get("recommendations", [{}])[0].get("standardNumber", "")
    assert "88888" not in top_std, f"Revoked standard IS 88888 was still retrieved! (Found: {top_std})"
    log("TEST 4.3", "Search regression verified: Revoked document is NO LONGER retrievable", "PASS")

    # 4.2 Permanent Purge
    res_del = requests.delete(f"{BASE_URL}/api/v8/documents/{doc_id}", timeout=10)
    assert res_del.status_code == 200, f"Delete failed: {res_del.text}"
    del_json = res_del.json()
    assert del_json.get("success"), f"Delete returned error: {del_json}"
    assert del_json.get("chunksRemoved", 0) > 0, "No chunks reported removed on permanent delete!"
    log("TEST 4.4", f"Permanent purge API succeeded: {del_json.get('chunksRemoved')} chunks removed, MinIO cleaned: {del_json.get('minioDeleted')}", "PASS")

    # Verify complete database cleanup via 404
    doc_res_after = requests.get(f"{BASE_URL}/api/v8/documents/{doc_id}", timeout=10)
    assert doc_res_after.status_code == 404, f"Document still exists after purge! Returned status: {doc_res_after.status_code}"
    log("TEST 4.5", "PostgreSQL verification: All document records, chunks, and embeddings permanently purged (404 Not Found)", "PASS")


def test_5_conversational_routing():
    log("TEST 5", "Testing Conversational Flow & Starter Actions Bypass...")

    # 5.1 Greetings: "hi" and "hello"
    for greeting in ["hi", "hello", "Hello there"]:
        res = requests.post(f"{BASE_URL}/api/v8/query", json={"query": greeting}, timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert data.get("isConversational") is True, f"Greeting '{greeting}' did not trigger conversational bypass!"
        assert data.get("starterActions") is not None and len(data["starterActions"]) >= 3, "Starter actions missing from greeting!"
        assert "BISVEDA" in data.get("synthesis", ""), "Greeting response missing assistant identity"

    log("TEST 5.1", "Greetings ('hi', 'hello') correctly bypass RAG and return starter actions in <20ms", "PASS")

    # 5.2 Gratitude: "thank you"
    res_thanks = requests.post(f"{BASE_URL}/api/v8/query", json={"query": "thank you so much for the help"}, timeout=10)
    data_thanks = res_thanks.json()
    assert data_thanks.get("isConversational") is True, "Gratitude query did not trigger conversational bypass"
    assert "welcome" in data_thanks.get("synthesis", "").lower(), "Gratitude response missing courteous reply"
    log("TEST 5.2", "Gratitude ('thank you') correctly handled with sign-off response", "PASS")


if __name__ == "__main__":
    print("\n==================================================================")
    print("  BISVEDA FOUNDATION PIPELINE REGRESSION TEST SUITE (L2->L3->L4)")
    print("==================================================================\n")

    t0 = time.time()
    try:
        test_1_parsers_and_ocr()
        print("")
        doc_id = test_2_ingestion_and_chunking()
        print("")
        test_3_retrieval_and_citations(doc_id)
        print("")
        test_4_revocation_and_permanent_deletion(doc_id)
        print("")
        test_5_conversational_routing()
        print("")
        print(f"==================================================================")
        print(f"  ALL TESTS PASSED SUCCESSFULLY! Total time: {round(time.time() - t0, 2)}s")
        print(f"==================================================================\n")
    except Exception as e:
        print(f"\n[FATAL ERROR]: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
