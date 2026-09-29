/** Dev helper: checks both Groq models answer (quota/rate-limit check). npx tsx --env-file=.env scripts/groq-ping.ts */
import { groqChat } from "../src/lib/llm";

async function main() {
  for (const model of ["chat", "fast"] as const) {
    const t = Date.now();
    try {
      const out = await groqChat([{ role: "user", content: "Reply with the word ok." }], { model, maxTokens: 400 });
      console.log(model, "OK", Date.now() - t, "ms", JSON.stringify(out).slice(0, 40));
    } catch (e) {
      console.log(model, "ERR", String(e instanceof Error ? e.message : e).replace(/gsk_\w+/g, "<key>").slice(0, 300));
    }
  }
}
main();
