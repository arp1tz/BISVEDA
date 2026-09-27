const testCases = [
  { q: "IS 4151", label: "Exact identifier" },
  { q: "Hello", label: "Greeting" },
  { q: "standards for steel water bottles", label: "Product query" },
  { q: "tell me about helmet standards", label: "Conversational product query" },
  { q: "tell me about IS 4151", label: "Conversational standard query" },
  { q: "water bottle", label: "Vague query" },
  { q: "LED aquarium strips", label: "Out of corpus" },
  { q: "asdfghjkl", label: "Gibberish" },
  { q: "what is bis", label: "Verbatim FAQ" }
];

async function run() {
  console.log("=== RUNNING PIPELINE FLOW TESTS ===");
  for (const tc of testCases) {
    try {
      const res = await fetch("http://localhost:3000/api/v8/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: tc.q, stream: false })
      });
      const d = await res.json();
      console.log(
        `[${tc.label}] "${tc.q}"\n` +
        `  Outcome:     ${d.outcome}\n` +
        `  SpeedGate:   ${Boolean(d.isSpeedGateHit)}\n` +
        `  Conversat:   ${Boolean(d.isConversational)}\n` +
        `  TopStandard: ${d.recommendations?.[0]?.standardNumber || "none"}\n` +
        `  Score:       ${d.confidenceScore}\n` +
        `  Evidence#:   ${d.activeEvidence?.length || 0}\n`
      );
    } catch (err) {
      console.error(`Error testing ${tc.q}:`, err);
    }
  }
}

run();
