/** Dev helper: prints only the routing decision for each message. npx tsx --env-file=.env scripts/debug-understand.ts "q1" "q2" */
import { understandTurn } from "../src/lib/pipeline/understand";

async function main() {
  for (const q of process.argv.slice(2)) {
    const u = await understandTurn({ message: q, history: [] });
    console.log(q, "=>", u.intent, u.language, JSON.stringify(u.english_query), JSON.stringify(u.product ?? null), "fallback:", u.usedFallback);
  }
}
main();
