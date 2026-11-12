# BIS VEDA — Implementation Roadmap

> Living plan. Status: **Q1–Q7 approved as recommended (2026-11-12).** Design reference: [ARCHITECTURE.md](ARCHITECTURE.md). R0 and R1 are planned in detail (§2a) and **await approval to execute**. DB host: Docker Desktop (decided 2026-11-12), waiting for the owner to install it.
> Execution model: Opus 5.5 plans each task (affected modules, outcome, acceptance criteria) and reviews; Sonnet 5.5 executes. No sub-agents, new test files or paid API calls without your explicit approval per task.
> Relationship to the old plan: TODO.md P14.2 maps to R2/R3 here, P15 to R1–R3, P16 to R4. TODO.md stays as history; this file is the forward plan.

## 1. Decisions (approved 2026-11-12, as recommended)

| # | Decision | Approved answer |
|---|---|---|
| Q1 | Database | PostgreSQL 16 + pgvector + pg_trgm (in Docker), per existing D2 |
| Q2 | Where ingestion runs | Next.js app plus a small Node worker process (same repo, same TS code), with Python only as a parse/OCR subprocess as today |
| Q3 | Reranker runtime | transformers.js ONNX in-process; measure CPU latency before committing |
| Q4 | Approval workflow | Two roles (staff uploads, officer approves) with an audit log |
| Q5 | Retrieval-only eval set | Yes: ~60–100 questions with gold clause ids, no LLM calls |
| Q6 | How Sonnet executes | You switch the session model for execution turns, or approve one Sonnet sub-agent per task |
| Q7 | Corpus for the prototype | The current 9 documents plus whatever you add; do you have amendment PDFs? |

## 2a. Detailed task plans: R0 and R1 (awaiting execution approval)

Conventions: every task lists the files it touches, the expected outcome and how it gets verified. Tasks marked 💲 make paid API calls, and tasks marked 🧪 create test or eval assets. Both need your explicit OK even though the phase is approved.

> **R0.1 ✅ and R0.2 ✅ done 2026-11-12** (uncommitted). PyMuPDF 1.28.2 + RapidOCR 1.2.3 installed. `kb:build` reproduced **760 chunks, 320 nodes, 343 edges** with identical per-standard counts. 758/760 chunk texts are byte-identical; the 2 others differ only by a collapsed double space (IS 9873-1 cl. 5.16.3 and its table). A full re-embed with `EMBED_DTYPE=fp32` gave **cosine 1.000000 for all 758 unchanged chunks**, so the stored KB is fp32 and the pin is correct. Note: the fp32 weights (`model.onnx_data`, 2.27 GB, SHA-256 `1eebfb28…16b4`) had to be fetched with a resumable `curl`, because transformers.js can't resume a dropped download.

> **R0.3 ✅ done 2026-11-12.** `data/eval/retrieval.jsonl` (95 cases: 84 English, 3 raw Hinglish, 8 out-of-scope; gold = evidence regexes checked against the chunks) and `scripts/eval-retrieval.ts` (`npm run eval:retrieval [-- --baseline | --check-gold | --only ids]`). Baseline saved to `data/eval/results/retrieval-baseline.json`; numbers are in PROJECT_CONTEXT §5a. **The R1 parity test compares per-case `primary`, `evRank` and `top5` with this baseline.**

### R0.1 Python parser dependencies
- **Files:** new `prototype/requirements.txt` (`PyMuPDF`, `rapidocr-onnxruntime`, pinned versions); README "Getting started" one-liner.
- **Do:** `pip install -r requirements.txt` into the user Python 3.13. Check `rapidocr-onnxruntime` has a 3.13 wheel; if not, use a 3.12 venv in `prototype/.venv-parse` and set `PYTHON_BIN`.
- **Verify:** `npm run kb:build` runs to completion and reproduces **760 chunks** with the same per-standard counts as PROJECT_CONTEXT §5. Embeddings come from the cache, so this is fast. First run downloads bge-m3 (~2.3 GB, free).
- **Model:** Sonnet. **Cost:** none.

### R0.2 Embedding consistency check
- **Files:** `src/lib/embeddings.ts` (pin `dtype` from `EMBED_DTYPE`, default `fp32`); a throwaway script in the scratchpad, not the repo.
- **Verify:** re-embed 5 stored chunks with `embedChunk` text and compare with `chunks.json`: cosine ≥ 0.999 each. If it's lower, the stored vectors were made with a different dtype; record which one and pin that instead.
- **Model:** Sonnet. **Cost:** none.

### R0.3 🧪 Retrieval-only eval (approved in principle under Q5; confirm before creation)
- **Files:** new `prototype/data/eval/retrieval.jsonl` (60–100 cases, format in ARCHITECTURE §14), new `prototype/scripts/eval-retrieval.ts`, `package.json` script `eval:retrieval`.
- **Do:** Opus drafts the cases by reading the source clauses (gold clause numbers verified against the PDF pages). The script runs the current retrieval with no LLM (English working query in the case file) and prints Recall@1/5 (standard and clause level), MRR, wrong-standard rate and the out-of-scope refusal rate.
- **Verify:** the script runs offline and its output is recorded as the **R0 baseline** in PROJECT_CONTEXT.md.
- **Model:** Opus writes the cases (judgment), Sonnet writes the script. **Cost:** none.

### R0.4 💲 One live chat smoke test (optional, needs keys in `prototype/.env`)
- **Do:** `npm run dev`, ask 2 questions in the browser (one cited answer, one out of scope). About 4 Groq calls.
- **Verify:** an answer with a working `[S#]` drawer and a refusal. This confirms the inherited "working" status before refactoring the store.

> **R1.0 ✅ verified 2026-11-12.** Docker Desktop 29.9.3 is running, with its disk at `D:\DockerData\DockerDesktopWSL`. A throwaway container of `pgvector/pgvector:pg16` ran PostgreSQL 16.15 with vector 0.8.7 and pg_trgm 1.6, and a cosine-distance query worked. Shells opened before the install need `C:\Program Files\Docker\Docker\resources\bin` added to PATH.

> **R1 ✅ done 2026-11-12 (uncommitted).**
> - **R1.1:** `docker-compose.yml` (pgvector/pgvector:pg16, localhost-only), `db/migrations/0001_init.sql`, `scripts/db/migrate.ts` (`db:up`, `db:migrate`, `db:reset -- --yes`), `src/lib/db/client.ts`. Migrating twice is a no-op.
> - **R1.2:** `scripts/db/import-json.ts` (`db:import [-- --verify]`) imports 9 documents, 510 clauses, 760 chunks with their existing vectors, 320 nodes, 343 edges, 29 labs and 1,651 AHCs in one transaction. Read-back parity: all entities identical (labs compare null city == missing city), vectors within 3e-8.
> - **R1.3:** `store.ts` is DB-backed behind the same getters (`loadStore()` at entry points), with dense search on pgvector.
> - **Acceptance:**
>   - `eval:retrieval` is **identical to the R0 baseline on all 95 cases** (including top-5 chunk ids) for both `KB_SOURCE=db` and `KB_SOURCE=json`;
>   - typecheck and `next build` are green;
>   - in the running app, `/api/labs` (29), `/api/docs/is-4151` (PDF), admin graph (320/343), directory (29/1,651) and docs (9, with per-document chunk counts) match; unauthenticated admin requests get 401;
>   - `/api/chat` with no LLM key gave a verified answer citing IS 2925 cl. 7 MASS from Postgres. No paid calls were made.

### R1.0 Database host: **Docker Desktop (owner decision 2026-11-12)**
- Owner installs Docker Desktop. It needs admin/UAC, which Claude can't do. WSL2 + Ubuntu are already present and the hypervisor is active. C: has only 21 GB free, so move the Docker disk image to D: (356 GB free) in Settings → Resources → Advanced.
- Postgres image: `pgvector/pgvector:pg16`; data in a named volume; port 5432 bound to localhost only.
- **Verify:** `docker version` shows client and server; `docker compose up -d db` reports healthy; `SELECT extversion FROM pg_extension WHERE extname='vector'` returns a row.

### R1.1 Schema and migrations
- **Files:** new `prototype/docker-compose.yml` (option a), `prototype/db/migrations/0001_init.sql` (ARCHITECTURE §4 verbatim + view `searchable_chunks`), `scripts/db/migrate.ts`, `src/lib/db/{client,tx,types}.ts`, `package.json` scripts `db:up`, `db:migrate`, `db:reset`; deps `pg`, `@types/pg`.
- **Verify:** `db:migrate` on an empty DB creates all tables and indexes; running it twice is a no-op; `\dx` shows `vector`, `pg_trgm`, `pgcrypto`.

### R1.2 Import the current knowledge base
- **Files:** new `scripts/db/import-json.ts`; `.gitignore` adds `prototype/storage/`.
- **Do:** ARCHITECTURE §15. Existing vectors are copied, not recomputed.
- **Verify:** row counts match exactly: 9 documents, 9 published versions, 760 chunks with 1024-d vectors, 29 labs, 1,651 AHCs, and edges equal to the graph.json edge count by type. Re-running the import is idempotent (truncate and reload in one transaction).

### R1.3 DB-backed store behind the same interface
- **Files:** `src/lib/kb/store.ts` (internals rewritten, exports kept and made async), `src/lib/kb/bm25.ts` (index from DB, cached by `index_state.version`; dense → pgvector), every caller of the changed functions (orchestrator, retrieve, adjudicate, tools, admin routes; typecheck lists them).
- **Not in scope:** any retrieval behaviour change. Same candidates, same RRF, same floor, so results must match R0.
- **Verify:**
  1. typecheck + `next build` green;
  2. `eval:retrieval` matches the R0 baseline (identical ranks expected; HNSW is approximate, so allow ≤ 1 case difference and explain it);
  3. in the running app, the admin graph, documents and directory tabs load from the DB and show the same counts as before;
  4. (with R0.4 approval) one chat answer in the browser.
- **Model:** Sonnet executes; Opus reviews the diff.

### R1 exit criteria
The app runs entirely on Postgres, the JSON store is used only by the import script, results match the R0 baseline, and PROJECT_CONTEXT.md + TECHNICAL_DEBT.md (TD-08, TD-21 partially) are updated.

## 2. Phases

Priority: **P0** must have for the end-to-end prototype · **P1** strongly needed · **P2** later.

### R0 — Baseline and environment (P0, small)
Depends on: nothing.
- R0.1 Add `prototype/requirements.txt` (PyMuPDF, rapidocr-onnxruntime) + setup notes; confirm `kb:build` runs here.
- R0.2 Create `prototype/.env` from the example (you supply keys) and confirm the chat answers one question. This makes paid calls, so it needs your OK.
- R0.3 *(needs approval)* Retrieval-only eval: `data/eval/retrieval.jsonl` (query → gold standard + gold clause ids) and `scripts/eval-retrieval.ts` printing Recall@1/5, MRR and wrong-standard rate. Local embeddings only, zero API cost. Record the baseline on the current pipeline.
- **Done when:** `kb:build` reproduces the current 760 chunks; the retrieval baseline numbers are recorded in PROJECT_CONTEXT.md.

### R1 — Data layer (P0)
Depends on: Q1, R0.1.
- R1.1 Docker compose for Postgres 16 + pgvector + pg_trgm; migrations (plain SQL, numbered).
- R1.2 Schema (detailed in ARCHITECTURE.md once approved):
  - `documents` (a standard or form; stable id such as IS 4151)
  - `document_versions` (edition, year, revision label, status: draft / staged / published / superseded / rejected, file hash, file path, page count)
  - `amendments` (version_id, number, date, clauses affected, source file)
  - `clauses` (tree: version_id, number, title, parent_id, kind = clause / annex / table / figure, page span)
  - `chunks` (clause_id, text, tokens, sha256, embedding vector(1024), tsvector)
  - `edges` (src, dst, type: REFERENCES, CITES_TABLE, CROSS_REF, …)
  - `ingestion_jobs` (state machine, step, error, attempts, logs)
  - `audit_log`, `users`
  - labs and AHCs as tables
- R1.3 One-time import of the current `data/kb/*.json` + directories into the DB, so nothing regresses before the new ingestion exists.
- R1.4 Rewrite `lib/kb/store.ts` internals to read from the DB behind the **same exported functions**; the pipeline doesn't change.
- **Done when:** the app answers from Postgres with the same retrieval-eval numbers as R0 (±0), and typecheck and build are green.

### R2 — Real ingestion pipeline (P0)
Depends on: R1, Q2, Q4.
- R2.1 Upload API: PDF only, size limit, magic-byte check, SHA-256 duplicate detection, metadata form (IS number, part, title, edition/year, domain, doc type: standard / amendment / form). The file is saved to `prototype/storage/` (gitignored) and a job is created.
- R2.2 Job runner (DB-backed queue, a worker polling with `FOR UPDATE SKIP LOCKED`): states `queued → parsing → chunking → embedding → linking → staged | failed`, per-step logs, retry with backoff, reprocess action.
- R2.3 Parse: reuse `scripts/parse_pdf.py`; add a per-page text-quality score (garbage-glyph ratio, empty text) and run OCR on the pages that fail it; layout-aware block ordering for two-column pages (TD-20).
- R2.4 **Structure-aware chunker** (from RESEARCH §5): build the clause tree (parent from numbering; annexes, tables and figures as nodes), one chunk per leaf clause, split long clauses on paragraph boundaries, never split tables, embed the text with its clause path. Fix the fragment titles and the clause "0" bucket (TD-06).
- R2.5 Metadata extraction from the PDF itself (IS number, revision, year, scope clause, referenced standards, amendment number) shown to the officer as **suggestions** next to the uploader's values, with a mismatch warning.
- R2.6 Graph linking: clause cross-references ("see 5.2", "Table 3"), IS references, labs by standard.
- R2.7 Staged versions are **not searchable** until approved; publish makes them searchable and marks the previous edition superseded; reject keeps an audit record.
- R2.8 Amendments: ingest as their own document version linked to the base edition. The prototype records which clauses an amendment affects and shows a notice on those clauses; it doesn't automatically rewrite clause text.
- **Done when:** uploading one new real standard PDF through `/admin` produces a staged version you can inspect; approving it makes the chat cite it; a corrupt or non-PDF file fails with a clear error; reprocess works. Verified by doing it in the app, not by unit tests.

### R3 — Document management console (P0)
Depends on: R1, R2.
- R3.1 Replace the simulated IngestionTab with real job status (polling), logs and errors (fixes TD-01).
- R3.2 Document and version inspector: clause tree, chunks, page preview link, embeddings present yes/no, edges.
- R3.3 Metadata editing (versioned via the audit log); changes that affect retrieval trigger re-index of that version only.
- R3.4 Revision and amendment register backed by the DB (fixes TD-02); approve and reject buttons for officers.
- **Done when:** every number on the admin screens comes from the DB, and a refresh shows the same state.

### R4 — Retrieval upgrade (P0)
Depends on: R1, R2.4 (clause tree), R0.3 (eval).
- R4.1 Exact clause resolver ("IS 4151 clause 7.3", "Table 1 of IS 1417").
- R4.2 Dense via pgvector HNSW; lexical BM25 (in-process index rebuilt on publish, or Postgres full-text; decide on measured quality); trigram for fuzzy IS ids.
- R4.3 Edition filter: published current edition by default.
- R4.4 Graph expansion over clause tree + cross-references (TD-04).
- R4.5 Clause-level aggregation after RRF; cross-encoder rerank top ~30 (Q3).
- R4.6 Floor on reranker score; recalibrate with `calibrate:floor` (TD-05).
- R4.7 Context assembly: full clause + parent heading + referenced tables within a token budget; remove the 500-char truncation (TD-03).
- **Done when:** the retrieval eval improves on the R0 baseline (Recall@5 and wrong-standard rate reported), and `eval:rag` (paid, with your OK) holds citation validity 100% and wrong-standard 0.

### R5 — Evidence and answers (P1)
Depends on: R4.
- R5.1 Answers name the edition and in-force amendments of each cited standard.
- R5.2 Trust gate runs on full clause text; add a check that a quoted clause number matches its source clause.
- R5.3 Response metadata records degraded mode (no LLM, rate-limited) and the UI shows it (TD-22).
- R5.4 Re-verify the speedgate FAQs automatically on publish (TD-15).

### R6 — Security and admin hardening (P1)
- R6.1 HMAC-signed session, no default password, `staff`/`officer` roles, logout, audit of admin actions (TD-09).
- R6.2 Helpline: env-only numbers, fail closed (TD-10).

### R7 — Cleanup and docs (P2)
- Delete dead modules (TD-11), rewrite env examples, mark HANDOFF.md historical, update CLAUDE.md boundaries and README `○`/`●` markers (TD-12).

### Later / optional (P2)
- STAIR-style ToC routing experiment (RESEARCH §5), only if the eval shows a recall gap the R4 work doesn't close.
- LiteLLM gateway / provider chain (D46), WhatsApp, public API, MinIO, Keycloak.

## 3. Dependency graph

```
R0 ─┬─► R1 ─┬─► R2 ─┬─► R3
    │       │       └─► R4 ─► R5
    └───────┴─(R0.3 eval)──┘
R6, R7 independent (any time after R1)
```

## 4. Per-task protocol
1. Opus writes the task plan here (files, outcome, acceptance criteria) and you approve it.
2. Sonnet implements. Typecheck, then verify the feature in the running app (browser or curl) or with the retrieval eval.
3. Opus reviews the diff against the acceptance criteria.
4. Update PROJECT_CONTEXT.md status, TECHNICAL_DEBT.md (resolved items), progress.md, and commit only if you ask.

### R2 status (2026-11-12)
- **Slice 1 done (API and queue):** R2.1 upload checks (PDF signature, %%EOF, 50 MB limit, SHA-256 duplicate → 409), originals stored under `prototype/storage/originals/` on D:, job queued. R2.2 worker `npm run worker:ingest` claims jobs with SKIP LOCKED. Verified with curl: non-PDF 400, truncated 400, duplicate 409, new PDF 201, worker marks the job failed with the reason "parsing not built yet".
- **Not verified:** clicking through the admin form in the browser pane (pane would not render). The form now posts to the real endpoint; typecheck passes.
- **Still simulated:** the "Pipeline Visualizer" steps on the admin form and the chunk/node counts; both are removed in slice 2.
- **Next (slice 2):** R2.3 parse with quality scoring and OCR fallback, R2.4 clause tree and chunker, R2.6 graph links.
