# Prototype Progress Tracker

## 🎯 High-Level Objective
One conversational BIS assistant whose answers are cited only from the employee-uploaded PDFs (8 IS standards + Form I) plus official BIS lab/AHC directories. It does text and image chat, lab/AHC finding, hallmark and ISI checks, and Form I drafting, and has an employee graph dashboard.

## 🛠️ Architecture Decisions & Boundaries
- **Active Stack**: Next.js 15 / React 19 / Tailwind v4 / TS (prototype/); Groq (chat + intent), Gemini (vision + embeddings, 768-d); local JSON KB loaded once in memory; Python only for the offline PDF parse.
- **Core Files**: prototype/scripts/kb/build.ts · prototype/src/lib/kb/store.ts · prototype/src/lib/pipeline/{understand,retrieve,answer,trust,orchestrator}.ts · prototype/src/lib/vision.ts · prototype/src/app/api/chat/route.ts · prototype/src/app/chat/[id]/page.tsx · prototype/src/app/admin/page.tsx
- **Out of Bounds**: C:\BISVEDA_archive (everything moved there) · ingestion/upload UI · Postgres/MinIO/Python API · QCO/scheme data · voice · V8 pages · docs/reference/* (read only the cited section, on request)

## 📋 Iterative Feature Checklist
- [ ] P0: git snapshot + cleanup + deps prune -> Status: Not Started
- [ ] P1: KB build from PDFs + labs/AHC directories -> Status: Not Started
- [ ] P2: KB store + hybrid retrieval + eval baseline -> Status: Not Started
- [ ] P3: Conversational orchestrator + trust gate -> Status: Not Started
- [ ] P4: Vision (helmet/toy/gold/other, ISI/CM/L/HUID/purity) -> Status: Not Started
- [ ] P5: In-chat tools: labs, AHC, hallmark, Form I -> Status: Not Started
- [ ] P6: Chat UI integration + home -> Status: Not Started
- [ ] P7: Employee dashboard (Obsidian graph, docs, directories) -> Status: Not Started
- [ ] P8: Eval suite green + demo script -> Status: Not Started

## 🧠 Current Context & Active State
- **Current Task**: None
- **Latest State Blocks**: Plan approved; TODO.md holds the task-level detail. Old TODO preserved as TODO.old.md (archive in P0.2).
- **Known Blockers / Bugs**: None
