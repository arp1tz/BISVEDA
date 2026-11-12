/**
 * BISVEDA — RAG Evaluation Runner (scripts/eval-rag.ts, P2.7)
 *
 * Runs every case in data/eval/golden.jsonl through the real pipeline
 * (lib/pipeline/orchestrator.ts) in-process. Checks:
 *  - outcome kind (answer | clarify | refusal_out_of_scope | refusal_not_in_sources | smalltalk | gibberish | identifier)
 *  - primary standard match
 *  - must_include standards (recall)
 *  - must_not_include standards (wrong-standard rate)
 *  - citation validity (every [S#] in the answer resolves to a real source)
 *  - number support (every number in a cited sentence is backed by that source's text)
 *
 * Usage: npm run eval:rag   (from prototype/)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./kb/env";
loadEnv();

import { runPipeline } from "../src/lib/pipeline/orchestrator";
import { closePool } from "../src/lib/db/client";
import type { BisvedaResponse } from "../src/lib/pipeline/respond";

interface GoldenCase {
  id: string;
  conversation: Array<{ q: string; reset_conversation?: boolean }>;
  expect: {
    kind?: "answer" | "clarify" | "refusal_out_of_scope" | "refusal_not_in_sources" | "smalltalk" | "gibberish";
    primary?: string;
    must_include?: string[];
    must_not_include?: string[];
    lang?: string;
  };
}

interface EvalResultItem {
  id: string;
  pass: boolean;
  actualKind: string;
  expectedKind: string;
  langPass: boolean;
  primaryPass: boolean;
  mustIncludePass: boolean;
  mustNotIncludePass: boolean;
  citationValidityPass: boolean;
  numberSupportPass: boolean;
  details: string[];
}

function cleanStd(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function extractNumbersWithUnits(text: string): string[] {
  const regex = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|mm|cm|m|kg|g|N|°C|days|months|years|Rs|₹|K|karat))?\b/gi;
  return (text.match(regex) || []).map((m) => m.trim().toLowerCase());
}

function mapKind(res: BisvedaResponse): string {
  if (res.kind === "refusal") {
    if (res.refusal?.reason === "out_of_scope") return "refusal_out_of_scope";
    if (res.refusal?.reason === "gibberish") return "gibberish";
    return "refusal_not_in_sources";
  }
  return res.kind;
}

async function main() {
  console.log("=".repeat(80));
  console.log("  BISVEDA — RAG Evaluation Runner (eval:rag)");
  console.log("=".repeat(80) + "\n");

  // `--file multilingual.jsonl` runs another case file (relative to data/eval); default is the golden set.
  const fileArgIdx = process.argv.indexOf("--file");
  const caseFile = fileArgIdx > -1 && process.argv[fileArgIdx + 1] ? process.argv[fileArgIdx + 1] : "golden.jsonl";
  const isDefaultSet = caseFile === "golden.jsonl" && !process.argv.includes("--only");
  const onlyArgIdx = process.argv.indexOf("--only");
  const only = onlyArgIdx > -1 ? (process.argv[onlyArgIdx + 1] || "").split(",") : null;
  const goldenPath = path.resolve(__dirname, "../data/eval", caseFile);
  if (!fs.existsSync(goldenPath)) {
    console.error("Golden test file not found:", goldenPath);
    process.exit(1);
  }

  const cases: GoldenCase[] = fs
    .readFileSync(goldenPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l))
    .filter((c: GoldenCase) => !only || only.includes(c.id));

  console.log(`Loaded ${cases.length} golden evaluation cases.\n`);

  const results: EvalResultItem[] = [];
  let wrongStandardCount = 0;
  let kindCorrectCount = 0;
  let primaryCount = 0;
  let primaryCorrectCount = 0;
  let totalCitations = 0;
  let validCitations = 0;
  let totalNumberChecks = 0;
  let supportedNumberChecks = 0;

  for (const c of cases) {
    // Pace requests to stay under the Gemini free-tier embedding quota
    // (~100/min) across a full run's worth of dense-search calls.
    if (results.length > 0) await new Promise((resolve) => setTimeout(resolve, 2500));
    process.stdout.write(`[${results.length + 1}/${cases.length}] ${c.id}...`);
    let conversationId = `eval-${c.id}-${Date.now()}`;
    let history: Array<{ query: string; response: any }> = [];
    let lastResult: BisvedaResponse | null = null;

    for (const turn of c.conversation) {
      if (turn.reset_conversation) {
        conversationId = `eval-${c.id}-reset-${Date.now()}`;
        history = [];
      }
      lastResult = await runPipeline({ query: turn.q, conversation_id: conversationId, history });
      history.push({ query: turn.q, response: lastResult });
    }

    const res = lastResult!;
    const actualKind = mapKind(res);
    const details: string[] = [];
    const standardsShown = (res.standards || []).map((s) => s.id);
    const primaryStandard = res.standards?.find((s) => s.class === "applies")?.id || res.standards?.[0]?.id;

    // 1. Kind check
    let kindPass = true;
    if (c.expect.kind && c.expect.kind !== actualKind) {
      kindPass = false;
      details.push(`Kind mismatch: expected ${c.expect.kind}, got ${actualKind}`);
    }
    if (kindPass) kindCorrectCount++;

    // 1b. Reply language check (base language code of the response, e.g. "mr-Latn" -> "mr")
    let langPass = true;
    if (c.expect.lang) {
      const actualLang = (res.language || "en").split("-")[0].toLowerCase();
      if (actualLang !== c.expect.lang) {
        langPass = false;
        details.push(`Language mismatch: expected ${c.expect.lang}, got ${res.language}`);
      }
    }

    // 2. Primary standard check
    let primaryPass = true;
    if (c.expect.primary) {
      primaryCount++;
      const cleanExpected = cleanStd(c.expect.primary);
      const cleanActual = cleanStd(primaryStandard || "");
      if (!cleanActual.includes(cleanExpected) && !cleanExpected.includes(cleanActual)) {
        primaryPass = false;
        details.push(`Primary mismatch: expected ${c.expect.primary}, got ${primaryStandard || "NONE"}`);
      } else {
        primaryCorrectCount++;
      }
    }

    // 3. Must-include (recall)
    let mustIncludePass = true;
    for (const reqStd of c.expect.must_include || []) {
      const cReq = cleanStd(reqStd);
      const found = standardsShown.some((s) => cleanStd(s).includes(cReq) || cReq.includes(cleanStd(s)));
      if (!found) {
        mustIncludePass = false;
        details.push(`Missing required standard: ${reqStd}`);
      }
    }

    // 4. Must-not-include (wrong-standard rate)
    let mustNotIncludePass = true;
    for (const banStd of c.expect.must_not_include || []) {
      const cBan = cleanStd(banStd);
      const foundInStandards = standardsShown.some((s) => cleanStd(s).includes(cBan) || cBan.includes(cleanStd(s)));
      const foundInText = cBan.length > 2 && cleanStd(res.text || "").includes(cBan);
      if (foundInStandards || foundInText) {
        mustNotIncludePass = false;
        wrongStandardCount++;
        details.push(`Leaked prohibited standard: ${banStd}`);
      }
    }

    // 5. Citation validity
    let citationValidityPass = true;
    const citedLabels = new Set<string>();
    for (const m of (res.text || "").matchAll(/\[S(\d+)\]/g)) citedLabels.add(`S${m[1]}`);
    const availableLabels = new Set((res.sources || []).map((s) => s.label));
    for (const cited of citedLabels) {
      totalCitations++;
      if (availableLabels.has(cited)) {
        validCitations++;
      } else {
        citationValidityPass = false;
        details.push(`Invalid citation marker: [${cited}] not found in sources`);
      }
    }

    // 6. Number support
    let numberSupportPass = true;
    const sentences = (res.text || "").split(/[.?!।॥\n]+\s*/);
    for (const sentence of sentences) {
      const numbers = extractNumbersWithUnits(sentence);
      if (numbers.length === 0) continue;
      const sentenceCitations = Array.from(sentence.matchAll(/\[S(\d+)\]/g)).map((m) => `S${m[1]}`);
      if (sentenceCitations.length === 0) continue;

      const citedText = (res.sources || [])
        .filter((s) => sentenceCitations.includes(s.label))
        .map((s) => `${s.title || ""} ${s.text || ""}`.toLowerCase())
        .join(" ")
        .replace(/\s+/g, " ");

      for (const num of numbers) {
        totalNumberChecks++;
        const cleanNum = num.replace(/[,\s]/g, "").toLowerCase();
        const digits = cleanNum.replace(/\D/g, "");
        const commaAsDecimal = num.replace(",", ".");
        if (
          citedText.includes(num) ||
          citedText.includes(cleanNum) ||
          citedText.includes(commaAsDecimal) ||
          (digits && citedText.includes(digits))
        ) {
          supportedNumberChecks++;
        } else {
          numberSupportPass = false;
          details.push(`Unsupported number "${num}" in sentence: "${sentence.slice(0, 80)}..."`);
        }
      }
    }

    const overallPass = kindPass && langPass && primaryPass && mustIncludePass && mustNotIncludePass && citationValidityPass && numberSupportPass;

    results.push({
      id: c.id,
      pass: overallPass,
      actualKind,
      expectedKind: c.expect.kind || "any",
      langPass,
      primaryPass,
      mustIncludePass,
      mustNotIncludePass,
      citationValidityPass,
      numberSupportPass,
      details,
    });
    process.stdout.write(overallPass ? " PASS\n" : ` FAIL (${details[0] || ""})\n`);
  }

  console.log("\n" + "-".repeat(90));
  console.log("ID".padEnd(18) + "KIND".padEnd(10) + "PRIMARY".padEnd(10) + "WRONG_STD".padEnd(12) + "CITATIONS".padEnd(12) + "NUM_SUPPORT".padEnd(14) + "STATUS");
  console.log("-".repeat(90));
  for (const r of results) {
    const kindCol = (r.actualKind === r.expectedKind || r.expectedKind === "any" ? "PASS" : "FAIL").padEnd(10);
    const primCol = (r.primaryPass ? "PASS" : "FAIL").padEnd(10);
    const wrongCol = (r.mustNotIncludePass ? "PASS" : "FAIL").padEnd(12);
    const citeCol = (r.citationValidityPass ? "PASS" : "FAIL").padEnd(12);
    const numCol = (r.numberSupportPass ? "PASS" : "FAIL").padEnd(14);
    console.log(r.id.padEnd(18) + kindCol + primCol + wrongCol + citeCol + numCol + (r.pass ? "PASS" : "FAIL"));
    if (!r.pass) for (const d of r.details) console.log(`  - ${d}`);
  }

  console.log("-".repeat(90) + "\n");
  console.log("EVALUATION METRICS SUMMARY:");
  console.log(`  Total Cases:          ${cases.length}`);
  console.log(`  Passed Cases:         ${results.filter((r) => r.pass).length} / ${cases.length}`);
  console.log(`  Wrong-Standard Rate:  ${wrongStandardCount} violations (Required: 0)`);
  console.log(`  Language Match:       ${results.filter((r) => r.langPass).length} / ${cases.length}`);
  console.log(`  Kind Accuracy:        ${kindCorrectCount} / ${cases.length}`);
  console.log(`  Primary Accuracy:     ${primaryCorrectCount} / ${primaryCount} (${primaryCount > 0 ? Math.round((primaryCorrectCount / primaryCount) * 100) : 100}%) (Target: >=90%)`);
  console.log(`  Citation Validity:    ${validCitations} / ${totalCitations} (${totalCitations > 0 ? Math.round((validCitations / totalCitations) * 100) : 100}%) (Target: 100%)`);
  console.log(`  Number Support:       ${supportedNumberChecks} / ${totalNumberChecks} (${totalNumberChecks > 0 ? Math.round((supportedNumberChecks / totalNumberChecks) * 100) : 100}%) (Target: 100%)`);

  const resultsDir = path.resolve(__dirname, "../data/eval/results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const payload = {
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    passedCount: results.filter((r) => r.pass).length,
    wrongStandardCount,
    kindAccuracy: `${kindCorrectCount}/${cases.length}`,
    primaryAccuracy: `${primaryCorrectCount}/${primaryCount}`,
    citationValidity: `${validCitations}/${totalCitations}`,
    numberSupport: `${supportedNumberChecks}/${totalNumberChecks}`,
    results,
  };
  fs.writeFileSync(path.join(resultsDir, `${timestamp}.json`), JSON.stringify(payload, null, 2));
  if (isDefaultSet) {
    fs.writeFileSync(path.join(resultsDir, "baseline.json"), JSON.stringify(payload, null, 2));
    console.log(`\nResults written to data/eval/results/${timestamp}.json and baseline.json\n`);
  } else {
    console.log(`\nResults written to data/eval/results/${timestamp}.json (baseline.json untouched)\n`);
  }
}

main().then(() => closePool()).catch((err) => {
  console.error("Evaluation runner error:", err);
  process.exit(1);
});
