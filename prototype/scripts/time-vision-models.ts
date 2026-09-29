/**
 * Dev helper: times each Gemini vision model candidate on one image (no output of keys).
 * Usage: npx tsx --env-file=.env scripts/time-vision-models.ts public/samples/hallmarked_gold.jpg
 */
import fs from "fs";

const img = process.argv[2] || "public/samples/hallmarked_gold.jpg";
const data = fs.readFileSync(img).toString("base64");
const models = [process.env.GEMINI_VISION_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"].filter(
  (m): m is string => Boolean(m)
);

async function main() {
  console.log("configured GEMINI_VISION_MODEL:", process.env.GEMINI_VISION_MODEL || "(unset)");
  for (const model of models) {
    const t = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Read any hallmark, purity mark or HUID on this item. Reply as JSON {\"text\": \"...\"}." }, { inline_data: { mime_type: "image/jpeg", data } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.text();
      console.log(model.padEnd(24), res.status, `${Date.now() - t}ms`, res.ok ? body.match(/"text":\s*"([^"]{0,80})/)?.[1] : body.slice(0, 90).replace(/\s+/g, " "));
    } catch (e) {
      console.log(model.padEnd(24), "ERR", `${Date.now() - t}ms`, String(e).slice(0, 80));
    }
  }
}
main();
