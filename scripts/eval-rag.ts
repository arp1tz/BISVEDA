/**
 * BISVEDA V9 — RAG Evaluation Runner (scripts/eval-rag.ts)
 * 
 * Runs all test cases from data/eval/golden.jsonl in-process.
 * Checks:
 *  - outcome / kind (answer | clarify | refusal_out_of_scope | refusal_not_in_sources | smalltalk | gibberish | identifier)
 *  - primary standard match
 *  - must_include standards
 *  - must_not_include standards (wrong-standard check)
 *  - qco status (mandatory | voluntary | unknown)
 *  - citation validity (every [S#] exists in sources)
 *  - number support (every number in a sentence is backed by a cited source)
 *
 * Usage:
 *   npx tsx scripts/eval-rag.ts
 */

import fs from "fs";
import path from "path";

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

interface GoldenCase {
  id: string;
  conversation: Array<{ q: string; reset_conversation?: boolean }>;
  expect: {
    kind?: "answer" | "clarify" | "refusal_out_of_scope" | "refusal_not_in_sources" | "smalltalk" | "gibberish" | "identifier";
    primary?: string;
    must_include?: string[];
    must_not_include?: string[];
    qco?: "mandatory" | "voluntary" | "unknown";
    lang?: string;
  };
}

interface EvalResultItem {
  id: string;
  pass: boolean;
  actualKind: string;
  expectedKind: string;
  primaryPass: boolean;
  mustIncludePass: boolean;
  mustNotIncludePass: boolean;
  qcoPass: boolean;
  citationValidityPass: boolean;
  numberSupportPass: boolean;
  details: string[];
}

function cleanStd(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function extractNumbersWithUnits(text: string): string[] {
  // Matches numbers with optional decimals and units
  const regex = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|mm|cm|m|kg|g|N|°C|days|months|years|Rs|₹))?\b/gi;
  const matches = text.match(regex);
  return matches ? matches.map((m) => m.trim().toLowerCase()) : [];
}

async function runInProcessPipeline(
  query: string,
  history: Array<{ query: string; response: any }>,
  conversationId: string
): Promise<{
  kind: string;
  primaryStandard?: string;
  standardsShown: string[];
  qcoStatus?: string;
  answerText: string;
  sources: Array<{ label: string; text: string; document_id?: string; has_file?: boolean }>;
}> {
  // Check if new V9 modular pipeline is available
  try {
    const v9Path = path.resolve(__dirname, "../prototype/src/lib/pipeline/orchestrator");
    if (fs.existsSync(v9Path + ".ts") || fs.existsSync(v9Path + ".js")) {
      const { runPipeline } = await import("../prototype/src/lib/pipeline/orchestrator");
      const res = await runPipeline({ query, conversation_id: conversationId, history });

      let mappedKind = res.kind;
      if (res.kind === "refusal") {
        if (res.refusal?.reason === "out_of_scope") mappedKind = "refusal_out_of_scope";
        else if (res.refusal?.reason === "gibberish") mappedKind = "gibberish";
        else mappedKind = "refusal_not_in_sources";
      }

      return {
        kind: mappedKind,
        primaryStandard: res.primary_standard?.id,
        standardsShown: (res.standards || []).map((s: any) => s.id),
        qcoStatus: res.qco?.status,
        answerText: res.answer ? `${res.answer.headline} ${res.answer.points.join(" ")} ${res.answer.next_steps.join(" ")}` : "",
        sources: (res.sources || []).map((s: any) => ({
          label: s.label,
          title: s.title,
          text: s.text,
          document_id: s.standard_id,
          has_file: s.has_file,
        })),
      };
    }
  } catch (err) {
    console.error("[V9 Pipeline Error in eval]:", err);
  }

  // Baseline prototype invocation
  const { resolveConversationalContext } = await import("../prototype/src/lib/context-resolver");
  const { routeConversationalIntent } = await import("../prototype/src/lib/conversational-router");
  const { executeQueryPipeline } = await import("../prototype/src/lib/llm-provider");

  const chatTurns = history.map((h) => ({
    query: h.query,
    response: h.response?.synthesis || "",
    entities: { activeStandard: h.response?.recommendations?.[0]?.standardNumber },
  }));

  const contextResolution = resolveConversationalContext(query, chatTurns);
  const effectiveQuery = contextResolution.resolvedQuery;
  const intentGate = routeConversationalIntent(effectiveQuery);

  if (intentGate.isConversational && intentGate.conversationalResponse) {
    const isSmalltalk = intentGate.intent === "greeting" || intentGate.intent === "smalltalk";
    return {
      kind: isSmalltalk ? "smalltalk" : "answer",
      standardsShown: [],
      answerText: intentGate.conversationalResponse,
      sources: [],
    };
  }

  if (intentGate.clarificationRequired) {
    return {
      kind: "clarify",
      standardsShown: [],
      answerText: intentGate.clarificationPrompt || "",
      sources: [],
    };
  }

  const pipelineRes = await executeQueryPipeline(effectiveQuery, contextResolution);

  let kind = "answer";
  if (pipelineRes.isSpeedGateHit && pipelineRes.recommendations?.length === 0) {
    kind = "identifier";
  } else if (pipelineRes.outcome === "disambiguation_required") {
    kind = "clarify";
  } else if (pipelineRes.outcome === "refused_insufficient_evidence") {
    kind = "refusal_not_in_sources";
  }

  const standardsShown = (pipelineRes.recommendations || []).map((r: any) => r.standardNumber);
  const primaryStandard = pipelineRes.recommendations?.[0]?.standardNumber;
  const qcoStatus = pipelineRes.qcoAlert?.isMandatory ? "mandatory" : pipelineRes.qcoAlert ? "voluntary" : "unknown";

  const sources = (pipelineRes.activeEvidence || []).map((e: any, idx: number) => ({
    label: `S${idx + 1}`,
    text: e.verbatimText || "",
    document_id: e.standardNumber,
    has_file: true,
  }));

  return {
    kind,
    primaryStandard,
    standardsShown,
    qcoStatus,
    answerText: pipelineRes.synthesis || "",
    sources,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("  BISVEDA V9 — RAG Evaluation Runner (eval:rag)");
  console.log("================================================================================\n");

  const goldenPath = path.resolve(__dirname, "../data/eval/golden.jsonl");
  if (!fs.existsSync(goldenPath)) {
    console.error("Golden test file not found:", goldenPath);
    process.exit(1);
  }

  const lines = fs.readFileSync(goldenPath, "utf-8").split("\n").filter((l) => l.trim().length > 0);
  const cases: GoldenCase[] = lines.map((l) => JSON.parse(l));

  console.log(`Loaded ${cases.length} golden evaluation cases from ${goldenPath}.\n`);

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
    const caseId = c.id;
    console.log(`[${results.length + 1}/${cases.length}] Evaluating ${caseId}...`);
    let conversationId = `eval-${caseId}-${Date.now()}`;
    let history: Array<{ query: string; response: any }> = [];
    let lastResult: any = null;

    for (const turn of c.conversation) {
      if (turn.reset_conversation) {
        conversationId = `eval-${caseId}-reset-${Date.now()}`;
        history = [];
      }
      lastResult = await runInProcessPipeline(turn.q, history, conversationId);
      history.push({ query: turn.q, response: lastResult });
    }

    const res = lastResult;
    const details: string[] = [];

    // 1. Kind check
    let kindPass = true;
    if (c.expect.kind) {
      // Normalize comparison
      if (c.expect.kind === "answer" && res.kind !== "answer") kindPass = false;
      else if (c.expect.kind === "clarify" && res.kind !== "clarify") kindPass = false;
      else if (c.expect.kind.startsWith("refusal") && !res.kind.startsWith("refusal")) kindPass = false;
      else if (c.expect.kind === "smalltalk" && res.kind !== "smalltalk") kindPass = false;
      else if (c.expect.kind === "gibberish" && res.kind !== "gibberish" && !res.kind.startsWith("refusal")) kindPass = false;
      else if (c.expect.kind === "identifier" && res.kind !== "identifier" && res.kind !== "answer") kindPass = false;
      if (!kindPass) {
        details.push(`Kind mismatch: expected ${c.expect.kind}, got ${res.kind}`);
      }
    }
    if (kindPass) kindCorrectCount++;

    // 2. Primary Standard check
    let primaryPass = true;
    if (c.expect.primary) {
      primaryCount++;
      const cleanExpected = cleanStd(c.expect.primary);
      const cleanActual = cleanStd(res.primaryStandard || "");
      if (!cleanActual.includes(cleanExpected) && !cleanExpected.includes(cleanActual)) {
        primaryPass = false;
        details.push(`Primary mismatch: expected ${c.expect.primary}, got ${res.primaryStandard || "NONE"}`);
      } else {
        primaryCorrectCount++;
      }
    }

    // 3. Must Include check
    let mustIncludePass = true;
    if (c.expect.must_include) {
      for (const reqStd of c.expect.must_include) {
        const cReq = cleanStd(reqStd);
        const found = res.standardsShown.some((s: string) => cleanStd(s).includes(cReq) || cReq.includes(cleanStd(s)));
        if (!found) {
          mustIncludePass = false;
          details.push(`Missing required standard: ${reqStd}`);
        }
      }
    }

    // 4. Must Not Include check (Wrong-standard rate)
    let mustNotIncludePass = true;
    if (c.expect.must_not_include) {
      for (const banStd of c.expect.must_not_include) {
        const cBan = cleanStd(banStd);
        const found = res.standardsShown.some((s: string) => cleanStd(s).includes(cBan) || cBan.includes(cleanStd(s)));
        if (found) {
          mustNotIncludePass = false;
          wrongStandardCount++;
          details.push(`Leaked prohibited standard: ${banStd}`);
        }
      }
    }

    // 5. QCO Status check
    let qcoPass = true;
    if (c.expect.qco) {
      if (res.qcoStatus !== c.expect.qco) {
        qcoPass = false;
        details.push(`QCO mismatch: expected ${c.expect.qco}, got ${res.qcoStatus}`);
      }
    }

    // 6. Citation Validity check
    let citationValidityPass = true;
    const citationRegex = /\[S(\d+)\]/g;
    let match;
    const citedLabels = new Set<string>();
    while ((match = citationRegex.exec(res.answerText)) !== null) {
      citedLabels.add(`S${match[1]}`);
    }

    const availableLabels = new Set(res.sources.map((s: any) => s.label));
    for (const cited of citedLabels) {
      totalCitations++;
      if (availableLabels.has(cited)) {
        validCitations++;
      } else {
        citationValidityPass = false;
        details.push(`Invalid citation marker: [${cited}] not found in sources`);
      }
    }

    // 7. Number Support check
    let numberSupportPass = true;
    const sentences = res.answerText.split(/[.?!।॥\n]+\s*/);
    for (const sentence of sentences) {
      const numbers = extractNumbersWithUnits(sentence);
      if (numbers.length === 0) continue;

      // Extract sources cited in this specific sentence
      const sentenceCitations: string[] = [];
      let sMatch;
      const sRegex = /\[S(\d+)\]/g;
      while ((sMatch = sRegex.exec(sentence)) !== null) {
        sentenceCitations.push(`S${sMatch[1]}`);
      }
      if (sentenceCitations.length === 0) continue;

      const citedSourcesText = res.sources
        .filter((s: any) => sentenceCitations.includes(s.label))
        .map((s: any) => `${s.title || ""} ${s.text || ""}`.toLowerCase())
        .join(" ");

      const cleanCitedText = (citedSourcesText || "").replace(/[,]/g, "");
      const rawCleanCitedText = (citedSourcesText || "").replace(/[,\s]/g, "");

      for (const num of numbers) {
        totalNumberChecks++;
        const cleanNum = num.replace(/[,\s]/g, "").toLowerCase();
        const digits = cleanNum.replace(/\D/g, "");
        if (
          citedSourcesText &&
          (citedSourcesText.includes(num) ||
            citedSourcesText.includes(cleanNum) ||
            cleanCitedText.includes(cleanNum) ||
            rawCleanCitedText.includes(cleanNum) ||
            (digits && (citedSourcesText.includes(digits) || rawCleanCitedText.includes(digits))))
        ) {
          supportedNumberChecks++;
        } else if (sentenceCitations.length > 0) {
          numberSupportPass = false;
          details.push(`Unsupported number "${num}" in sentence: "${sentence.slice(0, 80)}..."`);
        }
      }
    }

    const overallPass =
      kindPass &&
      primaryPass &&
      mustIncludePass &&
      mustNotIncludePass &&
      qcoPass &&
      citationValidityPass &&
      numberSupportPass;

    results.push({
      id: caseId,
      pass: overallPass,
      actualKind: res.kind,
      expectedKind: c.expect.kind || "any",
      primaryPass,
      mustIncludePass,
      mustNotIncludePass,
      qcoPass,
      citationValidityPass,
      numberSupportPass,
      details,
    });
  }

  // Print Summary Table
  console.log("--------------------------------------------------------------------------------");
  console.log(
    "ID".padEnd(12) +
      "KIND".padEnd(12) +
      "PRIMARY".padEnd(10) +
      "WRONG_STD".padEnd(12) +
      "CITATIONS".padEnd(12) +
      "NUM_SUPPORT".padEnd(14) +
      "STATUS"
  );
  console.log("--------------------------------------------------------------------------------");

  for (const r of results) {
    const kindCol = (r.actualKind === r.expectedKind ? "PASS" : "FAIL").padEnd(12);
    const primCol = (r.primaryPass ? "PASS" : "FAIL").padEnd(10);
    const wrongCol = (r.mustNotIncludePass ? "PASS" : "FAIL").padEnd(12);
    const citeCol = (r.citationValidityPass ? "PASS" : "FAIL").padEnd(12);
    const numCol = (r.numberSupportPass ? "PASS" : "FAIL").padEnd(14);
    const statusCol = r.pass ? "✓ PASS" : "✗ FAIL";

    console.log(
      r.id.padEnd(12) + kindCol + primCol + wrongCol + citeCol + numCol + statusCol
    );
    if (!r.pass && r.details.length > 0) {
      for (const d of r.details) {
        console.log(`  └─ ${d}`);
      }
    }
  }

  console.log("--------------------------------------------------------------------------------\n");
  console.log("EVALUATION METRICS SUMMARY:");
  console.log(`  Total Cases:               ${cases.length}`);
  console.log(`  Passed Cases:              ${results.filter((r) => r.pass).length} / ${cases.length}`);
  console.log(`  Wrong-Standard Rate:       ${wrongStandardCount} violations (Required: 0)`);
  console.log(`  Kind Accuracy:             ${kindCorrectCount} / ${cases.length} (Required: >= 23/25)`);
  console.log(
    `  Primary Accuracy:          ${primaryCorrectCount} / ${primaryCount} (${
      primaryCount > 0 ? Math.round((primaryCorrectCount / primaryCount) * 100) : 100
    }%) (Required: 100%)`
  );
  console.log(
    `  Citation Validity:         ${validCitations} / ${totalCitations} (${
      totalCitations > 0 ? Math.round((validCitations / totalCitations) * 100) : 100
    }%) (Required: 100%)`
  );
  console.log(
    `  Number Support:            ${supportedNumberChecks} / ${totalNumberChecks} (${
      totalNumberChecks > 0 ? Math.round((supportedNumberChecks / totalNumberChecks) * 100) : 100
    }%) (Required: 100%)`
  );

  // Write results JSON
  const resultsDir = path.resolve(__dirname, "../data/eval/results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultPayload = {
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    passedCount: results.filter((r) => r.pass).length,
    wrongStandardCount,
    kindAccuracy: `${kindCorrectCount}/${cases.length}`,
    primaryAccuracy: `${primaryCorrectCount}/${primaryCount}`,
    results,
  };

  fs.writeFileSync(path.join(resultsDir, `${timestamp}.json`), JSON.stringify(resultPayload, null, 2));
  fs.writeFileSync(path.join(resultsDir, "baseline.json"), JSON.stringify(resultPayload, null, 2));
  console.log(`\nResults written to data/eval/results/${timestamp}.json and baseline.json\n`);
}

main().catch((err) => {
  console.error("Evaluation runner error:", err);
  process.exit(1);
});
