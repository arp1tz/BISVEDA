/**
 * BISVEDA V9 — Verification for User-Reported Issues
 */

import { runPipeline } from "../src/lib/pipeline/orchestrator";
import { normalizeQuery } from "../src/lib/pipeline/normalize";
import { routeQuery } from "../src/lib/pipeline/route";

async function main() {
  console.log("================================================================================");
  console.log("  Testing User-Reported Fixes (Context Retention & Attachments)");
  console.log("================================================================================\n");

  // 1. Test Attachment Query Normalization & Routing (Was giving gibberish error)
  const attachmentQuery = "[Attachment: helment.jpg] which standards apply to my helmet";
  console.log(`1. Testing query with attachment: "${attachmentQuery}"...`);
  const normalized = normalizeQuery(attachmentQuery);
  const route = routeQuery(normalized);
  console.log(`   - Normalized text: "${normalized.normalizedText}"`);
  console.log(`   - Route kind: "${route.kind}" (Expected NOT to be 'gibberish')`);

  const attachRes = await runPipeline({ query: attachmentQuery });
  console.log(`   - Pipeline kind: ${attachRes.kind}`);
  console.log(`   - Primary Standard: ${attachRes.primary_standard?.id} — ${attachRes.primary_standard?.title}`);
  if (attachRes.kind !== "answer" || attachRes.primary_standard?.id !== "IS 4151") {
    throw new Error("Attachment query failed to resolve to IS 4151!");
  }
  console.log("   ✅ Attachment query successfully resolved to IS 4151 without gibberish failure!\n");

  // 2. Test Multi-Turn Conversational Context ("Explain this simply...")
  console.log("2. Testing Multi-Turn Context Retention ('Explain this simply...')...");
  // Turn 1: Helmet query
  const turn1Res = await runPipeline({
    query: "Are motorcycle helmets mandatory under BIS in India?",
    conversation_id: "test-conv-ctx",
  });
  console.log(`   - Turn 1 Result: ${turn1Res.primary_standard?.id}`);

  // Turn 2: User clicks "Explain simply"
  const turn2Query = "Explain this simply in everyday language without technical jargon.";
  const turn2Res = await runPipeline({
    query: turn2Query,
    conversation_id: "test-conv-ctx",
    history: [
      {
        query: "Are motorcycle helmets mandatory under BIS in India?",
        response: turn1Res,
      },
    ],
  });
  console.log(`   - Turn 2 Kind: ${turn2Res.kind} (Expected 'answer', NOT 'refusal')`);
  console.log(`   - Turn 2 Headline: "${turn2Res.answer?.headline}"`);
  console.log(`   - Turn 2 Standard: ${turn2Res.primary_standard?.id}`);

  if (turn2Res.kind !== "answer" || turn2Res.primary_standard?.id !== "IS 4151") {
    throw new Error(`Turn 2 failed! Kind: ${turn2Res.kind}, Standard: ${turn2Res.primary_standard?.id}`);
  }
  console.log("   ✅ Turn 2 context retained IS 4151 and generated simplified explanation!\n");

  // 3. Test Follow-up question: "which labs can test this?"
  console.log("3. Testing Follow-up query: 'which labs can test this?'...");
  const turn3Res = await runPipeline({
    query: "which labs can test this?",
    conversation_id: "test-conv-ctx",
    history: [
      {
        query: "Are motorcycle helmets mandatory under BIS in India?",
        response: turn1Res,
      },
    ],
  });
  console.log(`   - Turn 3 Labs count: ${turn3Res.labs?.length}`);
  console.log(`   - Turn 3 Standard: ${turn3Res.primary_standard?.id}`);
  if (!turn3Res.labs || turn3Res.labs.length === 0) {
    throw new Error("Turn 3 failed to find accredited labs for the active standard!");
  }
  console.log("   ✅ Turn 3 successfully inherited active standard and found accredited labs!\n");

  console.log("================================================================================");
  console.log("  ALL USER-REPORTED SCENARIOS PASSED WITH CONTEXT RETENTION!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
