/**
 * BISVEDA V9 — Pipeline Unit Tests (tests/pipeline.test.ts)
 * 
 * Tests:
 *  1. normalize: 10 variants of IS numbers
 *  2. rrf: Reciprocal Rank Fusion calculation
 *  3. adjudicate: IS 1417 / IS 2925 for rider helmet must be not_applicable
 *  4. trustGate: Sentence with unsupported "80%" is dropped
 *  5. toSimilarity: Cosine distance to similarity conversion
 * 
 * Usage:
 *   npx tsx tests/pipeline.test.ts
 */

import { canonicalizeIsNumber } from "../prototype/src/lib/pipeline/normalize";
import { rrf } from "../prototype/src/lib/pipeline/fuse";
import { adjudicateCandidates } from "../prototype/src/lib/pipeline/adjudicate";
import { runTrustGate } from "../prototype/src/lib/pipeline/trust";
import { EvidencePackage } from "../prototype/src/lib/pipeline/package";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
  }
}

export function toSimilarity(cosineDistance: number): number {
  return 1 - cosineDistance;
}

async function runTests() {
  console.log("================================================================================");
  console.log("  BISVEDA V9 — Pipeline Unit Tests");
  console.log("================================================================================\n");

  // ── Test 1: Normalize (10 Variants of IS Numbers) ───────────────────────────
  console.log("[Test Suite 1: Canonicalize IS Numbers (10 Variants)]");

  const variants = [
    { input: "IS 4151", expectedId: "IS 4151", expectedNorm: "IS4151" },
    { input: "is4151", expectedId: "IS 4151", expectedNorm: "IS4151" },
    { input: "IS 456:2000", expectedId: "IS 456", expectedNorm: "IS456" },
    { input: "is 456 : 2000", expectedId: "IS 456", expectedNorm: "IS456" },
    { input: "IS-456", expectedId: "IS 456", expectedNorm: "IS456" },
    { input: "IS 9873 (Part 1)", expectedId: "IS 9873 (Part 1)", expectedNorm: "IS9873P1" },
    { input: "IS 9873 (Pt 1)", expectedId: "IS 9873 (Part 1)", expectedNorm: "IS9873P1" },
    { input: "IS 9873 Part-1", expectedId: "IS 9873 (Part 1)", expectedNorm: "IS9873P1" },
    { input: "IS 16046 (Part 2):2018", expectedId: "IS 16046 (Part 2)", expectedNorm: "IS16046P2" },
    { input: "IS:4151-1993", expectedId: "IS 4151", expectedNorm: "IS4151" },
  ];

  for (const v of variants) {
    const res = canonicalizeIsNumber(v.input);
    assert(
      res !== null && res.id === v.expectedId && res.norm === v.expectedNorm,
      `Variant: "${v.input}" -> ${v.expectedId}`,
      `Got: ${res ? `${res.id} (${res.norm})` : "null"}`
    );
  }

  // ── Test 2: RRF (Reciprocal Rank Fusion) ────────────────────────────────────
  console.log("\n[Test Suite 2: Reciprocal Rank Fusion]");
  const listA = ["IS 4151", "IS 2925", "IS 1417"];
  const listB = ["IS 4151", "IS 1417"];
  const fusedScores = rrf([listA, listB], 60);

  const score4151 = fusedScores.get("IS 4151") || 0;
  const score2925 = fusedScores.get("IS 2925") || 0;
  const score1417 = fusedScores.get("IS 1417") || 0;

  assert(
    score4151 > score2925 && score4151 > score1417,
    "IS 4151 ranked #1 in RRF fusion",
    `Scores: 4151=${score4151.toFixed(4)}, 2925=${score2925.toFixed(4)}, 1417=${score1417.toFixed(4)}`
  );

  // ── Test 3: Adjudication Truth Boundaries ───────────────────────────────────
  console.log("\n[Test Suite 3: Adjudication (Helmet Isolation)]");

  const mockFused = {
    rankedStandards: ["IS 4151", "IS 2925", "IS 1417", "IS 14767"],
    rankedChunks: [],
    standardScores: new Map([
      ["IS 4151", 0.95],
      ["IS 2925", 0.40],
      ["IS 1417", 0.30],
      ["IS 14767", 0.10],
    ]),
  };

  const helmetProductRes = {
    matchedTerm: "motorcycle rider helmet",
    productNodeId: "prod:helmet",
    productGroupId: "pg:PG-AUTOMOTIVE-SAFETY",
    preferredStandardId: "IS 4151",
  };

  const adjResult = await adjudicateCandidates(
    "Is BIS certification mandatory for making helmets?",
    mockFused,
    helmetProductRes,
    [{ id: "IS 4151", norm: "IS4151", part: null, year: null, originalMatch: "IS 4151" }]
  );

  const shownStdIds = adjResult.standards.map((s) => s.id);
  assert(
    shownStdIds.includes("IS 4151"),
    "IS 4151 is included in adjudicated standards for helmet query"
  );
  assert(
    !shownStdIds.includes("IS 1417"),
    "IS 1417 (Gold Jewellery) is NOT_APPLICABLE for helmet query (0 wrong standard)"
  );
  assert(
    !shownStdIds.includes("IS 2925"),
    "IS 2925 (Industrial Helmet) is NOT_APPLICABLE for motorcycle rider helmet"
  );
  assert(
    !shownStdIds.includes("IS 14767"),
    "IS 14767 (Follow-up formula) is NOT_APPLICABLE for helmet query"
  );

  // ── Test 4: Trust Gate Number Support ───────────────────────────────────────
  console.log("\n[Test Suite 4: Trust Gate Number Support]");

  const mockPkg: EvidencePackage = {
    primary_standard: { id: "IS 4151", title: "Protective Helmets" },
    standards: [{ id: "IS 4151", title: "Protective Helmets", class: "applies", why: "Covers helmets" }],
    qco_status: "mandatory",
    steps: [],
    labs_count: 2,
    sources: [
      {
        label: "S1",
        kind: "catalogue",
        standard_id: "IS 4151",
        title: "IS 4151 Specification",
        has_file: false,
        url: "https://bis.gov.in",
        text: "IS 4151 specifies helmets for riders. Impact velocity shall be 7.5 m/s.",
      },
    ],
  };

  // Case A: Unsupported claim "80% fee concession" -> must be dropped
  const unsupportedProse = {
    headline: "IS 4151 is mandatory for helmets [S1].",
    points: [
      "MSMEs receive an 80% fee concession on application charges [S1].",
      "Impact velocity test is conducted at 7.5 m [S1].",
    ],
    next_steps: [],
  };

  const gateResult = runTrustGate(unsupportedProse, mockPkg);
  assert(
    !gateResult.sanitizedProse.points.some((p) => p.includes("80%")),
    "Sentence with unsupported '80%' fee concession is dropped by Trust Gate"
  );

  // ── Test 5: Cosine Distance to Similarity Conversion ─────────────────────────
  console.log("\n[Test Suite 5: toSimilarity]");
  const distance = 0.28;
  const similarity = toSimilarity(distance);
  assert(
    Math.abs(similarity - 0.72) < 0.0001,
    "toSimilarity(0.28) converts correctly to 0.72 (1 - distance)"
  );

  console.log("--------------------------------------------------------------------------------");
  console.log(`Unit Tests Summary: ${passedTests} / ${totalTests} passed.`);
  if (passedTests === totalTests) {
    console.log("✓ ALL UNIT TESTS PASSED.\n");
  } else {
    console.error("✗ SOME UNIT TESTS FAILED.\n");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unit test execution error:", err);
  process.exit(1);
});
