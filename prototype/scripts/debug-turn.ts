/**
 * Dev helper: shows how one message is understood and what retrieval returns, without the UI.
 * Usage: npx tsx --env-file=.env scripts/debug-turn.ts "your question" ["IS 1417"]
 */
import { understandTurn } from "../src/lib/pipeline/understand";
import { retrieveMultiStore } from "../src/lib/pipeline/retrieve";
import { fuseRetrievalResults } from "../src/lib/pipeline/fuse";
import { checkRelevanceFloor } from "../src/lib/pipeline/floor";
import { adjudicateCandidates } from "../src/lib/pipeline/adjudicate";
import { buildEvidencePackage } from "../src/lib/pipeline/package";
import { generateAnswer } from "../src/lib/pipeline/answer";
import { runTrustGate } from "../src/lib/pipeline/trust";

async function main() {
  const message = process.argv[2] || "";
  const forced = process.argv[3];
  const u = await understandTurn({ message, history: [] });
  console.log("UNDERSTOOD", JSON.stringify({ intent: u.intent, lang: u.language, en: u.english_query, sq: u.standalone_query, std: u.standards, product: u.product, city: u.city }));
  const q = forced ? message : u.standalone_query || u.english_query || message;
  const canonical = (forced ? [forced] : u.standards).map((id) => ({ id }) as any);
  const raw = await retrieveMultiStore(q, canonical, forced ? [forced] : []);
  const fused = fuseRetrievalResults(raw, 60);
  const floor = checkRelevanceFloor(fused, raw);
  const adj = adjudicateCandidates(fused, raw);
  console.log("FLOOR", JSON.stringify(floor));
  console.log("ADJ", JSON.stringify(adj));
  for (const c of fused.rankedChunks.slice(0, 8)) {
    console.log(" -", c.standard_id, c.clause, c.similarity?.toFixed?.(3), (c.text || "").replace(/\s+/g, " ").slice(0, 110));
  }
  if (adj.primaryStandard) {
    const pkg = buildEvidencePackage(adj, fused.rankedChunks);
    const gen = await generateAnswer({ question: q, pkg, language: u.language });
    const trust = runTrustGate(gen.text, pkg);
    console.log("GENERATED", gen.usedFallback ? "(fallback)" : "", gen.text);
    console.log("TRUST", JSON.stringify({ allDropped: trust.allDropped, text: trust.text }).slice(0, 1500));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
