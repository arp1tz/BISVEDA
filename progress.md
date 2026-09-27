# Prototype Progress Tracker

## 🎯 High-Level Objective
One conversational BIS assistant whose answers are cited only from the employee-uploaded PDFs (8 IS standards + Form I) plus official BIS lab/AHC directories. It does text and image chat, lab/AHC finding, hallmark and ISI checks, and Form I drafting, and has an employee graph dashboard.

## 🛠️ Architecture Decisions & Boundaries
- **Active Stack**: Next.js 15 / React 19 / Tailwind v4 / TS (prototype/); Groq (chat + intent), Gemini (vision + embeddings, 768-d); local JSON KB loaded once in memory; Python only for the offline PDF parse.
- **Core Files**: prototype/scripts/kb/build.ts · prototype/src/lib/kb/store.ts · prototype/src/lib/pipeline/{understand,retrieve,answer,trust,orchestrator}.ts · prototype/src/lib/vision.ts · prototype/src/app/api/chat/route.ts · prototype/src/app/chat/[id]/page.tsx · prototype/src/app/admin/page.tsx
- **Out of Bounds**: C:\BISVEDA_archive (everything moved there) · ingestion/upload UI · Postgres/MinIO/Python API · QCO/scheme data · voice · V8 pages · docs/reference/* (read only the cited section, on request)

## 📋 Iterative Feature Checklist
- [x] P0: git snapshot + cleanup + deps prune -> Status: Complete
- [ ] P1: KB build from PDFs + labs/AHC directories -> Status: Not Started
- [ ] P2: KB store + hybrid retrieval + eval baseline -> Status: Not Started
- [ ] P3: Conversational orchestrator + trust gate -> Status: Not Started
- [ ] P4: Vision (helmet/toy/gold/other, ISI/CM/L/HUID/purity) -> Status: Not Started
- [ ] P5: In-chat tools: labs, AHC, hallmark, Form I -> Status: Not Started
- [ ] P6: Chat UI integration + home -> Status: Not Started
- [ ] P7: Employee dashboard (Obsidian graph, docs, directories) -> Status: Not Started
- [ ] P8: Eval suite green + demo script -> Status: Not Started

## 🧠 Current Context & Active State
- **Current Task**: None (P0 done, P1 not started)
- **Latest State Blocks**:
  - P0 done: git init, snapshot commit, ~150 files/dirs moved to C:\BISVEDA_archive (V8 pages/APIs/components, legacy pipeline libs, services/, repos/, all fabricated seed JSON, scratch files). Root now: CLAUDE.md, progress.md, TODO.md, docs/, example docs/, prototype/, .env*, .gitignore.
  - Repointed 4 files (graph-repository.ts, fuse.ts, package.ts, retrieve.ts) from archived `local-db` to new stub `src/lib/kb/store.ts` (empty-result stubs, real impl in P2.1).
  - Archived whole `lib/ingestion/` (job-runner + chunker) — depended on archived db/storage/local-db/taxonomy data. P1.3 references the archived copy for the clause-chunker approach but writes fresh code.
  - Removed VisualProductInspectorModal from `/` (dead entry point per P6.5); stubbed `vision-inspector.ts`'s `standardsData` import to `[]` (archived fabricated JSON) — only affects the legacy mock inspect path P4 deletes.
  - Excluded `scripts/` from tsconfig (tsx-run standalone scripts, not part of the Next.js type graph); `eval-rag.ts`/`calibrate-floor.ts` still reference archived modules (context-resolver, llm-provider, local-db) and are non-functional until P1.7/P2.7 rewrite them.
  - Kept `prototype/data/laboratories.json` (real BIS list, no fabricated scopes) and `prototype/data/eval/golden.jsonl` for reuse.
  - Verified: `npm install`, `npm run typecheck` (0 errors), `/` and `/chat/[id]` both return 200 in dev.
  - 2 commits: `638dd9f` snapshot, `6cc9441` P0 cleanup.
- **Known Blockers / Bugs**: None. Note: `git` had to be installed mid-session; PATH must be refreshed per-PowerShell-call (`$env:Path = [Environment]::GetEnvironmentVariable(...)`) since it's a fresh process each time.
