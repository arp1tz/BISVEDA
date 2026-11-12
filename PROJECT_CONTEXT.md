# BIS VEDA — Project Context

> Living document. Update it whenever a module changes status. Last full audit: **2026-11-11** (Opus 5.5, static code reading + `npm run typecheck`).
> Companion files: [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) · [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) · [RESEARCH.md](RESEARCH.md) · existing [CLAUDE.md](CLAUDE.md), [progress.md](progress.md), [TODO.md](TODO.md), [docs/DECISIONS.md](docs/DECISIONS.md).

## 1. What BIS VEDA is

A conversational assistant for Indian Standards and BIS services (SIH 2026, problem statement SIH26107). Citizens, jewellers and MSMEs ask which standard applies, where to test, what a hallmark means, how to file Form I. Every knowledge answer must be grounded in official BIS documents and carry `[S#]` citations that open the exact clause and PDF page; when the documents do not support an answer it refuses and points to an official route.

Two audiences:
- **Public**: chat (text, photo, voice, phone), standards/labs/certification pages.
- **BIS staff**: `/admin` console (knowledge graph, documents, directories, ingestion, versions).

## 2. How this audit was done (verification level)

| Verified this session | Not verified this session |
|---|---|
| Repo cloned from GitHub (55 commits, HEAD `79c650f`) | *(2026-11-12)* `kb:build` reproduces the KB; stored vectors = fp32 bge-m3 (cosine 1.0) | |
| Running the app / chat end to end (no `.env` keys in the clone; needs Groq + Gemini calls, which require your permission) |
| `npm ci` + `npm run typecheck`: **0 errors** | `npm run kb:build` (Python here lacks PyMuPDF/rapidocr) |
| Static reading of pipeline, store, retrieval, admin, ingestion code | `npm run eval:rag` (costs Groq tokens) |
| Stats computed from `data/kb/*.json` (chunk counts, lengths, graph) | Voice / helpline / vision paths |
| PDFs checked for embedded outlines (none have one) | |

Status claims marked *(prior)* come from the repo's own progress logs and eval results, not from a run in this session.

## 3. Repository layout

```
BISVEDA/
├─ prototype/                      ← the whole running app (Next.js 15, React 19, TS, Tailwind v4)
│  ├─ src/app/                     pages + API routes (App Router)
│  ├─ src/lib/pipeline/            answer pipeline (understand → retrieve → fuse → floor → adjudicate → package → answer → trust)
│  ├─ src/lib/kb/                  in-memory KB store, BM25 + dense search
│  ├─ src/lib/tools/               labs, AHC, hallmark, Form I, Form I .docx
│  ├─ src/lib/{llm,vision,embeddings,i18n}.ts   Groq, Gemini vision, local bge-m3, reply localisation
│  ├─ src/components/{chat/v9,admin,a11y}/      UI
│  ├─ scripts/kb/                  offline KB build (parse → chunk → embed → standards → graph)
│  ├─ scripts/directory/           scrapers for BIS LIMS labs + Manak Online AHCs
│  ├─ scripts/*.py                 PyMuPDF + RapidOCR PDF parser (called by kb:build)
│  └─ data/kb, data/directory, data/eval   generated JSON "database" + golden eval sets
├─ example docs uploaded by employees/   10 source PDFs (8 IS standards, 1 duplicate excluded, Form I)
├─ scripts/boot.py, boot.ps1/.bat  all-in-one launcher; scripts/voice/ Python voice bridge (Exotel)
├─ BISVEDA_VoiceCall*.ipynb        Colab notebooks for the phone bridge
└─ docs/                           PRD, decision log, demo script, 3,142-line reference architecture
```

## 4. Architecture as built

```
Browser ──POST /api/chat (SSE: stage | response | error)──► runPipeline (orchestrator.ts, 1,016 lines)
   understand.ts  language/script detect, English working query, intent (Groq JSON; regex fallback route.ts)
   speedgate.ts   verified FAQ fast path
   tools/*        labs · AHC · hallmark/HUID/CM-L format · Form I   (directory JSON, deterministic rules)
   retrieve.ts    exact IS-number pin + BM25 (in-process) + dense (bge-m3 cosine, brute force) + "graph" (context carry-over)
   fuse.ts        RRF k=60, exact pinned (+1000)
   floor.ts       calibrated cosine floor 0.67 (data/kb/calibration.json)
   adjudicate.ts  rule-based: standard "applies" iff its own scope clause was retrieved
   package.ts     [S#] evidence (text truncated to 500 chars)
   answer.ts      Groq gpt-oss-120b writes answer from evidence only; evidence-only fallback without LLM
   trust.ts       deterministic sentence gate: unknown [S#] stripped, unsupported numbers / IS ids dropped, refuse if nothing survives
Data (since R1, 2026-11-12): PostgreSQL 16 + pgvector (docker-compose) → lib/kb/store.ts snapshot via loadStore();
      dense search runs in Postgres. data/kb/*.json stays the import source and the KB_SOURCE=json fallback.
```

**Technologies**: Next.js 15 / React 19 / TypeScript 5 / Tailwind 4 · Groq (`openai/gpt-oss-120b` chat, `gpt-oss-20b` fast, Whisper STT) · Gemini (vision only) · `@huggingface/transformers` running `Xenova/bge-m3` locally (dense only) · Python PyMuPDF + RapidOCR (offline parse) · react-force-graph-2d, Leaflet, docx · Exotel/Twilio + Python voice bridge. **No database, no queue, no object store.** Auth is a single shared password.

## 5. Knowledge base (measured from `data/kb`, 2026-11-11)

| Item | Value |
|---|---|
| Source docs | 9 (IS 4151, IS 2925, IS 15644, IS 9873 Pt 1, IS 9873 Pt 3, IS 1417, IS 1418, IS 15820, Form I); duplicate IS 4151 scan excluded |
| Chunks | 760 (IS 9873-1: 249, IS 15820: 151, IS 9873-3: 80, IS 4151: 76, IS 2925: 63, IS 15644: 58, IS 1418: 54, IS 1417: 26, Form I: 3) |
| Chunk length | median 608 chars, max 2,388; 412 chunks > 500 chars |
| Clause "0" (unattributed) | 80 chunks (front matter + corrupted-font pages) |
| Graph | 320 nodes (214 clause, 38 reference, 29 lab, 26 AHC region, 8 standard, 4 domain, 1 form) · 343 edges |
| Directories | 29 labs (BIS LIMS), 1,651 AHCs (Manak Online; 1,490 geocoded) |
| Eval | golden 32 cases, multilingual 24; last clean baseline 31/32 *(prior, 2026-09-29)* |
| Embedded PDF outline (ToC) | **none** of the 10 PDFs |

## 5a. Retrieval baseline (R0.3, measured 2026-11-12, `npm run eval:retrieval`)

95 cases in `data/eval/retrieval.jsonl`. The gold is evidence text verified against the chunks (`--check-gold`). The eval runs retrieval only, with no LLM. In production, understand.ts (Groq) and route.ts run first: they often name the standard, which pins retrieval to it, and they refuse many off-topic products. So these numbers describe the retrieval layer alone. Full per-case output: `data/eval/results/retrieval-baseline.json`.

| Metric | English working query (n=84) |
|---|---|
| Standard ranked first / adjudicated primary correct | 88.1% / 79.8% (**wrong standard 20.2%**) |
| Evidence chunk at rank 1 / in top 5 / in top 50 | 20.2% / 63.1% / 92.9% (MRR 0.386) |
| Evidence in the [S#] package (full chunk) / in the text actually sent to the LLM | 52.4% / 47.6% (4 cases lost only to the 500-char cut, TD-03) |
| Raw Hinglish with no LLM (n=3) | 0/3 evidence found |
| **Out-of-scope refused by retrieval (n=8)** | **0/8**: the 0.67 cosine floor sits below the similarity of unrelated queries (0.69–0.74), and the active-standard bypass passes everything (TD-05) |
| Median retrieval time | ~100 ms (CPU) |

What this means: the right document is usually found, but the right clause often isn't in the 8 chunks passed on (the evidence is in the top 50 for 93% of cases, yet in the package for only 52%). The retrieval floor does no filtering on its own. These are the R4 targets: clause-level aggregation, a reranker, a reranker-based floor, and full-clause context.

## 6. Module status

Legend: ✅ working · 🟡 partial · 🔴 broken / simulated · ⚪ not implemented. *(prior)* = per repo logs, not re-run this session.

### Public answer path
| Module | Status | Notes |
|---|---|---|
| Chat SSE API + chat UI, persistence (localStorage) | ✅ *(prior)* | `api/chat/route.ts`, `app/chat/[id]/page.tsx` |
| Understand (language, intent, follow-up rewrite) | ✅ *(prior)* | Depends on Groq; regex fallback exists |
| Hybrid retrieval (exact + BM25 + dense) + RRF | ✅ *(prior)* | Works at 760 chunks; in-memory, brute force |
| "Graph" retrieval | 🟡 | Only carries the active standard's scope chunks forward; graph edges (REFERENCES, clause tree) unused at query time |
| Clause-level exact match ("IS 4151 clause 7.3") | ⚪ | Only IS-number pinning exists |
| Cross-encoder reranking | ⚪ | Planned (bge-reranker-v2-m3) |
| Relevance floor | 🟡 | Calibrated, but bypassed whenever a standard is in context (see TECHNICAL_DEBT TD-05) |
| Adjudication + evidence package | 🟡 | Works; evidence truncated to 500 chars (TD-03) |
| Answer generation + evidence-only fallback | ✅ *(prior)* | |
| Trust gate | ✅ *(prior)* | Strong deterministic numeric/IS check; checks against truncated text |
| Edition/amendment awareness in answers | ⚪ | One edition per standard, no amendment data |
| Verified FAQ fast path | ✅ *(prior)* | 705 lines of hand-written content |
| Multilingual answers, voice input, read-aloud, page translation | ✅ *(prior)* | |
| Vision (photo → marks, purity, HUID format) | ✅ *(prior)* | Gemini |
| Labs / AHC finders, hallmark, CM/L, Form I + .docx | ✅ *(prior)* | Directory data from scrapers |
| Phone helpline (Exotel bridge) | 🟡 | Needs external Python/Colab bridge; fallback personal number hardcoded (TD-10) |

### Staff side
| Module | Status | Notes |
|---|---|---|
| Admin auth | 🟡 | Works, but forgeable cookie + default password (TD-09) |
| Knowledge graph explorer | ✅ *(prior)* | Read-only view of graph.json |
| Document + chunk browser | ✅ *(prior)* | Read-only |
| Directory tables | ✅ *(prior)* | |
| **Document ingestion (upload → index)** | 🔴 | Fully simulated: hardcoded records, fake logs, file never saved (TD-01) |
| **Revision / amendment registration** | 🔴 | React state only, lost on refresh, no effect on answers (TD-02) |
| Metadata editing, reprocessing, job status, approval | ⚪ | |
| Database + schema | ✅ R1 (2026-11-12) | PostgreSQL 16 + pgvector in Docker; the app reads the published KB from it (parity with the JSON KB verified); `KB_SOURCE=json` fallback |
| Versioning / amendments | 🟡 | Schema exists (document_versions, amendments as versions, searchable view); nothing creates new versions until R2 |

### Offline build
| Module | Status | Notes |
|---|---|---|
| `kb:build` parse → chunk → embed → graph | ✅ verified 2026-11-12 (760 chunks reproduced) | Regex clause chunker; flat breadcrumb; known parse issues on IS 1417 p.10 and IS 15644 fonts |
| `dir:labs`, `dir:ahc` scrapers | ✅ *(prior)* | Throttled, cached |
| `eval:rag`, `eval:multi`, `calibrate:floor` | ✅ *(prior)* | End-to-end only, consume Groq tokens; no retrieval-only metrics |

## 7. Hard rules carried forward (from CLAUDE.md)
Facts only from the knowledge base and official directories · every KB answer carries `[S#]` and the trust gate is final · never declare a mark/licence/HUID valid · vision output is `user_provided`, never cited · model ids from env · local bge-m3 embeddings, no placeholder vectors · emit only stage events that ran.

## 8. Direction and open items
- **2026-11-12:** Q1–Q7 approved as recommended. Target design is in ARCHITECTURE.md; CLAUDE.md boundaries were updated to put ingestion and Postgres in scope.
- **Dev machine (checked 2026-11-12):** Windows 11, 8 cores, 16 GB RAM, Node 22.19, Python 3.13.5 (PyMuPDF 1.28.2 + RapidOCR installed 2026-11-12), **no Docker yet** (owner installing Docker Desktop, H1). bge-m3 fp32 weights are cached in `prototype/node_modules/@huggingface/transformers/.cache/` (a fresh `npm ci` deletes them; re-fetch with a resumable download).
- **Verified facts for the design:** `onnx-community/bge-reranker-v2-m3-ONNX` exists with a transformers.js tag (candidate reranker). PGlite supports pgvector and pg_trgm (fallback DB host option).
- `HANDOFF.md` is stale (describes P5–P8 as not built, Windows paths `C:\BISVEDA`). Treat as history.
- Root `.env.example` describes a V8 Python stack on port 8000 that does not exist in this repo.
