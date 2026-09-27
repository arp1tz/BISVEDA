async function testPhase3() {
  console.log("=== 1. Test GET /api/v8/documents ===");
  const docsRes = await fetch("http://localhost:3000/api/v8/documents");
  const docsData = await docsRes.json();
  console.log("Status:", docsRes.status, "Total docs:", docsData.total);
  if (docsData.documents && docsData.documents.length > 0) {
    const first = docsData.documents[0];
    console.log("Sample doc:", {
      id: first.id,
      standardNumber: first.standardNumber,
      rootStandard: first.rootStandard,
      editionYear: first.editionYear,
      status: first.status,
    });
  }

  console.log("\n=== 2. Test PUT /api/v8/documents/[id] (Create/Update Version) ===");
  const testId = "test_doc_edition_test";
  const putRes = await fetch(`http://localhost:3000/api/v8/documents/${testId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document: {
        id: testId,
        title: "Test Protective Helmets (2025 Revision)",
        standard_number: "IS 4151:2025",
        root_standard: "IS 4151",
        edition_year: "2025",
        version: "5.0",
        amendment: "Amd 1",
        status: "published",
        knowledge_tier: "B",
        page_count: 24,
      },
      chunks: [
        {
          chunkId: `${testId}_c1`,
          documentId: testId,
          standardNumber: "IS 4151:2025",
          clauseNumber: "1.1",
          clauseTitle: "Scope & Impact Resistance",
          text: "Helmet testing clause under IS 4151:2025 edition.",
          pageNumbers: [1],
          isActive: true,
        },
      ],
    }),
  });
  console.log("PUT status:", putRes.status);
  const putData = await putRes.json();
  console.log("PUT result:", putData);

  console.log("\n=== 3. Verify Created Document in GET ===");
  const verifyRes = await fetch(`http://localhost:3000/api/v8/documents`);
  const verifyData = await verifyRes.json();
  const foundTest = verifyData.documents.find((d) => d.id === testId);
  console.log("Found newly created version:", foundTest ? "YES" : "NO", foundTest);

  console.log("\n=== 4. Test DELETE /api/v8/documents/[id] (Purge Document) ===");
  const delRes = await fetch(`http://localhost:3000/api/v8/documents/${testId}`, {
    method: "DELETE",
  });
  console.log("DELETE status:", delRes.status);
  const delData = await delRes.json();
  console.log("DELETE response:", delData);

  console.log("\n=== 5. Verify Document is Purged ===");
  const afterDelRes = await fetch(`http://localhost:3000/api/v8/documents`);
  const afterDelData = await afterDelRes.json();
  const stillExists = afterDelData.documents.find((d) => d.id === testId);
  console.log("Still exists in catalog:", stillExists ? "YES (FAIL)" : "NO (SUCCESS - PURGED)");

  console.log("\n=== 6. Test Quarantine Scanner ===");
  const scanRes = await fetch("http://localhost:3000/api/v8/ingest/quarantine/scan/MED-Q8192", {
    method: "POST",
  });
  console.log("Scan status:", scanRes.status);
  const scanData = await scanRes.json();
  console.log("Scan result:", scanData.audit_verdict);

  console.log("\n=== All Phase 3 Backend Tests Complete ===");
}

testPhase3().catch(console.error);
