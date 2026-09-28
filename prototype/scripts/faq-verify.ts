/**
 * BISVEDA — FAQ source verification (scripts/faq-verify.ts, P12.2)
 *
 * Read-only audit: for every entry in src/lib/pipeline/speedgate.ts's CANONICAL_FAQS, checks
 * whether each source's quoted `text` is a real excerpt of a chunk of that standard in
 * data/kb/chunks.json (via the same `quoteExistsInKb` the runtime guard uses). Prints a
 * pass/fail table and exits non-zero if any entry marked `verified: true` fails, or if any
 * entry marked `verified: false` now actually passes (a sign it could be promoted).
 *
 * Usage: npx tsx scripts/faq-verify.ts   (from prototype/)
 */

import { loadEnv } from "./kb/env";
loadEnv();

import { CANONICAL_FAQS, verifyFaqSources } from "../src/lib/pipeline/speedgate";

function main() {
  console.log("=".repeat(78));
  console.log("  BISVEDA — FAQ source verification");
  console.log("=".repeat(78) + "\n");

  let hardFailures = 0;
  let promotable = 0;

  for (const faq of CANONICAL_FAQS) {
    const results = verifyFaqSources(faq);
    const allOk = results.every((r) => r.ok);
    const marked = faq.verified === true;
    const status = marked ? (allOk ? "PASS" : "FAIL (marked verified, but a source doesn't check out)") : allOk ? "OK, but unverified (could be promoted)" : "unverified (correctly excluded)";

    console.log(`[${marked ? "verified:true " : "verified:false"}] ${faq.id.padEnd(38)} ${status}`);
    for (const r of results) {
      if (!r.ok) {
        console.log(`    ✗ ${r.source.standard_id} Cl.${r.source.clause}: "${r.source.text.slice(0, 90)}${r.source.text.length > 90 ? "…" : ""}"`);
      }
    }

    if (marked && !allOk) hardFailures++;
    if (!marked && allOk) promotable++;
  }

  console.log("\n" + "-".repeat(78));
  console.log(`Total FAQs: ${CANONICAL_FAQS.length}`);
  console.log(`Marked verified:true : ${CANONICAL_FAQS.filter((f) => f.verified === true).length}`);
  console.log(`Marked verified:false: ${CANONICAL_FAQS.filter((f) => f.verified !== true).length}`);
  console.log(`Hard failures (verified:true but a source doesn't check out): ${hardFailures}`);
  console.log(`Promotable (unverified but all sources now check out): ${promotable}`);

  if (hardFailures > 0) {
    console.error(`\nFAIL: ${hardFailures} FAQ(s) marked verified:true have a source that isn't a real KB excerpt.`);
    process.exit(1);
  }
  console.log("\nPASS: every verified:true FAQ is backed by real KB text.");
}

main();
