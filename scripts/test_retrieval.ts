/**
 * BISVEDA — Knowledge Fabric & Multi-Tier Retrieval Test
 * Verifies all 4 retrieval paths against real ingested document chunks:
 * 1. Exact-first standard number match (e.g., IS 4151, IS 1417)
 * 2. Exact phrase match
 * 3. Keyword / FTS rank search
 * 4. Dense Vector Cosine Similarity (768-dim embeddings)
 * 5. Full retrieveEvidence() hybrid orchestrator
 *
 * Usage:
 *   npx tsx scripts/test_retrieval.ts
 */

import path from "path";
import fs from "fs";

// Load environment variables
const envPaths = [
  path.resolve(process.cwd(), "prototype/.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../prototype/.env"),
  path.resolve(__dirname, "../.env"),
];
for (const ep of envPaths) {
  if (fs.existsSync(ep)) {
    const lines = fs.readFileSync(ep, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

async function testRetrieval() {
  console.log("=" .repeat(75));
  console.log("  BISVEDA — Knowledge Fabric Retrieval Verification");
  console.log("=" .repeat(75));

  const { initDb, searchExactChunks, searchPhraseChunks, searchFtsChunks, searchVectorChunks } = await import(
    "../prototype/src/lib/db"
  );
  const { generateEmbedding } = await import("../prototype/src/lib/embeddings");
  const { retrieveEvidence } = await import("../prototype/src/lib/retrieval");

  await initDb();

  const testResults: { testName: string; pass: boolean; details: string }[] = [];

  // ── Test 1: Exact Standard Search ───────────────────────────────────────────
  console.log("\n[Test 1] Testing Exact Standard Number Matching...");
  const exactQueries = ["IS 4151", "IS 1417", "IS 15644", "IS 2925"];
  let exactAllPassed = true;

  for (const eq of exactQueries) {
    const hits = await searchExactChunks(eq, 3);
    const hasMatch = hits.length > 0;
    if (hasMatch) {
      console.log(`    ✓ ${eq} -> ${hits.length} hit(s). Top: ${hits[0].standard_number} (Clause ${hits[0].clause_number || "Gen"})`);
    } else {
      console.log(`    ✗ ${eq} -> 0 hits`);
      exactAllPassed = false;
    }
  }
  testResults.push({
    testName: "Exact Standard Matching",
    pass: exactAllPassed,
    details: exactAllPassed ? "All target standards found" : "Some standards missing",
  });

  // ── Test 2: Phrase Search ───────────────────────────────────────────────────
  console.log("\n[Test 2] Testing Phrase Substring Search...");
  const phraseQueries = ["Protective Helmets", "Fineness and Marking", "Electric toys"];
  let phraseAllPassed = true;

  for (const pq of phraseQueries) {
    const hits = await searchPhraseChunks(pq, 3);
    const hasMatch = hits.length > 0;
    if (hasMatch) {
      console.log(`    ✓ "${pq}" -> ${hits.length} hit(s). Top: [${hits[0].standard_number}] "${hits[0].text.slice(0, 80).replace(/\n/g, " ")}..."`);
    } else {
      console.log(`    ✗ "${pq}" -> 0 hits`);
      phraseAllPassed = false;
    }
  }
  testResults.push({
    testName: "Phrase Substring Search",
    pass: phraseAllPassed,
    details: phraseAllPassed ? "All phrases located in chunk text" : "Phrase search missed",
  });

  // ── Test 3: Keyword / FTS Search ────────────────────────────────────────────
  console.log("\n[Test 3] Testing Keyword / FTS Ranking...");
  const ftsQueries = ["helmet impact test absorption", "gold fire assay cupellation", "toy battery voltage transformer"];
  let ftsAllPassed = true;

  for (const fq of ftsQueries) {
    const hits = await searchFtsChunks(fq, 3);
    const hasMatch = hits.length > 0;
    if (hasMatch) {
      console.log(`    ✓ "${fq}" -> ${hits.length} hit(s) (Top similarity: ${hits[0].similarity})`);
    } else {
      console.log(`    ✗ "${fq}" -> 0 hits`);
      ftsAllPassed = false;
    }
  }
  testResults.push({
    testName: "Keyword / FTS Search",
    pass: ftsAllPassed,
    details: ftsAllPassed ? "Multi-term keyword search ranked relevant chunks" : "FTS failed",
  });

  // ── Test 4: Dense Vector Search ─────────────────────────────────────────────
  console.log("\n[Test 4] Testing 768-dim Dense Vector Cosine Similarity...");
  const semanticQueries = [
    "head protection requirements for two-wheeler scooter riders",
    "purity testing and marking requirements for gold bullion and jewellery",
  ];
  let vectorAllPassed = true;

  for (const sq of semanticQueries) {
    const vec = await generateEmbedding(sq);
    const hits = await searchVectorChunks(vec, 3, 0.40);
    const hasMatch = hits.length > 0;
    if (hasMatch) {
      console.log(`    ✓ "${sq.slice(0, 45)}..." -> ${hits.length} hit(s) (Top cosine sim: ${hits[0].similarity})`);
      console.log(`       Top match: [${hits[0].standard_number}] ${hits[0].text.slice(0, 100).replace(/\n/g, " ")}...`);
    } else {
      console.log(`    ✗ "${sq.slice(0, 45)}..." -> 0 hits above threshold`);
      vectorAllPassed = false;
    }
  }
  testResults.push({
    testName: "Dense Vector Search",
    pass: vectorAllPassed,
    details: vectorAllPassed ? "Semantic vector search retrieved semantically relevant chunks" : "Vector search failed",
  });

  // ── Test 5: Full Hybrid Evidence Retrieval ──────────────────────────────────
  console.log("\n[Test 5] Testing retrieveEvidence() Sovereign Engine...");
  const hybridQueries = [
    "What are the helmet requirements under IS 4151?",
    "Gold fineness and marking under IS 1417",
    "Safety standards for electric toys IS 15644",
  ];
  let hybridAllPassed = true;

  for (const hq of hybridQueries) {
    const evidenceResult = await retrieveEvidence(hq, 4);
    const hasRecs = evidenceResult.recommendations.length > 0;
    const hasEvidence = evidenceResult.activeEvidence.length > 0;
    const topRec = evidenceResult.recommendations[0];
    const topEv = evidenceResult.activeEvidence[0];

    if (hasRecs && hasEvidence) {
      console.log(`    ✓ Query: "${hq}"`);
      console.log(`       Standard Identified : ${topRec.standardNumber} (${topRec.title})`);
      console.log(`       Evidence Clauses    : ${evidenceResult.activeEvidence.length} clause(s)`);
      console.log(`       Sample Verbatim     : "${topEv.verbatimText.slice(0, 110).replace(/\n/g, " ")}..."`);
    } else {
      console.log(`    ✗ Query: "${hq}" -> Failed to retrieve evidence`);
      hybridAllPassed = false;
    }
  }
  testResults.push({
    testName: "retrieveEvidence() Sovereign Orchestrator",
    pass: hybridAllPassed,
    details: hybridAllPassed ? "Successfully synthesized statutory evidence clauses" : "retrieveEvidence failed",
  });

  // Summary Table
  console.log("\n" + "=" .repeat(75));
  console.log("  Knowledge Fabric Verification Summary");
  console.log("=" .repeat(75));
  for (const r of testResults) {
    const icon = r.pass ? "[PASS]" : "[FAIL]";
    console.log(`  ${icon.padEnd(8)} ${r.testName.padEnd(35)} : ${r.details}`);
  }
  console.log("=" .repeat(75));

  const allPassed = testResults.every((r) => r.pass);
  process.exit(allPassed ? 0 : 1);
}

testRetrieval().catch((err) => {
  console.error("Retrieval test error:", err);
  process.exit(1);
});
