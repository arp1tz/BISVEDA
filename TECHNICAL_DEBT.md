# BIS VEDA — Technical Debt Register

> Every item was found by reading the code on 2026-11-11 unless marked otherwise. Severity: **S1** blocks the prototype objective or violates the no-fabrication rule · **S2** degrades answer quality or reliability · **S3** hygiene.
> When an item is fixed, move it to "Resolved" with the commit hash. Do not delete history.

## Open

### Ingestion and document management

| ID | Sev | Where | Problem | Fix direction |
|---|---|---|---|---|
| TD-01 | S1 | `src/app/api/admin/ingest/route.ts`, `src/components/admin/IngestionTab.tsx:150-174` | Ingestion is simulated. `GET` returns 4 hardcoded records with editions that contradict the KB (e.g. "IS 4151:2015 Revision 4" while the KB holds the 1993 Third Revision; "IS 1417:2016") and a Toys QCO gazette that is not in the KB. `POST` invents chunk/node counts from file size (`file_size_kb / 45`) and marks the record "indexed"; the file is never uploaded. The UI prints fabricated logs ("Extracted 38 pages", "avg 380 tokens/chunk") behind `setTimeout`s. | Replace with the real pipeline (Roadmap R2). Interim: TODO.md P14.2. |
| TD-02 | S1 | `src/components/admin/DocumentsTab.tsx:330-391` | "Register revision" and "Add amendment" only mutate React state: lost on refresh, never persisted, no effect on retrieval or answers, yet the UI marks the previous edition "superseded". | Persisted edition/amendment model (R1, R3). |
| TD-18 | S2 | data model | One edition per standard, no amendment records, no `valid_from/valid_to`; answers cannot reliably name the edition used. | Schema `document_versions`, `amendments` (R1). |

### Retrieval and answer quality

| ID | Sev | Where | Problem | Fix direction |
|---|---|---|---|---|
| TD-03 | S2 | `src/lib/pipeline/package.ts` (`text.slice(0, 500)`); measured R0.3: 4/84 eval cases have the right chunk in the package but the evidence past the cut | Evidence given to the LLM is truncated to 500 chars. 412 of 760 chunks are longer (median 608, max 2,388). The model sees partial clauses, and the trust gate checks numbers against the truncated text, so correct sentences citing the tail get dropped and facts in the tail can't be cited. | Context assembly with full clause text under a token budget (R4). |
| TD-04 | S2 | `src/lib/pipeline/retrieve.ts` | The "graph" retriever is conversation carry-over (scope chunks of the active standard). `graph.json` REFERENCES edges and the clause hierarchy are never used at query time (only by the admin NodeInspector). | Real graph expansion: parent clause, referenced clauses/tables, referenced standards (R4). |
| TD-05 | S1 | `src/lib/pipeline/floor.ts`, `data/kb/calibration.json` | **Measured (R0.3): retrieval refuses 0/8 out-of-scope queries.** The calibrated cosine threshold 0.67 is below the top similarity of clearly unrelated queries (pressure cooker 0.716, packaged water 0.741, TMT bars 0.740, cement 0.694), so the floor never fires; the system relies on upstream routing and the trust gate. In addition, any exact or context ("graph") hit passes the floor with score 1.0, and any BM25 hit on the top standard passes regardless of score. An off-topic follow-up while a standard is active is treated as grounded; the trust gate is then the only defence. | Floor on reranker score per candidate, not on presence of a standard (R4). |
| TD-06 | S2 | `scripts/kb/chunk.ts`, chunks.json | Breadcrumb is flat (`[doc title, clause heading]`), no parent clause path (3.1 does not know it sits under 3 TERMINOLOGY). Clause titles are sometimes sentence fragments ("1.2 The helmets covered by this standard are"). 80 chunks have clause "0". | Clause tree builder + title heuristics (R2). |
| TD-20 | S2 | `scripts/parse_pdf.py` *(prior, documented in TODO.md P1)* | IS 1417 p.10 two-column interleaving; IS 15644 / IS 9873-1 corrupted embedded font garbles clause numbers. Also seen 2026-11-12: symbol glyphs are lost, e.g. "(10 +0,5 0)°" is extracted as "(\n)\n0,5\n0\n10 +\nD" in IS 9873-1 cl. 5.16.3, so a figure with a degree sign can't be cited intact. | Layout-aware block ordering + per-page text-quality score that triggers OCR (R2). |
| TD-23 | S2 | `scripts/kb/chunk.ts` ids, `src/lib/kb/bm25.ts`, `src/lib/pipeline/fuse.ts` | **22 chunk ids collide (29 extra rows)**, e.g. `is-4151-11-0` is both "11 INSTRUCTIONS" and "11 MARKING", and `is-4151-ANNEX_C-0` covers two different Annex C chunks. BM25's token map and RRF fusion key on `chunk_id`, so one chunk of each pair is shadowed: its tokens are overwritten and it merges into the other. This explains, for example, `h4151-marking` never finding the marking clause in the R0 baseline. | Unique ids (R2 chunker uses row uuids); a quick interim fix would be suffixing duplicates, measured with `eval:retrieval`. |
| TD-08 | S2 | `src/lib/kb/bm25.ts`, `data/kb/chunks.json` | *(R1: dense search now runs in PostgreSQL; vectors are no longer loaded into the app.)* Previously: dense search was brute-force cosine over vectors stored in a 23.8 MB JSON file loaded into every process. BM25 recounts term frequency with `filter` per query term per chunk. Fine at 760 chunks; not at the full catalogue. | pgvector HNSW / persisted index (R1/R4). |
| TD-13 | S2 | `data/eval/*`, `scripts/eval-rag.ts` | Eval is 32 + 24 end-to-end cases (only 16 assert a primary standard). Every run spends Groq tokens. No retrieval-only metric (clause Recall@k, MRR), so retrieval changes can't be measured cheaply or precisely. | Retrieval-only eval with gold clause ids, zero LLM calls (R0, needs your approval). |
| TD-15 | S3 | `src/lib/pipeline/speedgate.ts` (705 lines) | Hand-written FAQ answers; only `verified: true` ones are served, but it's a content path that bypasses retrieval and must be re-verified whenever documents change. | Keep, but re-verify on publish; long term generate from KB. |
| TD-16 | S3 | `src/lib/pipeline/orchestrator.ts` (1,016 lines) | Many special-case branches (toy-standard questions, out-of-domain product regexes, scope answering). Brittle. | Refactor only the parts each roadmap task touches. |
| TD-22 | S2 | `src/lib/pipeline/understand.ts`, `answer.ts` | Groq free tier ≈ 200k tokens/day/model *(prior)*; quota exhaustion silently degrades answers to evidence-only and corrupted an earlier eval. | Provider fallback chain; surface degraded mode in the response metadata. |

### Security and configuration

| ID | Sev | Where | Problem | Fix direction |
|---|---|---|---|---|
| TD-09 | S1 | `src/middleware.ts`, `src/app/api/admin/login/route.ts` | Admin session cookie value is the literal string `authenticated`: anyone can set it in the browser and get `/admin` and `/api/admin/*`. Password falls back to a hardcoded default that the login UI also hints. No roles (uploader vs approving officer), no audit trail. | Signed (HMAC) session token, no default password, `staff`/`officer` roles, audit log (R6). |
| TD-10 | S2 | `src/app/api/helpline/call/route.ts:98-115` | A personal phone number and a caller id are hardcoded as fallbacks; a call can be placed to that number when no number is supplied. | Env-only, fail closed (R6). |
| TD-12 | S3 | root `.env.example`, `prototype/.env.example`, `HANDOFF.md`, `progress.md` blockers | Root `.env.example` describes a non-existent Python V8 stack (port 8000, Bhashini, Tavily). Prototype `.env.example` lacks `ADMIN_PASSWORD`, `EMBED_MODEL`, Exotel/Twilio vars. HANDOFF.md and progress.md "Known blockers" (Gemini embedding quota) are stale. | Rewrite env examples; mark HANDOFF.md historical (R7). |

### Dead code

| ID | Sev | Where | Problem |
|---|---|---|---|
| TD-11 | S3 | `src/lib/pdf-parser.ts`, `src/lib/standard-parser.ts` | Not imported anywhere. Delete in R7 after confirming. |

### Accepted for the prototype (not debt to fix now)
- Conversations stored in browser localStorage only (TD-17). Fine for a prototype; revisit with user accounts.
- Scraped directories are snapshots; refresh is a manual script.

## Resolved
| ID | Date | Fix | Commit |
|---|---|---|---|
| TD-14 | 2026-11-12 | `prototype/requirements.txt` pins PyMuPDF 1.28.2 + rapidocr-onnxruntime 1.2.3; `kb:build` verified to reproduce the KB. Embedding dtype pinned (`EMBED_DTYPE`, fp32) in `src/lib/embeddings.ts`. | b740868 |
| TD-21 | 2026-11-12 | The store reads from PostgreSQL and reloads its snapshot when `index_state.version` changes (checked at most every 5 s), so publishing will not need a restart. The BM25 index rebuilds per snapshot. | uncommitted |
