# Prototype Progress Tracker

## 🎯 High-Level Objective
One conversational BIS assistant whose answers are cited only from the employee-uploaded PDFs (8 IS standards + Form I) plus official BIS lab/AHC directories. It does text and image chat, lab/AHC finding, hallmark and ISI checks, and Form I drafting, and has an employee graph dashboard.

## 🛠️ Architecture Decisions & Boundaries
- **Active Stack**: Next.js 15 / React 19 / Tailwind v4 / TS (prototype/); Groq (chat + intent), Gemini (vision + embeddings, 768-d); local JSON KB loaded once in memory; Python only for the offline PDF parse.
- **Core Files**: prototype/scripts/kb/build.ts · prototype/src/lib/kb/store.ts · prototype/src/lib/pipeline/{understand,retrieve,answer,trust,orchestrator}.ts · prototype/src/lib/vision.ts · prototype/src/app/api/chat/route.ts · prototype/src/app/chat/[id]/page.tsx · prototype/src/app/admin/page.tsx
- **Out of Bounds**: C:\BISVEDA_archive (everything moved there) · ingestion/upload UI · Postgres/MinIO/Python API · QCO/scheme data · voice · V8 pages · docs/reference/* (read only the cited section, on request)

## 📋 Iterative Feature Checklist
- [x] P0: git snapshot + cleanup + deps prune -> Status: Complete
- [x] P1: KB build from PDFs + labs/AHC directories -> Status: Complete
- [~] P2: KB store + hybrid retrieval + eval baseline -> Status: Code complete, re-verifying after a fuse.ts fix
- [~] P3: Conversational orchestrator + trust gate -> Status: Code complete, manually verified working; eval re-run pending
- [ ] P4: Vision (helmet/toy/gold/other, ISI/CM/L/HUID/purity) -> Status: Not Started
- [ ] P5: In-chat tools: labs, AHC, hallmark, Form I -> Status: Not Started
- [ ] P6: Chat UI integration + home -> Status: Minimal fixes only (see HANDOFF.md)
- [ ] P7: Employee dashboard (Obsidian graph, docs, directories) -> Status: Not Started
- [ ] P8: Eval suite green + demo script -> Status: Not Started

## 🧠 Current Context & Active State
- **>>> READ `C:\BISVEDA\HANDOFF.md` FIRST <<<** — full session handoff with the exact next step, every bug found and fixed, known remaining issues, and the debugging method that worked. This progress.md entry is a short pointer only; HANDOFF.md is authoritative for P2/P3 state.
- **Current Task**: Dev server running (`npm run dev`, http://localhost:3000) for manual walkthrough. Eval at 26/32 (up from 19/32); 2 remaining failures need a real `calibrate:floor` run, blocked on Gemini's **daily** embedding quota being fully exhausted (not just per-minute — confirmed via a fresh 429 on every case). Re-run `npm run calibrate:floor` once quota resets or a second `GEMINI_API_KEY` is supplied.
- **2026-09-28 session (fresh agent after handoff)**: fixed 2 real bugs found via re-running eval: (1) `route.ts` `isGibberish()` stripped spaces before the 6-consonant-run check, so multi-word queries could fuse across a word boundary (e.g. "...and physical..." → "ndphys") and false-trigger — now checked per word. (2) `floor.ts`'s `checkRelevanceFloor()` only passed on exact/graph hits or dense similarity ≥ threshold, ignoring BM25 entirely — a query with a strong lexical match but a failed/weak dense signal (embedding 429, or a short keyword-heavy query with a legitimately low cosine score) was wrongly refused as `refusal_not_in_sources` even though `adjudicate.ts` would have ranked it correctly. Added a 3rd pass condition: the top fused standard appearing anywhere in `raw.bm25Hits`. Fixed 5 of 7 eval failures (gold-03, gold-04, formi-01, toys-04, and one gibberish false-positive). Remaining 2 (gold-01, toys-03) trace to `calibration.json` being a zero-sample fallback (`n_in:0, n_out:0`, threshold hardcoded to 0.43) from a prior run that also hit the quota wall — not fixable in code, needs a real calibration run. helmet-05 (IS 4151 outranking IS 2925 for "safety helmet for construction workers") is a genuine BM25/RRF ranking call, not a bug — flagged, not fixed, see HANDOFF.md.
- **Latest State Blocks**:
  - P0 done: git init, snapshot commit, ~150 files/dirs moved to C:\BISVEDA_archive (V8 pages/APIs/components, legacy pipeline libs, services/, repos/, all fabricated seed JSON, scratch files). Root now: CLAUDE.md, progress.md, TODO.md, docs/, example docs/, prototype/, .env*, .gitignore.
  - Repointed 4 files (graph-repository.ts, fuse.ts, package.ts, retrieve.ts) from archived `local-db` to new stub `src/lib/kb/store.ts` (empty-result stubs, real impl in P2.1).
  - Archived whole `lib/ingestion/` (job-runner + chunker) — depended on archived db/storage/local-db/taxonomy data. P1.3 references the archived copy for the clause-chunker approach but writes fresh code.
  - Removed VisualProductInspectorModal from `/` (dead entry point per P6.5); stubbed `vision-inspector.ts`'s `standardsData` import to `[]` (archived fabricated JSON) — only affects the legacy mock inspect path P4 deletes.
  - Excluded `scripts/` from tsconfig (tsx-run standalone scripts, not part of the Next.js type graph); `eval-rag.ts`/`calibrate-floor.ts` still reference archived modules (context-resolver, llm-provider, local-db) and are non-functional until P1.7/P2.7 rewrite them.
  - Kept `prototype/data/laboratories.json` (real BIS list, no fabricated scopes) and `prototype/data/eval/golden.jsonl` for reuse.
  - Verified: `npm install`, `npm run typecheck` (0 errors), `/` and `/chat/[id]` both return 200 in dev.
  - 2 commits: `638dd9f` snapshot, `6cc9441` P0 cleanup.
  - **P1 (KB build), all code written and unit-verified against real HTTP fetches before writing parsers (not guessed):**
    - `scripts/kb/{types,sources,parse,chunk,embed,standards,graph,build,env}.ts`. `npm run kb:build` orchestrates all of it.
    - Registry: 9 docs (8 IS standards + Form I), duplicate IS 4151 scan excluded with a measured reason.
    - Parse: all 9 PDFs are real digital text, 0 pages needed OCR (contradicts the earlier subagent audit's IS 1417 OCR claim — verified directly, trust this over the audit).
    - Chunk: fresh regex-based clause chunker; measured 749 chunks across all 9 docs before embedding (is-4151:75, is-2925:63, is-15644:58, is-9873-1:244, is-9873-3:78, is-1417:25, is-1418:53, is-15820:150, form-i:3).
    - Embed: hit Gemini free-tier per-minute quota (429) at ~100 calls with concurrency 5 on the first attempt. Fixed: sequential embedding with 700ms pacing + 20s backoff specifically on 429. Currently re-running in the background (~15-20 min expected; ~100 chunks were already cached from the first attempt so it resumes past those).
    - `scripts/directory/labs.ts` (`dir:labs`): **completed and verified.** Design pivot from the original plan — instead of crawling `/home_lab_scope/{id}/` per lab id, discovered (via raw `Invoke-WebRequest`, not WebFetch-tool guessing) that `https://lims.bis.gov.in/home/search_is_number/?is_number__doc_no={num}` is a global reverse lookup: one request per KB standard's base IS number returns every lab nationwide with that standard in scope. 7 requests total. Output: 29 labs across IS 4151(7) IS 2925(9) IS 15644(16) IS 9873 Pt1(9) Pt3(4) IS 1417(1); 0 for IS 1418/IS 15820 (correct — those aren't standards a lab gets "recognised" against). Joined to kept `prototype/data/laboratories.json` by OSL code for city/state/lat/lng.
    - `scripts/directory/ahc.ts` (`dir:ahc`): design pivot — Manak Online's AHC list has no pagination, one fetch returns ~1,650 rows. Geocodes by unique (district,state) pair via Nominatim (not per-record). **Completed: 1651 AHCs, 1512 operative, 1490 geocoded, 161 listed without coordinates (never guessed).**
    - HTML parsing note for both scrapers: strip `<!--...-->` comments first, then take positionally-known leading cells + the *last two* real `<td>` cells per row (Validity/Remark) — verified by hand against raw fetched HTML before writing regex, not guessed.
  - **P1 final measured numbers:** 8 standards, 760 chunks (0 missing embeddings), 320 graph nodes / 343 edges (includes lab TESTS edges and ahc_region HALLMARKS edges). Full breakdown and the 2 known content-quality limitations (IS 1417 2-column interleaving on p.10; IS 15644/IS 9873 Pt.1 corrupted-font clause numbers on some pages, honestly falling back to clause "0" rather than a fabricated number) are in TODO.md's P1 done-when block — read that before touching `scripts/kb/chunk.ts` or `standards.ts` again.
  - Fixed 2 real bugs mid-build: chunk-merge direction was backward instead of forward (`chunk.ts`); Gemini free-tier embedding quota (~100 req/min) needed sequential pacing instead of concurrency-5 (`embed.ts`/`build.ts`).
  - `npm run kb:build`, `npm run dir:labs`, `npm run dir:ahc` are all idempotent and safe to re-run (cached).
- **Known Blockers / Bugs**:
  - `git` had to be installed mid-session; PATH must be refreshed per-PowerShell-call (`$env:Path = [Environment]::GetEnvironmentVariable(...)`) since it's a fresh process each time.
  - Background PowerShell tasks piped through `Select-Object -Last N` buffer ALL output until the process exits — the `.output` file stays empty the whole time it's running. Don't try to poll progress on these; just wait for the completion notification.
  - Gemini embedding free tier: ~100 requests/minute. `embed.ts`/`build.ts` now pace for this; if `GEMINI_API_KEY` changes tier, the 700ms delay in `build.ts`'s `embedAll()` can be reduced.
  - Two content-quality limitations in the source PDFs themselves (not bugs in our code) — see TODO.md P1 for detail: IS 1417 p.10 has genuine 2-column text interleaving; IS 15644 (and a few IS 9873 Pt.1 pages) have a corrupted embedded font that turns some clause numbers into wrong characters, so that content sits under clause "0" instead of a real clause id.
