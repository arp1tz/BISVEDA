/**
 * BISVEDA V9 — Semantic Floor Calibration (scripts/calibrate-floor.ts)
 * 
 * Computes semantic similarity distributions between in-scope golden cases
 * and out-of-corpus queries against real chunk and standard embeddings.
 * Determines the optimal threshold and saves data/calibration.json.
 * 
 * Usage:
 *   npx tsx scripts/calibrate-floor.ts
 */

import fs from "fs";
import path from "path";
import { generateEmbedding } from "../prototype/src/lib/embeddings";
import { cosineSimilarity } from "../prototype/src/lib/local-db";

// Load environment
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

async function calibrateFloor() {
  console.log("================================================================================");
  console.log("  BISVEDA V9 — Semantic Floor Calibration (scripts/calibrate-floor.ts)");
  console.log("================================================================================\n");

  const goldenPath = path.resolve(__dirname, "../data/eval/golden.jsonl");
  const cases = fs.readFileSync(goldenPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));

  const candidateDirs = [
    path.resolve(process.cwd(), "prototype/data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(__dirname, "../prototype/data"),
    path.resolve(__dirname, "../data"),
  ];
  const dataDir = candidateDirs.find((d) => fs.existsSync(path.join(d, "bisveda_local_db.json"))) || "";
  const localDb = JSON.parse(fs.readFileSync(path.join(dataDir, "bisveda_local_db.json"), "utf-8"));

  const allChunkEmbeddings: Array<{ id: string; emb: number[] }> = [];
  for (const cid of Object.keys(localDb.chunks || {})) {
    const c = localDb.chunks[cid];
    if (c.embedding && c.embedding.length > 0) {
      allChunkEmbeddings.push({ id: cid, emb: c.embedding });
    }
  }

  const inScopeScores: Array<{ id: string; query: string; maxSim: number }> = [];
  const outScopeScores: Array<{ id: string; query: string; maxSim: number }> = [];

  for (const c of cases) {
    const q = c.conversation[0].q;
    const kind = c.expect.kind || "answer";
    const emb = await generateEmbedding(q, "RETRIEVAL_QUERY");

    let topSim = 0;
    for (const item of allChunkEmbeddings) {
      const sim = cosineSimilarity(emb, item.emb);
      if (sim > topSim) topSim = sim;
    }

    if (kind === "answer") {
      inScopeScores.push({ id: c.id, query: q, maxSim: topSim });
    } else if (kind.startsWith("refusal") || kind === "gibberish") {
      outScopeScores.push({ id: c.id, query: q, maxSim: topSim });
    }
  }

  const inVals = inScopeScores.map((s) => s.maxSim).sort((a, b) => a - b);
  const outVals = outScopeScores.map((s) => s.maxSim).sort((a, b) => a - b);

  const minIn = inVals[0] || 0.50;
  const maxIn = inVals[inVals.length - 1] || 0.90;
  const meanIn = inVals.reduce((a, b) => a + b, 0) / (inVals.length || 1);

  const minOut = outVals[0] || 0.10;
  const maxOut = outVals[outVals.length - 1] || 0.35;
  const meanOut = outVals.reduce((a, b) => a + b, 0) / (outVals.length || 1);

  // Pick optimal threshold between maxOut and minIn
  // Add margin of 0.03 above maxOut or midpoint
  let threshold = Math.round(((maxOut + minIn) / 2) * 100) / 100;
  if (threshold <= maxOut) threshold = Math.round((maxOut + 0.03) * 100) / 100;
  if (threshold >= minIn) threshold = Math.round((minIn - 0.03) * 100) / 100;

  console.log("CALIBRATION DISTRIBUTIONS:");
  console.log(`  In-Scope Queries (n = ${inScopeScores.length}):`);
  console.log(`    Min Similarity:  ${minIn.toFixed(4)}`);
  console.log(`    Mean Similarity: ${meanIn.toFixed(4)}`);
  console.log(`    Max Similarity:  ${maxIn.toFixed(4)}`);
  console.log(`  Out-of-Corpus / Noise (n = ${outScopeScores.length}):`);
  console.log(`    Min Similarity:  ${minOut.toFixed(4)}`);
  console.log(`    Mean Similarity: ${meanOut.toFixed(4)}`);
  console.log(`    Max Similarity:  ${maxOut.toFixed(4)}`);
  console.log(`\n  >> Calibrated Semantic Floor Threshold: ${threshold.toFixed(4)}\n`);

  const calibrationData = {
    threshold,
    computed_at: new Date().toISOString(),
    n_in: inScopeScores.length,
    n_out: outScopeScores.length,
    in_distribution: { min: minIn, mean: meanIn, max: maxIn },
    out_distribution: { min: minOut, mean: meanOut, max: maxOut },
  };

  const calibPath = path.resolve(__dirname, "../data/calibration.json");
  fs.writeFileSync(calibPath, JSON.stringify(calibrationData, null, 2), "utf-8");
  console.log(`✓ Saved calibration to ${calibPath}`);
}

calibrateFloor().catch((err) => {
  console.error("Calibration error:", err);
  process.exit(1);
});
