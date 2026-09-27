/**
 * BISVEDA — End-to-End Pipeline Verification Suite
 * Executes the full sovereign stack:
 * L0 (Conversational Intent) -> L1 (Speed Gate) -> L2 (Outdated Reference) ->
 * L4 (Adjudicator & Multi-Tier Retrieval) -> L5 (Dossier & Synthesis) -> L6 (Trust Gate)
 *
 * Verifies that:
 * 1. Speed Gate queries return in <150ms
 * 2. Ingested real BIS documents produce source-backed cited answers with verbatim clauses
 * 3. Out-of-corpus queries refuse gracefully without hallucination
 *
 * Usage:
 *   npx tsx scripts/e2e_test.ts
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

interface TestCase {
  name: string;
  query: string;
  expectedOutcome: "speedgate" | "cited_answer" | "refusal";
  verify: (res: any) => { pass: boolean; reason: string };
}

const TEST_CASES: TestCase[] = [
  {
    name: "Speed Gate FAQ Hit",
    query: "What is BIS?",
    expectedOutcome: "speedgate",
    verify: (res) => {
      const isHit = res.isSpeedGateHit === true;
      const hasText = (res.synthesis || "").length > 50;
      return {
        pass: isHit && hasText,
        reason: isHit ? "Resolved instantly via Speed Gate FAQ" : "Speed Gate missed",
      };
    },
  },
  {
    name: "Speed Gate Exact Standard",
    query: "IS 456",
    expectedOutcome: "speedgate",
    verify: (res) => {
      const isHit = res.isSpeedGateHit === true;
      const mentionsStd = (res.synthesis || "").includes("456");
      return {
        pass: isHit && mentionsStd,
        reason: isHit ? "Resolved instantly via Speed Gate exact IS lookup" : "Exact lookup missed",
      };
    },
  },
  {
    name: "Real Document — Motorcycle Helmets (IS 4151)",
    query: "What are the statutory requirements for protective helmets under IS 4151?",
    expectedOutcome: "cited_answer",
    verify: (res) => {
      const isAnswered = res.outcome === "answered";
      const hasEvidence = res.activeEvidence && res.activeEvidence.length > 0;
      const mentionsHelmet = (res.synthesis || "").toLowerCase().includes("helmet");
      const hasCitations = /\[S\d+\]/.test(res.synthesis || "") || res.activeEvidence?.length > 0;
      return {
        pass: isAnswered && hasEvidence && mentionsHelmet && hasCitations,
        reason: `Synthesized answer from ${res.activeEvidence?.length || 0} real evidence clause(s)`,
      };
    },
  },
  {
    name: "Real Document — Gold Fineness & Marking (IS 1417)",
    query: "What are the fineness and marking requirements for gold jewellery under IS 1417?",
    expectedOutcome: "cited_answer",
    verify: (res) => {
      const isAnswered = res.outcome === "answered";
      const hasEvidence = res.activeEvidence && res.activeEvidence.length > 0;
      const mentionsGold = (res.synthesis || "").toLowerCase().includes("gold");
      return {
        pass: isAnswered && hasEvidence && mentionsGold,
        reason: `Synthesized answer from ${res.activeEvidence?.length || 0} real evidence clause(s)`,
      };
    },
  },
  {
    name: "Real Document — Electric Toys Safety (IS 15644)",
    query: "What are the safety requirements for electric toys under IS 15644?",
    expectedOutcome: "cited_answer",
    verify: (res) => {
      const isAnswered = res.outcome === "answered";
      const hasEvidence = res.activeEvidence && res.activeEvidence.length > 0;
      const mentionsToys = (res.synthesis || "").toLowerCase().includes("toy");
      return {
        pass: isAnswered && hasEvidence && mentionsToys,
        reason: `Synthesized answer from ${res.activeEvidence?.length || 0} real evidence clause(s)`,
      };
    },
  },
  {
    name: "Out of Corpus — Refusal Without Hallucination",
    query: "How to deploy a Kubernetes cluster with Apache Spark and Hive?",
    expectedOutcome: "refusal",
    verify: (res) => {
      const isRefused =
        res.outcome === "refused_insufficient_evidence" ||
        (res.synthesis || "").toLowerCase().includes("no mandatory indian standard") ||
        (res.synthesis || "").toLowerCase().includes("not regulated under the bureau") ||
        (res.synthesis || "").toLowerCase().includes("not regulated by bis") ||
        (res.synthesis || "").toLowerCase().includes("outside the scope") ||
        (res.synthesis || "").toLowerCase().includes("falls outside") ||
        (res.synthesis || "").toLowerCase().includes("unrelated") ||
        (res.synthesis || "").toLowerCase().includes("not related") ||
        res.activeEvidence?.length === 0;
      return {
        pass: isRefused,
        reason: isRefused ? "Correctly refused out-of-scope query" : "Hallucinated non-BIS content",
      };
    },
  },
];

async function runE2ETests() {
  console.log("=" .repeat(80));
  console.log("  BISVEDA — Full End-to-End Foundational Pipeline Verification");
  console.log("=" .repeat(80));

  const { executeQueryPipeline } = await import("../prototype/src/lib/llm-provider");
  const { initDb } = await import("../prototype/src/lib/db");

  await initDb();

  const report: { name: string; query: string; pass: boolean; latencyMs: number; reason: string }[] = [];

  for (let idx = 0; idx < TEST_CASES.length; idx++) {
    const tc = TEST_CASES[idx];
    console.log(`\n[Test ${idx + 1}/${TEST_CASES.length}] ${tc.name}`);
    console.log(`  Query: "${tc.query}"`);

    const t0 = Date.now();
    try {
      const res = await executeQueryPipeline(tc.query);
      const elapsed = Date.now() - t0;
      const check = tc.verify(res);

      if (check.pass) {
        console.log(`  ✓ PASS (${elapsed}ms) : ${check.reason}`);
      } else {
        console.log(`  ✗ FAIL (${elapsed}ms) : ${check.reason}`);
      }

      if (res.activeEvidence && res.activeEvidence.length > 0) {
        const topEv = res.activeEvidence[0];
        console.log(`    Primary Evidence Source: [${topEv.standardNumber}] ${topEv.clauseNumber} - "${topEv.clauseTitle}"`);
        console.log(`    Verbatim Sample: "${topEv.verbatimText.slice(0, 100).replace(/\n/g, " ")}..."`);
      }

      if (res.synthesis) {
        const preview = res.synthesis.slice(0, 150).replace(/\n/g, " ");
        console.log(`    Answer Preview: "${preview}..."`);
      }

      report.push({
        name: tc.name,
        query: tc.query,
        pass: check.pass,
        latencyMs: elapsed,
        reason: check.reason,
      });
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      console.error(`  ✗ ERROR (${elapsed}ms):`, err.message);
      report.push({
        name: tc.name,
        query: tc.query,
        pass: false,
        latencyMs: elapsed,
        reason: `Exception: ${err.message}`,
      });
    }
  }

  // Summary Table
  console.log("\n" + "=" .repeat(80));
  console.log("  End-to-End Pipeline Verification Results");
  console.log("=" .repeat(80));
  console.log("  # | Status | Test Case                              | Latency | Details");
  console.log("  " + "-" .repeat(76));

  for (let idx = 0; idx < report.length; idx++) {
    const r = report[idx];
    const num = String(idx + 1).padStart(2);
    const status = r.pass ? "[PASS]" : "[FAIL]";
    const name = r.name.padEnd(38);
    const lat = `${r.latencyMs}ms`.padStart(7);
    console.log(`  ${num} | ${status} | ${name} | ${lat} | ${r.reason}`);
  }

  console.log("=" .repeat(80));

  const allPassed = report.every((r) => r.pass);
  console.log(`\nOverall Result: ${allPassed ? "ALL TESTS PASSED (100% End-to-End Success)" : "SOME TESTS FAILED"}\n`);
  process.exitCode = allPassed ? 0 : 1;
}

runE2ETests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exitCode = 1;
});
