/**
 * BISVEDA — Semantic Floor Calibration (scripts/calibrate-floor.ts, P2.7)
 *
 * Computes the dense-similarity distribution for in-scope golden cases
 * (kind: "answer"/"identifier") vs. out-of-corpus/noise cases
 * (refusal/gibberish) against the real KB chunk embeddings, and picks a
 * threshold between them. Writes data/kb/calibration.json.
 *
 * Usage: npm run calibrate:floor   (from prototype/) — or npx tsx scripts/calibrate-floor.ts
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./kb/env";
loadEnv();
// Needs chunk vectors in memory, which the DB snapshot does not hold: read the JSON KB (R4 rewrites this for the reranker).
process.env.KB_SOURCE = "json";

import { generateEmbedding } from "../src/lib/embeddings";
import { getAllChunks, loadStore } from "../src/lib/kb/store";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

interface GoldenCase {
  id: string;
  conversation: Array<{ q: string }>;
  expect: { kind?: string };
}

async function calibrateFloor() {
  console.log("=".repeat(80));
  console.log("  BISVEDA — Semantic Floor Calibration");
  console.log("=".repeat(80) + "\n");

  const goldenPath = path.resolve(__dirname, "../data/eval/golden.jsonl");
  const cases: GoldenCase[] = fs
    .readFileSync(goldenPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));

  await loadStore();
  const chunks = getAllChunks().filter((c) => c.embedding && c.embedding.length > 0);
  if (chunks.length === 0) {
    throw new Error("No embedded chunks found. Run `npm run kb:build` first.");
  }
  console.log(`Calibrating against ${chunks.length} embedded chunks, ${cases.length} golden cases.\n`);

  const inScopeScores: Array<{ id: string; maxSim: number }> = [];
  const outScopeScores: Array<{ id: string; maxSim: number }> = [];

  for (const c of cases) {
    const q = c.conversation[0].q;
    const kind = c.expect.kind || "answer";

    let emb: number[];
    try {
      emb = await generateEmbedding(q, "RETRIEVAL_QUERY");
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.warn(`  [skip] ${c.id}: embedding failed (${err instanceof Error ? err.message : err})`);
      continue;
    }

    let topSim = 0;
    for (const chunk of chunks) {
      const sim = cosineSimilarity(emb, chunk.embedding!);
      if (sim > topSim) topSim = sim;
    }

    if (kind === "answer" || kind === "identifier") {
      inScopeScores.push({ id: c.id, maxSim: topSim });
    } else if (kind.startsWith("refusal") || kind === "gibberish") {
      outScopeScores.push({ id: c.id, maxSim: topSim });
    }
    // "clarify" and "smalltalk" cases are neither — they never reach the floor check.
  }

  const inVals = inScopeScores.map((s) => s.maxSim).sort((a, b) => a - b);
  const outVals = outScopeScores.map((s) => s.maxSim).sort((a, b) => a - b);

  const minIn = inVals[0] ?? 0.5;
  const maxIn = inVals[inVals.length - 1] ?? 0.9;
  const meanIn = inVals.reduce((a, b) => a + b, 0) / (inVals.length || 1);

  const minOut = outVals[0] ?? 0.1;
  const maxOut = outVals[outVals.length - 1] ?? 0.35;
  const meanOut = outVals.reduce((a, b) => a + b, 0) / (outVals.length || 1);

  let threshold = Math.round(((maxOut + minIn) / 2) * 100) / 100;
  if (threshold <= maxOut) threshold = Math.round((maxOut + 0.03) * 100) / 100;
  if (threshold >= minIn) threshold = Math.round((minIn - 0.03) * 100) / 100;

  console.log("CALIBRATION DISTRIBUTIONS:");
  console.log(`  In-scope (n=${inScopeScores.length}): min=${minIn.toFixed(4)} mean=${meanIn.toFixed(4)} max=${maxIn.toFixed(4)}`);
  console.log(`  Out-of-scope (n=${outScopeScores.length}): min=${minOut.toFixed(4)} mean=${meanOut.toFixed(4)} max=${maxOut.toFixed(4)}`);
  console.log(`\n  >> Calibrated threshold: ${threshold.toFixed(4)}\n`);

  if (maxOut >= minIn) {
    console.warn(
      `  WARNING: the in-scope and out-of-scope distributions overlap (out-of-scope max ${maxOut.toFixed(4)} >= in-scope min ${minIn.toFixed(4)}). ` +
        `The floor alone can't cleanly separate them for every case — this is expected with a small golden set; exact-ID and graph-continuity hits bypass the floor entirely (see floor.ts).`
    );
  }

  const outDir = path.resolve(__dirname, "../data/kb");
  fs.mkdirSync(outDir, { recursive: true });
  const calibrationData = {
    threshold,
    computed_at: new Date().toISOString(),
    n_in: inScopeScores.length,
    n_out: outScopeScores.length,
    in_distribution: { min: minIn, mean: meanIn, max: maxIn },
    out_distribution: { min: minOut, mean: meanOut, max: maxOut },
  };
  const calibPath = path.join(outDir, "calibration.json");
  fs.writeFileSync(calibPath, JSON.stringify(calibrationData, null, 2), "utf-8");
  console.log(`Saved calibration to ${calibPath}`);
}

calibrateFloor().catch((err) => {
  console.error("Calibration error:", err);
  process.exit(1);
});
