# Handoff — read this first

Session ended mid-P2/P3 verification (context limit). This is the single most
up-to-date document — it supersedes stale status lines elsewhere until you've
updated them. Read `CLAUDE.md` and `progress.md` next, then `TODO.md` for the
full phase-by-phase task list. Do NOT re-derive facts already established
here; do NOT re-read files this doc already quotes from.

## Immediate next step (do this first)

The eval suite (`npm run eval:rag` from `prototype/`) was run right before
cutoff and scored **19/32**, with real bugs found and fixed *after* that run.
**Re-run it now** — several failures are expected to resolve automatically:

```
cd C:\BISVEDA\prototype
npm run eval:rag
```

Fixes already applied since the 19/32 run (not yet re-verified together):
1. **`src/lib/pipeline/fuse.ts`** — fixed a real chunk-volume-bias bug: standard-level
   RRF ranking used to sum RRF score over every chunk hit per standard, so a
   249-chunk document (IS 9873 Part 1) could out-rank a document with one
   strongly-matching chunk (IS 2925) purely by appearing more often in the
   top-30 BM25 list. Fixed by deduplicating each retriever's hit list down to
   one entry per standard (`dedupeToStandards`) before running RRF. Verified
   fixed for the specific failing case (`"safety helmet for construction
   workers standard"` now ranks IS 2925 first, was IS 9873 Part 1) — **but
   note**: IS 2925 still classified as `"related"` not `"applies"` because its
   scope clause (clause "0" in the fused top chunks) wasn't among the
   retrieved chunks — this is a secondary, smaller issue, see "Known
   remaining issues" below.
2. **`src/lib/embeddings.ts`** — `generateEmbedding` now retries up to 2x on
   HTTP 429 (1.2s/2.4s backoff) before throwing. The eval run's many "dense
   search skipped — 429" warnings should mostly disappear.
3. **`scripts/eval-rag.ts`** — added an 800ms pace between golden cases to
   stay under Gemini's free-tier ~100/min embedding quota during a full run.
4. **`src/lib/pipeline/understand.ts`** — tightened the `out_of_scope` prompt
   rule: a plausible product/safety/certification question (even for a
   product we don't hold, e.g. pressure cookers) should classify as
   `kb_question` (which then honestly refuses as `not_in_sources` via
   retrieval), not `out_of_scope`. Was causing `nis-01`/`nis-02` to fail.
5. **`data/eval/golden.jsonl`** — fixed test expectations that were wrong
   relative to an intentional design decision, not a real bug: `id-01/02/03`
   and `gold-02` expected `kind:"identifier"`, but the new response contract
   (`respond.ts`) has no `"identifier"` kind at all — an exact IS-number
   query now correctly returns `kind:"answer"` with a real grounded response
   (a better UX than a bare lookup). Also reworded `helmet-01`'s query to say
   "motorcycle helmets" instead of generic "helmets" (the generic form
   legitimately surfaces IS 2925 too — that's not a bug).

**After re-running eval:rag**, triage what's still failing:
- `toys-03`, `toys-04`, `gold-03`, `gold-04`, `formi-01` all failed the
  first run with `refusal_not_in_sources` or `gibberish` when they should
  have answered — these are exactly the cases most likely to have been
  collateral damage from the Gemini 429s (dense search returning empty
  degrades floor/adjudication quality). Check these first; if the retry fix
  resolves most of them, good. If any still fail, debug the same way P2/P3
  bugs were found this session (see "Debugging method that worked" below).
- `helmet-05` ("construction workers" → should be IS 2925): re-verify it
  now passes `primary` after the fuse.ts fix. If `applies` vs `related`
  classification still looks wrong, see "Known remaining issues" #1.

## What's actually done (verified working, not just written)

- **P0 (cleanup)**: complete. Repo restructured, ~150 files archived to
  `C:\BISVEDA_archive`, git initialized, 2 commits (`638dd9f`, `6cc9441`).
- **P1 (knowledge base)**: complete. `prototype/data/kb/{chunks,standards,graph}.json`
  built from the 9 real PDFs — 760 chunks, 8 standards, real Gemini
  embeddings (0 fake). `prototype/data/directory/{labs,ahc}.json` — 29 real
  BIS LIMS labs, 1651 real Manak Online AHCs. Committed.
- **P2 (hybrid retrieval)**: code complete (`src/lib/kb/{store,bm25}.ts`,
  `pipeline/{retrieve,fuse,adjudicate,package}.ts` all rewritten for the
  real KB, zero hard-coded product maps). **Not yet re-verified after the
  fuse.ts fix above** — that's the immediate next step.
- **P3 (conversational orchestrator)**: code complete and was manually
  verified working end-to-end before the eval run, including the exact
  "Done when" criteria from TODO.md:
  - "tell me about helmets for bikers" → cites IS 4151 ✓
  - Multi-turn follow-up "what impact test does it need?" (no product
    named) → correctly inherits IS 4151 context, cites Annex C ✓
  - Topic switch ("tell me about helmets" → "and for toys?") → correctly
    drops helmet context, switches to toy standards ✓
  - "LED aquarium strip lights" → refused ✓
  - Citation validity and number-support were both 100% in the 19/32 run.
- **Not started**: P4 (vision rebuild), P5 (labs/AHC/hallmark/form_i tools),
  P6 (UI polish beyond the minimal fixes below), P7 (admin dashboard graph
  view), P8 (final audit + demo script).

## Real bugs found and fixed this session (for context — don't re-fix these)

Beyond the 5 fixes listed at the top, earlier in the session:
1. **`chunk.ts` merge direction bug**: tiny heading-only chunks were merging
   backward into the previous chunk instead of forward into the next one —
   fixed (`mergeTinyForward`), corrupted several standards' derived scope text.
2. **Gemini free-tier embedding quota** (~100 req/min) hit during `kb:build`
   — fixed with sequential pacing + 20s backoff on 429 in
   `scripts/kb/embed.ts` / `scripts/kb/build.ts` (the *offline* build path;
   distinct from the *runtime* fix #2 above).
3. **`isScopeChunk` regex too strict**: only matched clause "1"/"1.1", but
   IS 4151's real scope spans "1.1" AND "1.2" — widened to `/^1(\.[12])?$/`
   in a shared `isScopeChunk()` helper now in `src/lib/kb/store.ts` (used by
   `retrieve.ts`, `adjudicate.ts`, `orchestrator.ts` — don't re-duplicate it).
4. **`route.ts` pluralization bug**: `hasSpecificProduct` regex had
   `\bhelmet\b` which doesn't match "helmets" (trailing 's' breaks the word
   boundary) — fixed to `helmets?`.
5. **Both Groq `gpt-oss` models are reasoning models** that spend tokens on
   hidden chain-of-thought before the visible answer — `gpt-oss-120b` once
   spent its entire 500-token budget "thinking" and returned just the
   string "IS" as the visible answer. Fixed: `reasoning_effort: "low"` on
   every Groq call (`src/lib/llm.ts`), higher `maxTokens` (900 for
   answers), and a defensive check in `answer.ts` that rejects any visible
   response under 20 chars as a failure (triggers the evidence-only
   fallback) rather than trusting a truncated non-answer.
6. **Trust gate false-positive #1**: the generic "every number must appear
   in a cited source" check was ALSO re-validating the digits inside
   already-validated "IS 4151" references (e.g. "4151") as if they were an
   unrelated technical figure needing separate textual support — this was
   dropping nearly every sentence that named its own standard. Fixed by
   stripping IS-number references before extracting "meaningful numbers"
   in `trust.ts`.
7. **Trust gate false-positive #2**: numbers with a European decimal comma
   ("4,5 kg", common in these ISO-derived BIS standards) failed to match
   because `cleanNumber()` stripped the comma entirely (4,5→45) instead of
   treating it as a decimal point. Fixed by checking multiple normalized
   forms (raw, comma-stripped, comma-as-decimal) against the source text.
8. **Trust gate false-positive #3**: the LLM sometimes emits a Unicode
   "narrow no-break space" (U+202F) before a unit (e.g. between "4,5" and
   "kg"), which doesn't byte-match the source text's plain space (U+0020)
   even though they render identically — invisible bug, took real digging
   to find (see "Debugging method that worked"). Fixed with a
   `normalizeSpaces()` helper that collapses all Unicode space variants
   before substring comparison.
9. **Trust gate over-strictness**: a sentence that only restates the
   already-adjudicated primary standard's identity (e.g. "IS 15644 is a
   safety standard for toys") was being dropped for lacking a citation,
   even though that fact was already verified deterministically before
   generation ran. Added a narrow exception: a line naming ONLY the primary
   standard with no other technical figures doesn't need its own citation.
10. **SSE error-event bug** (was in TODO.md as a known issue): the client
    (`app/chat/[id]/page.tsx`) never handled `event: error` from the SSE
    stream, so a server-side failure left the spinner running forever.
    Fixed — added an `else if (eventType === "error")` branch.
11. **Fabricated data found and deleted** (not in the original audit):
    - `src/lib/outdated-checker.ts` — entirely invented supersession
      claims with fake "revision" details, including false claims about
      our OWN IS 4151 and IS 9873 Part 1 editions. Deleted.
    - `components/chat/v9/AnswerCard.tsx` had the SAME fabricated
      supersession logic hardcoded (`isSuperseded`/`supersededTarget`).
      Removed during the AnswerCard rewrite (see below).
    - `RefusalMessage.tsx`'s `DEFAULT_RECOMMENDED_TOPICS` suggested
      pressure cookers, packaged water — not in our KB. Trimmed to the 3
      real domains.

## Architecture as it actually stands now

```
XL  "/" home (unchanged) · "/chat/[id]" (updated for new contract)
L1  api/chat/route.ts → runPipeline() in pipeline/orchestrator.ts (SSE)
L4a pipeline/understand.ts   Groq JSON (fast model, reasoning_effort=low) + route.ts regex fallback
L5  pipeline/orchestrator.ts runTurn-equivalent (still exported as `runPipeline` — see note below)
L4b pipeline/retrieve.ts     exact + bm25 + dense + graph → pipeline/fuse.ts (RRF k=60, dedup'd) → pipeline/floor.ts
    pipeline/adjudicate.ts   groups by standard, applies/related, verified/supported_inference/insufficient_evidence
    pipeline/package.ts      real chunks only → EvidencePackage
L5  pipeline/answer.ts       Groq chat model, free-form grounded markdown (not old slot-filling)
L6  pipeline/trust.ts        line-by-line citation/number validation (see bugs #6-9 above)
L3  lib/kb/store.ts          loads data/kb + data/directory once (module cache)
    lib/kb/bm25.ts           real BM25 + dense cosine search
L0/L2 scripts/kb/*, scripts/directory/*  (offline, done in P1)
```

**Naming note**: `orchestrator.ts` still exports its main function as
`runPipeline` (not `runTurn` as TODO.md's P3.5 originally specified) because
`api/chat/route.ts` and `chat/[id]/page.tsx` both import that name and it
wasn't worth a rename mid-session. If you rename it, update both call sites
and this doc.

**Deleted in P2/P3** (confirmed zero remaining consumers before deletion):
`pipeline/product.ts`, `pipeline/generate.ts` (→ `answer.ts`),
`lib/outdated-checker.ts`, `lib/knowledge/graph-repository.ts`,
`lib/types.ts` (orphaned legacy V8 types, archived not deleted — see
`C:\BISVEDA_archive\prototype\src\lib\types.ts` if ever needed).

**`vision-inspector.ts`** was trimmed from 636→~130 lines: kept only
`runRealVisionOcr` (real, used by orchestrator) and `normalizeCmlNumber`;
deleted `inspectProductImage`, `inspectWithSovereignRules`, and every mock
data path (confirmed orphaned — their only caller was the archived
`/api/v8/vision/inspect` route). **P4 still needs to do**: verify/replace
the `gemini-3.8-flash`/`gemini-3.6-flash` model ids in the vision call list
(they ARE real, current models per a live `list models` check — the
original audit's claim that they were invalid was wrong), add the fuller
strict JSON schema (category, purity_mark, huid — see TODO.md P4.1), and
build the honest hallmark/mark-check response flow.

**Minimal UI changes made** (not full P6, just enough to compile against
the new contract and fix the known SSE bug):
- `AnswerCard.tsx`: renders `response.text` (markdown-lite: bullets,
  `**bold**`, `[S#]` citation pills) instead of the old
  headline/points/next_steps slots. Removed `QcoLine` usage (no QCO data
  exists) and the fabricated supersession banner. `DetailTabs` now gets
  only `standards`+`sources` (certification/labs props omitted — both
  optional, component degrades gracefully).
- `SourceDrawer.tsx`: fixed `clause_id`→`clause`, removed `has_file` check
  (every source is now a real chunk with a real, if not-yet-built, doc URL).
- `chat/[id]/page.tsx`: fixed the SSE error-event bug (#10 above).
- **Not done** (P6 scope): `api/docs/[docId]/route.ts` doesn't exist yet,
  so `Source.url` (`/api/docs/{doc_id}#page=N`) is a correct-shaped
  placeholder that 404s until P6.3 builds it. `QcoLine.tsx` is now fully
  orphaned (harmless dead file, not blocking compile) — candidate for
  archiving in P6. Home page, new cards (labs/ahc/hallmark/mark/form_i),
  localStorage conversation persistence, removing `DEFAULT_RECENT_CHATS`
  — all still TODO per P6.

## Known remaining issues (not yet fixed — pick these up)

1. **`applies` vs `related` classification can be too strict.** Even after
   the fuse.ts ranking fix, a standard can rank #1 correctly by RRF but
   still classify as `related` (not `applies`) if its OWN scope clause
   didn't happen to make the top-8 fused chunks (e.g. IS 2925 for
   "construction workers" — ranked #1 in `rankedStandards` but its clause
   "0"/scope chunk wasn't in `rankedChunks`). This affects the `primary`
   test check (which just takes `standards[0]`, so it still passes) but
   means `grounding` may under-report as `supported_inference` instead of
   `verified` more often than ideal. Consider: after picking the top-ranked
   standard, explicitly fetch its scope chunk via `getChunksByStandard` +
   `isScopeChunk` (like `answerForStandard` already does for the identifier
   path) and inject it into the evidence package even if it didn't
   naturally surface in the top-8 fused chunks.
2. **IS 1417 page 10 has genuine 2-column PDF text interleaving** (verified
   directly against the raw scan — not a chunker bug). Visible in answers
   as garbled text mixing clause 1.x and clause 3.x content. No code fix
   possible without a layout-aware parser (`pymupdf_layout`, flagged by the
   parser's own console warning). Documented, not silently hidden.
3. **IS 15644 (+ some IS 9873 Part 1 pages) have a corrupted embedded
   font** that turns some clause numbers into wrong characters (observed:
   "1" → "t"). Falls back to clause "0" (undifferentiated) rather than a
   fabricated clause id — honest, but citation precision is reduced for
   that portion of those two documents.
4. **`data/kb/calibration.json` calibration wasn't re-run this session**
   after the golden.jsonl rewrite (P2.6) — `scripts/calibrate-floor.ts` was
   rewritten (writes to the new `data/kb/calibration.json` path, reads via
   `getAllChunks()`) but never executed. `floor.ts` currently still reads
   from the OLD path (`data/calibration.json`, root-relative) — **you need
   to update `floor.ts`'s `getCalibratedThreshold()` candidate paths to
   check `data/kb/calibration.json` first**, then run
   `npx tsx scripts/calibrate-floor.ts` from `prototype/`, then re-run eval.
   Until then it's using the fallback default (0.45) or a stale file if one
   exists from before P0's archive.
5. **`scripts/eval-rag.ts` and `scripts/calibrate-floor.ts` import via
   relative paths** (`../src/lib/...`) rather than `@/` aliases — this
   works fine under `tsx` but means they're NOT type-checked by
   `npm run typecheck` (tsconfig excludes `scripts/`). If you refactor
   `src/lib/pipeline/*` signatures, these two scripts can silently break;
   re-run them manually to check, don't rely on `typecheck` alone.

## Debugging method that worked (reuse it)

Several of the trust-gate bugs (#6-9) were invisible from log output alone
— the "unsupported_number_4,5 kg" reason LOOKED like a straightforward
substring-matching bug but the string genuinely, visibly, contained "4,5
kg" verbatim in the source text. The only way to find the REAL cause (a
byte-level Unicode space mismatch) was to write a tiny throwaway debug
script that:
1. Extracted the exact failing string.
2. Printed `Array.from(str).map(c => c.charCodeAt(0))` for both sides of
   the comparison.
3. Diffed the char codes directly.

When a check "should obviously pass" but doesn't, don't keep guessing at
the regex — dump char codes. This found U+202F in about 2 minutes after
several failed guesses. Scratch debug scripts were written to
`prototype/_tmp_*.mjs`, loaded `.env` manually (tsx/node don't auto-load
it outside Next.js), and were deleted after use — keep doing this rather
than leaving throwaway scripts in the tree.

## Commands reference

```
cd C:\BISVEDA\prototype
npm run typecheck        # must stay 0 errors
npm run eval:rag         # the main regression gate
npm run kb:build         # rebuild data/kb/* from the 9 PDFs (idempotent, cached)
npm run dir:labs         # rebuild data/directory/labs.json
npm run dir:ahc          # rebuild data/directory/ahc.json
```

Git: repo root `C:\BISVEDA`, currently on top of commit `6cc9441` plus the
P1 commit (check `git log --oneline`) — **P2/P3 work described in this doc
has NOT been committed yet.** Commit it once eval:rag is re-verified,
following the `P{n}.{m}: …` message convention in TODO.md, with the
`Co-Authored-By` / `Claude-Session` trailer this session was using (check
`git log -1` for the exact format if continuing that convention).

PATH note (Windows-specific): if `git` isn't found in a fresh PowerShell
call, run `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")` first — each tool call is a fresh process.
