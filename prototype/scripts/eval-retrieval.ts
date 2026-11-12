/**
 * BISVEDA — Retrieval-only evaluation (R0.3)
 *
 * Measures the retrieval stack alone (exact + BM25 + dense + context carry-over
 * → RRF → floor → adjudication → evidence package) on data/eval/retrieval.jsonl.
 * No LLM is called: each case gives the English working query that
 * understand.ts would hand to retrieval (cases marked `raw` give the user's
 * own words, i.e. what retrieval sees when the LLM is unavailable).
 * Zero API cost: only the local bge-m3 model runs.
 *
 * Gold is EVIDENCE TEXT, not clause ids: a hit is a chunk of the expected
 * standard whose text (whitespace-collapsed) matches one of the case's
 * evidence regexes. This survives re-chunking and clause relabelling (R2/R4).
 *
 * Metrics (answer cases):
 *   std@1      top fused standard == expected standard
 *   primary    adjudicated primary standard == expected standard
 *   ev@1/@5    first matching chunk within the top 1 / 5 of the fused ranking (top 50 kept)
 *   MRR        mean reciprocal rank of the first matching chunk (0 if not in top 50)
 *   pkg        evidence present in the [S#] package the pipeline would build (full chunk text)
 *   pkg@sent   evidence present in the text actually sent to the LLM (package text as built)
 *   answered   floor passed and a primary standard exists
 * Out-of-scope cases: refused = floor failed or no primary standard.
 *
 * Usage (from prototype/):
 *   npm run eval:retrieval                 run and print; write data/eval/results/retrieval-<ts>.json
 *   npm run eval:retrieval -- --baseline   also overwrite data/eval/results/retrieval-baseline.json
 *   npm run eval:retrieval -- --check-gold verify every evidence regex matches some chunk of its standard; no retrieval
 *   npm run eval:retrieval -- --only id1,id2
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./kb/env";
loadEnv();

import { retrieveMultiStore } from "../src/lib/pipeline/retrieve";
import { fuseRetrievalResults } from "../src/lib/pipeline/fuse";
import { checkRelevanceFloor } from "../src/lib/pipeline/floor";
import { adjudicateCandidates } from "../src/lib/pipeline/adjudicate";
import { buildEvidencePackage } from "../src/lib/pipeline/package";
import { extractCanonicalStandards, toAsciiDigits } from "../src/lib/pipeline/normalize";
import { getAllChunks, getKbSource, loadStore } from "../src/lib/kb/store";
import { closePool } from "../src/lib/db/client";
import type { KbChunk } from "../src/lib/kb/types";

interface Case {
  id: string;
  query: string;
  active?: string[];
  raw?: boolean;
  lang?: string;
  note?: string;
  expect: {
    kind: "answer" | "not_in_sources";
    standard?: string;
    also?: string[];
    evidence?: string[];
    clause?: string;
  };
}

interface CaseResult {
  id: string;
  kind: string;
  raw: boolean;
  pass: boolean;
  answered: boolean;
  topStandard: string | null;
  primary: string | null;
  std1: boolean;
  primaryOk: boolean;
  alsoFound: string[];
  evRank: number | null; // 1-based rank of first matching chunk in fused top 50
  pkgHit: boolean;
  pkgSentHit: boolean;
  floorScore: number;
  top5: string[]; // chunk ids, for parity diffs between runs
  ms: number;
}

const ROOT = path.resolve(__dirname, "..");
const CASES_PATH = path.join(ROOT, "data", "eval", "retrieval.jsonl");
const RESULTS_DIR = path.join(ROOT, "data", "eval", "results");

const args = process.argv.slice(2);
const onlyArg = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const only = onlyArg ? new Set(onlyArg.split(",")) : null;

function collapse(s: string): string {
  return (s || "").replace(/\s+/g, " ");
}

function loadCases(): Case[] {
  return fs
    .readFileSync(CASES_PATH, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as Case;
      } catch (e) {
        throw new Error(`retrieval.jsonl line ${i + 1}: ${(e as Error).message}`);
      }
    })
    .filter((c) => !only || only.has(c.id));
}

function evidenceMatcher(c: Case): (chunk: Pick<KbChunk, "standard_id" | "text">) => boolean {
  const res = (c.expect.evidence || []).map((r) => new RegExp(r, "i"));
  return (chunk) => chunk.standard_id === c.expect.standard && res.some((re) => re.test(collapse(chunk.text)));
}

function checkGold(cases: Case[]): number {
  const chunks = getAllChunks();
  let bad = 0;
  for (const c of cases) {
    if (c.expect.kind !== "answer") continue;
    const match = evidenceMatcher(c);
    const hits = chunks.filter((ch) => match(ch));
    if (hits.length === 0) {
      bad++;
      console.log(`  ✗ ${c.id}: no ${c.expect.standard} chunk matches ${JSON.stringify(c.expect.evidence)}`);
    }
  }
  console.log(bad === 0 ? `Gold OK: every evidence pattern matches its standard (${cases.length} cases).` : `${bad} case(s) with broken gold.`);
  return bad;
}

async function runCase(c: Case): Promise<CaseResult> {
  const t0 = Date.now();
  const canonical = extractCanonicalStandards(toAsciiDigits(c.query));
  const raw = await retrieveMultiStore(c.query, canonical, c.active || []);
  const fusedProd = fuseRetrievalResults(raw, 60); // what the pipeline uses (top 8)
  const fusedWide = fuseRetrievalResults(raw, 60, 50); // ranking for recall metrics
  const floor = checkRelevanceFloor(fusedProd, raw);
  const adjudicated = adjudicateCandidates(fusedProd, raw);
  const pkg = buildEvidencePackage(adjudicated, fusedProd.rankedChunks);
  const answered = floor.passed && !!adjudicated.primaryStandard && pkg.sources.length > 0;

  const topStandard = fusedProd.rankedStandards[0] ?? null;
  const primary = adjudicated.primaryStandard?.id ?? null;
  const base: Omit<CaseResult, "pass"> = {
    id: c.id,
    kind: c.expect.kind,
    raw: !!c.raw,
    answered,
    topStandard,
    primary,
    std1: false,
    primaryOk: false,
    alsoFound: [],
    evRank: null,
    pkgHit: false,
    pkgSentHit: false,
    floorScore: Number(floor.signalScore.toFixed(4)),
    top5: fusedWide.rankedChunks.slice(0, 5).map((ch) => ch.chunk_id),
    ms: Date.now() - t0,
  };

  if (c.expect.kind === "not_in_sources") {
    return { ...base, pass: !answered };
  }

  const match = evidenceMatcher(c);
  const idx = fusedWide.rankedChunks.findIndex((ch) => match(ch));
  const evRank = idx >= 0 ? idx + 1 : null;

  // Package: which chunks went in (full text) vs. the text actually handed to the LLM.
  // package.ts builds each source's text as collapse(chunk.text).trim().slice(0, 500), so that prefix identifies the chunk.
  const pkgChunkIds = new Set<string>();
  for (const s of pkg.sources) {
    const ch = fusedProd.rankedChunks.find(
      (r) => r.standard_id === s.standard_id && collapse(r.text).trim().slice(0, s.text.length) === s.text
    );
    if (ch) pkgChunkIds.add(ch.chunk_id);
  }
  const pkgHit = fusedProd.rankedChunks.some((ch) => pkgChunkIds.has(ch.chunk_id) && match(ch));
  const pkgSentHit = pkg.sources.some((s) => match({ standard_id: s.standard_id, text: s.text }));

  const adjudicatedIds = new Set(pkg.standards.map((s) => s.id));
  const alsoFound = (c.expect.also || []).filter((id) => adjudicatedIds.has(id));

  const r = {
    ...base,
    std1: topStandard === c.expect.standard,
    primaryOk: primary === c.expect.standard,
    alsoFound,
    evRank,
    pkgHit,
    pkgSentHit,
  };
  return { ...r, pass: answered && r.primaryOk && pkgSentHit };
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/a" : `${n}/${d} (${((100 * n) / d).toFixed(1)}%)`;
}

async function main() {
  const cases = loadCases();
  await loadStore();
  console.log(`Knowledge base source: ${getKbSource()}`);
  if (args.includes("--check-gold")) {
    const bad = checkGold(cases);
    await closePool();
    process.exit(bad === 0 ? 0 : 1);
  }
  if (checkGold(cases) > 0) {
    console.error("Fix the gold before running retrieval.");
    process.exit(1);
  }

  console.log(`Running ${cases.length} cases (local bge-m3; first case loads the model)...`);
  const results: CaseResult[] = [];
  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    const mark = r.pass ? "✓" : "✗";
    const detail =
      r.kind === "answer"
        ? `primary=${r.primary ?? "-"} evRank=${r.evRank ?? "-"} pkg=${r.pkgHit ? "y" : "n"} sent=${r.pkgSentHit ? "y" : "n"}${r.answered ? "" : " REFUSED"}`
        : r.answered
          ? `ANSWERED (primary=${r.primary}, floor=${r.floorScore})`
          : "refused";
    console.log(`  ${mark} ${r.id.padEnd(26)} ${detail}`);
  }

  const ans = results.filter((r) => r.kind === "answer");
  const ansEn = ans.filter((r) => !r.raw);
  const ansRaw = ans.filter((r) => r.raw);
  const oos = results.filter((r) => r.kind === "not_in_sources");
  const mrr = (rs: CaseResult[]) => (rs.length ? rs.reduce((s, r) => s + (r.evRank ? 1 / r.evRank : 0), 0) / rs.length : 0);
  const block = (label: string, rs: CaseResult[]) => ({
    label,
    n: rs.length,
    answered: pct(rs.filter((r) => r.answered).length, rs.length),
    std1: pct(rs.filter((r) => r.std1).length, rs.length),
    primary: pct(rs.filter((r) => r.primaryOk).length, rs.length),
    wrongStandard: pct(rs.filter((r) => r.answered && r.primary && !r.primaryOk).length, rs.length),
    ev1: pct(rs.filter((r) => r.evRank === 1).length, rs.length),
    ev5: pct(rs.filter((r) => r.evRank !== null && r.evRank <= 5).length, rs.length),
    ev50: pct(rs.filter((r) => r.evRank !== null).length, rs.length),
    mrr: Number(mrr(rs).toFixed(3)),
    pkg: pct(rs.filter((r) => r.pkgHit).length, rs.length),
    pkgSent: pct(rs.filter((r) => r.pkgSentHit).length, rs.length),
    pass: pct(rs.filter((r) => r.pass).length, rs.length),
  });
  const summary = {
    answer_english: block("answer (English working query)", ansEn),
    answer_raw: block("answer (raw non-English, no LLM)", ansRaw),
    out_of_scope: { n: oos.length, refused: pct(oos.filter((r) => !r.answered).length, oos.length) },
    also_standards: ans
      .filter((r) => cases.find((c) => c.id === r.id)?.expect.also?.length)
      .map((r) => ({ id: r.id, found: r.alsoFound, expected: cases.find((c) => c.id === r.id)!.expect.also })),
    median_ms: results.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(results.length / 2)],
  };

  console.log("\n" + "=".repeat(70));
  for (const b of [summary.answer_english, summary.answer_raw]) {
    console.log(`${b.label}  n=${b.n}`);
    console.log(`  answered ${b.answered} | std@1 ${b.std1} | primary ${b.primary} | wrong-standard ${b.wrongStandard}`);
    console.log(`  evidence@1 ${b.ev1} | @5 ${b.ev5} | @50 ${b.ev50} | MRR ${b.mrr}`);
    console.log(`  in package (full chunk) ${b.pkg} | in text sent to LLM ${b.pkgSent} | PASS ${b.pass}`);
  }
  console.log(`out of scope  n=${summary.out_of_scope.n}  refused ${summary.out_of_scope.refused}`);
  for (const a of summary.also_standards) console.log(`  multi-standard ${a.id}: found ${JSON.stringify(a.found)} of ${JSON.stringify(a.expected)}`);
  console.log(`median retrieval time ${summary.median_ms} ms`);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const out = { timestamp: new Date().toISOString(), cases: results.length, summary, results };
  const stamp = out.timestamp.replace(/[:.]/g, "-");
  const file = path.join(RESULTS_DIR, `retrieval-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nResults: ${path.relative(ROOT, file)}`);
  if (args.includes("--baseline") && !only) {
    fs.writeFileSync(path.join(RESULTS_DIR, "retrieval-baseline.json"), JSON.stringify(out, null, 2));
    console.log("Baseline updated: data/eval/results/retrieval-baseline.json");
  }
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
