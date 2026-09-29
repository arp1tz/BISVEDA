/** Dev helper: one full pipeline turn without the server. npx tsx --env-file=.env scripts/debug-pipeline.ts "question" [lang] */
import { runPipeline } from "../src/lib/pipeline/orchestrator";

async function main() {
  const r = await runPipeline({ query: process.argv[2] || "", conversation_id: "debug", history: [], preferredLanguage: process.argv[3] });
  console.log(r.kind, r.language, `${(r.sources || []).length} sources`, (r.standards || []).map((s) => s.id).join(", "));
  console.log(r.text || r.refusal?.message);
}
main();
