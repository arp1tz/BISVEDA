const GOLDEN_FLOWS = [
  {
    name: "Flow 1: Exact Identifier Lookup",
    payload: { query: "IS 4151", stream: false },
    assert: (res) => {
      const pass = res.isSpeedGateHit === true && res.recommendations?.[0]?.standardNumber === "IS 4151";
      return { pass, detail: `SpeedGate=${res.isSpeedGateHit}, Standard=${res.recommendations?.[0]?.standardNumber}` };
    },
  },
  {
    name: "Flow 2: Product Standards Query (Full RAG Pipeline)",
    payload: { query: "standards for steel water bottles", stream: false },
    assert: (res) => {
      const pass = res.isSpeedGateHit === false && res.recommendations?.[0]?.standardNumber === "IS 17526" && res.activeEvidence?.length > 0;
      return { pass, detail: `SpeedGate=${res.isSpeedGateHit}, Standard=${res.recommendations?.[0]?.standardNumber}, EvidenceCount=${res.activeEvidence?.length}` };
    },
  },
  {
    name: "Flow 3: Conversational Product Query (No False Rejection)",
    payload: { query: "tell me about helmet standards", stream: false },
    assert: (res) => {
      const pass = res.isSpeedGateHit === false && res.outcome === "answered" && res.recommendations?.[0]?.standardNumber === "IS 4151" && res.activeEvidence?.length > 0;
      return { pass, detail: `Outcome=${res.outcome}, Standard=${res.recommendations?.[0]?.standardNumber}, EvidenceCount=${res.activeEvidence?.length}` };
    },
  },
  {
    name: "Flow 4: Pure Greeting (Intent Gate Static Response)",
    payload: { query: "Hello", stream: false },
    assert: (res) => {
      const pass = res.isConversational === true && (res.activeEvidence?.length || 0) === 0;
      return { pass, detail: `Conversational=${res.isConversational}, EvidenceCount=${res.activeEvidence?.length || 0}` };
    },
  },
  {
    name: "Flow 5: Ambiguous Product Scope (Disambiguation Trap)",
    payload: { query: "water bottle", stream: false },
    assert: (res) => {
      const pass = res.outcome === "disambiguation_required" && res.disambiguation?.isAmbiguous === true;
      return { pass, detail: `Outcome=${res.outcome}, Ambiguous=${res.disambiguation?.isAmbiguous}` };
    },
  },
  {
    name: "Flow 6: Out of Corpus Product (Named Boundary Refusal)",
    payload: { query: "LED aquarium strips", stream: false },
    assert: (res) => {
      const pass = res.outcome === "refused_insufficient_evidence" && res.synthesis?.includes("Out of Corpus");
      return { pass, detail: `Outcome=${res.outcome}, RefusalDetected=${res.synthesis?.includes("Out of Corpus")}` };
    },
  },
  {
    name: "Flow 7: Multi-Turn Conversation Memory",
    payload: {
      query: "what about the testing requirements?",
      conversation_history: [
        { role: "user", content: "tell me about IS 4151 helmet standard" },
        { role: "assistant", content: "IS 4151 governs protective helmets for two-wheeler riders." }
      ],
      stream: false,
    },
    assert: (res) => {
      const pass = res.outcome === "answered" && res.recommendations?.[0]?.standardNumber?.includes("4151") && res.activeEvidence?.length > 0;
      return { pass, detail: `Outcome=${res.outcome}, Standard=${res.recommendations?.[0]?.standardNumber}, EvidenceCount=${res.activeEvidence?.length}` };
    },
  },
  {
    name: "Flow 8: Verbatim Official FAQ",
    payload: { query: "what is bis", stream: false },
    assert: (res) => {
      const pass = res.isSpeedGateHit === true && res.outcome === "answered";
      return { pass, detail: `SpeedGate=${res.isSpeedGateHit}, Outcome=${res.outcome}` };
    },
  },
];

async function runGoldenFlows() {
  console.log("====================================================");
  console.log("       BISVEDA V8 GOLDEN FLOWS INTEGRATION SUITE    ");
  console.log("====================================================\n");

  let passedCount = 0;

  for (const flow of GOLDEN_FLOWS) {
    const t0 = Date.now();
    try {
      const res = await fetch("http://localhost:3000/api/v8/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(flow.payload),
      });
      const d = await res.json();
      const dur = Date.now() - t0;
      const { pass, detail } = flow.assert(d);

      if (pass) {
        passedCount++;
        console.log(`[PASS] ${flow.name} (${dur}ms)\n       Details: ${detail}`);
      } else {
        console.error(`[FAIL] ${flow.name} (${dur}ms)\n       Details: ${detail}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${flow.name}:`, err.message);
    }
  }

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passedCount} / ${GOLDEN_FLOWS.length} GOLDEN FLOWS PASSED`);
  console.log(`====================================================`);

  if (passedCount !== GOLDEN_FLOWS.length) {
    process.exit(1);
  }
}

runGoldenFlows();
