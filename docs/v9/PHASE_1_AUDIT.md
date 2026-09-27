# Phase 1 Audit: RAG Pipeline & Knowledge Layer

**Date:** 2026-09-27  
**Status:** Audit Complete — Read-Only Inspection  
**Lead:** Antigravity (Pair Programming Agent)  

---

## 1. Database & Data Health

### Environment Status
- **PostgreSQL 16 + pgvector container:** Port 5432 currently offline (`ECONNREFUSED` / Docker daemon not active on Windows host).
- **Zero-Dependency Persistence Engine (`local-db.ts`):** Active and operating against `prototype/data/bisveda_local_db.json`.

### Data Health Metrics
Ran audit script (`prototype/audit_db_health.js`):

| Metric | Measured Value | Notes |
|---|---|---|
| Total Documents | **20** | 9 canonical standards across 20 registered document versions |
| Total Chunks | **2,028** | Real extracted chunks with full text and metadata |
| Chunks with NULL / Empty Embedding | **0** | All 2,028 chunks have generated vector embeddings |
| Orphaned Chunks | **1** | Chunk `bis_doc_8e2b3255d5d5-4.1-0` has `document_id: "IS 9873"` instead of document UUID `bis_doc_8e2b3255d5d5` |
| Chunks without Weighted `tsv` | **2,028** | `tsv` was computed on the fly via `to_tsvector('english', c.text)` in Postgres; not pre-stored |
| Vector Dimensions | **768** (2,028 chunks) | Consistent 768-d vector embeddings throughout |

### Document Breakdown
- `bis_doc_3f36e8f366d9` / `doc-3f36e8f366d92013` | **IS 1417 (1999)** | Gold & Gold Alloys, Jewellery/Artefacts | 40 chunks
- `bis_doc_d851558dd3b4` / `doc-d851558dd3b41399` | **IS 1418 (2009)** | Gold Assay Cupellation Method | 62 chunks
- `bis_doc_7c48611152f5` / `doc-7c48611152f57243` | **IS 2925 (1984)** | Industrial Safety Helmets | 83 chunks
- `bis_doc_f780b5c3af1a` / `doc-f780b5c3af1aa385` | **IS 4151 (1993)** | Protective Helmets for Motorcycle Riders | 96 chunks
- `bis_doc_45249576d022` / `doc-45249576d022907f` | **IS 4151 (1993)** | Specification for protective helmets | 102 chunks
- `bis_doc_8e2b3255d5d5` / `doc-8e2b3255d5d51562` | **IS 9873 (Part 1)** | Safety Requirements for Toys (Mechanical) | 297 chunks
- `bis_doc_da83a7c54753` / `doc-da83a7c5475367d0` | **IS 9873 (Part 3)** | Safety Requirements for Toys (Elements) | 82 chunks
- `bis_doc_1a6a5759d09e` / `doc-1a6a5759d09ea805` | **IS 15644 (2006)** | Safety of Electric Toys | 52 chunks
- `bis_doc_b378175a4719` / `doc-b378175a47192c5b` | **IS 15820 (2009)** | Assaying and Hallmarking Competence | 192 chunks
- `doc-test-muitr2yt` / `doc-test-muitsxpa` | **IS 99999:2026** | Hyperflux Test Fixtures | 14 chunks

---

## 2. Answers to the 11 Audit Questions

### Q1: Embedding model and task type at ingest and query time
- **File & Line:** `prototype/src/lib/embeddings.ts:18-70`, `prototype/src/lib/ingestion/pipeline.ts:168`, `prototype/src/lib/retrieval.ts:578`.
- **Model & Dimension:** Google `models/gemini-embedding-001` with 768 dimensions.
- **Task Type:** Neither ingest nor query specifies a `taskType`. In `embeddings.ts:25` and `embeddings.ts:50`, calls pass `{ parts: [{ text }] }` without `taskType: "RETRIEVAL_DOCUMENT"` at ingest or `taskType: "RETRIEVAL_QUERY"` at query time.
- **Action Required:** Update `embeddings.ts` to explicitly configure `RETRIEVAL_DOCUMENT` during ingestion and `RETRIEVAL_QUERY` at query time.

### Q2: Similarity/distance score computation and thresholds
- **File & Line:** 
  - `prototype/src/lib/db.ts:326`: Computes `1 - (c.embedding <=> $1::vector) AS similarity` (cosine similarity = 1 - cosine distance). Minimum threshold is passed as `$2` (`minSimilarity = 0.45`).
  - `prototype/src/lib/local-db.ts:51-63`: Computes dot product normalized by vector magnitudes (standard cosine similarity).
  - `prototype/src/lib/retrieval.ts:641`: `trueSimilarity >= 0.70 ? "DIRECTLY_APPLICABLE" : "POTENTIALLY_APPLICABLE"`.
  - `prototype/src/lib/adjudicator.ts:36`: `CALIBRATED_RELEVANCE_FLOOR = 0.45`.
  - `prototype/src/lib/adjudicator.ts:229-242`: Threshold tiers: `>= 0.70` (directly applicable), `>= 0.50` (potentially applicable), `>= 0.45` (related standard), `>= 0.30` (scope unclear), `< 0.30` (not applicable).
  - `prototype/src/lib/llm-provider.ts:193`: Hard threshold `top1Relevance < 0.45` triggers out-of-corpus refusal.
- **Action Required:** Replace hardcoded magic numbers with a single calibrated threshold loaded from `data/calibration.json` via `scripts/calibrate-floor.ts`, and unify all comparisons under `toSimilarity()`.

### Q3: Lexical search construction and query handling
- **File & Line:** `prototype/src/lib/db.ts:408`, `prototype/src/lib/local-db.ts:145-163`.
- **Query Type:** Uses `plainto_tsquery('english', $1)` against an unindexed, unweighted `to_tsvector('english', c.text)` on the fly in Postgres.
- **User Text:** User text is passed directly into `plainto_tsquery`. `websearch_to_tsquery` is NOT used.
- **Action Required:** Create weighted tsvector `chunks.tsv` (A: IS number + title, B: clause heading/breadcrumb, C: text) indexed via GIN, and query using `websearch_to_tsquery('english', $1)`.

### Q4: Merging of vector, FTS, KB, and standards
- **File & Line:** `prototype/src/lib/retrieval.ts:489-565` (`hybridSearch`) and `retrieval.ts:590-705` (`retrieveEvidence`).
- **Merge Strategy:** No Reciprocal Rank Fusion (RRF). In `hybridSearch`, it executes a sequential waterfall: exact -> phrase -> FTS -> vector, returning the first non-empty list. In `retrieveEvidence`, it takes `standards.json` recommendations and conditionally prepends or overwrites based on whether `trueSimilarity >= topSeedScore`.
- **Action Required:** Implement true Reciprocal Rank Fusion (`rrf.ts`, k=60) combining exact, taxonomy/graph, semantic standards, semantic chunks, and lexical chunks into ranked lists of standards and chunks.

### Q5: Context Resolver active entities and state isolation
- **File & Line:** `prototype/src/lib/context-resolver.ts:12-42`, `prototype/src/app/api/v8/query/route.ts:52`, `prototype/src/components/chat/PerplexityWorkspaceExperience.tsx:64-92`.
- **Scope:** Context is parsed from `body.history: ChatTurn[]`. However:
  1. `localStorage` saved dossiers and recent searches leak into UI state across sessions.
  2. `context-resolver.ts` lacks topic-shift detection. When a user asks about pressure cookers after helmets, `activeStandard` is retained and injected into `retrieveEvidence(resolvedCtx.activeStandard)` (`llm-provider.ts:128`).
- **Action Required:** Scope context strictly to `conversation_id`. Add explicit topic shift detection in `context.ts` that clears `active_standards` when a new product is queried.

### Q6: Decision logic for `directly_applicable` and default classification
- **File & Line:** `prototype/src/lib/adjudicator.ts:215-244`, `prototype/src/lib/applicability.ts:115-158`.
- **Default:** In `adjudicator.ts:215`, default is `related_standard` (NOT `not_applicable`). In `applicability.ts:153`, default is `RELATED`.
- **Decision Logic:** Matches if `hasIdentifierInQuery` is true OR `coverage.product === "covered" && aggregatedScore >= 0.70`. Because `hasProductTerm` in line 166-170 matches on individual common words from the title, secondary standards (like IS 2925 for industrial helmets) trigger `hasProductTerm = true` and become `directly_applicable`.
- **Action Required:** Set default to `not_applicable`. Standard must earn `applies` through exact IS match or product node `COVERS` path with product term present.

### Q7: Code that generates "Why this applies" text
- **File & Line:** `prototype/src/lib/adjudicator.ts:216-244`, `prototype/src/lib/applicability.ts:129`, `prototype/src/lib/retrieval.ts:642`.
- **Content:** Generic template strings, e.g.:
  - `"Direct statutory standard legally governing this exact product specification, safety criteria, and mandatory BIS mark."`
  - `"Direct product and scope coverage: Governs primary manufacturing and safety requirements for ${std.full_title}."`
  - `"Statutory requirements extracted directly from verified ingested document (Doc ID: ...)"`
- **Action Required:** Deterministically construct "Why this applies" from the exact rule and matched terms: `"Covers <product group> — matched “<term>” in the title."`

### Q8: Query-time reads of JSON seed files
- **Files & Reads:**
  - `data/standards.json` read at query time in: `retrieval.ts:1`, `standards-helper.ts:1`, `speed-gate.ts:1`, `taxonomy.ts:14`, `llm-provider.ts:2`, `vision-inspector.ts:24`.
  - `data/laboratories.json` read at query time in: `retrieval.ts:2`, `standards-helper.ts:2`, `vision-inspector.ts:26`.
  - `data/laboratories_ba.json` read at query time in: `retrieval.ts:3`, `vision-inspector.ts:27`.
  - `data/qcos.json` read at query time in: `retrieval.ts:4`, `standards-helper.ts:3`, `vision-inspector.ts:25`.
  - `data/pin_centroids.json` read at query time in: `retrieval.ts:5`, `standards-helper.ts:4`, `vision-inspector.ts:28`.
  - `data/schemes.json` read at query time in: `speed-gate.ts:2`.
  - `data/knowledge_base.json` read at query time in: `orchestrator.ts:13`, `form-generator.ts:8`.
  - `data/taxonomy/groups.json` read at query time in: `taxonomy.ts:13`.
- **Action Required:** Eliminate all query-time JSON imports. Seed them into the Facts DB and query solely from the database.

### Q9: Citation viewer PDF lookup and `document_id`
- **File & Line:** `prototype/src/app/api/v8/documents/[id]/pdf/route.ts:11-110`, `prototype/src/components/features/PdfSourceViewerModal.tsx:55`, `prototype/src/lib/retrieval.ts:631`.
- **Data Flow:** The viewer fetches `/api/v8/documents/${docIdentifier}/pdf`. In some evidence items, `c.clause_number` (e.g. `"4.11.1"`) was stored into `document_id`.
- **Failure:** Requesting `/api/v8/documents/4.11.1/pdf` returns HTTP 404 with JSON:
  `{"error":"Document not held in local repository","message":"...","document_id":"4.11.1","held":false}`.
  The UI attempts to display this raw response in the iframe/viewer.
- **Action Required:** Separate `doc_version_id`, `clause_id`, and `page` in the chunk schema. Implement `GET /api/sources/:docVersionId/file` streaming PDF from storage, with user-friendly "File not held" UI fallback instead of raw JSON.

### Q10: LLM Prompt, schema, and temperature
- **File & Line:** `prototype/src/lib/llm-provider.ts:360-520`.
- **Input:** System prompt + prompt context containing query, primary standard, QCO, testing clauses (S1..Sn), certification scheme, and top 3 labs.
- **Output:** Requests JSON adhering to `SlotSchema` (`summary`, `why_explanations`, `step_explanations`, `next_action_guidance`). `formatSlotsToProse` then stitches fields into markdown sections.
- **Temperature:** `0.1` across Gemini, Groq, and OpenAI calls.
- **Action Required:** Restrict LLM role strictly to prose filling (`headline`, `points`, `next_steps`) over a frozen `EvidencePackage`. The LLM receives only verified sources and cannot alter standard classifications or QCO status.

### Q11: Source of the "30-day" and "80%" MSME text
- **File & Line:**
  - `prototype/src/lib/llm-provider.ts:370`: Injected directly into the prompt: `CERTIFICATION SCHEME: ${primary.scheme} (30-day simplified MSME fast-track available with 80% fee concession)`.
  - `prototype/src/lib/llm-provider.ts:627-628`: Fallback synthesis string templates.
  - `prototype/src/lib/speed-gate.ts:59, 75, 99`: Hardcoded in FAQ text.
  - `prototype/src/lib/orchestrator.ts:50, 254-262`: Hardcoded in agent prompt descriptions.
  - `prototype/src/lib/form-generator.ts:76`: Hardcoded `Math.round(baseFee * 0.2)`.
  - `prototype/src/lib/dossier-builder.ts:85, 96, 147`: Hardcoded string constants.
- **Action Required:** Remove all unverified hardcoded MSME numbers. MSME concessions and timelines may only appear if backed by a verified row in `facts` with a valid `source_url`.

---

## 3. Root Cause Analysis for Observed Bugs (B1–B8)

| Bug | Symptom | Exact Root Cause & File Reference |
|---|---|---|
| **B1** | Helmet question lists IS 1417 (jewellery) & IS 2925 (industrial helmets) as `DIRECTLY_APPLICABLE` | In `context-resolver.ts:80-140`, previous turn's `activeStandard` is retained without topic-shift reset. In `adjudicator.ts:166-231`, `hasProductTerm` matches single words from title ("helmets"), and `applicability` defaults to `related_standard` rather than `not_applicable`. |
| **B2** | Toys question lists IS 14767 (infant formula) in applicable standards | `adjudicator.ts:241-244` classifies ungrounded standards as `not_applicable`, but `retrieval.ts:682-697` and `orchestrator.ts` still push them into the candidate list returned to the frontend. |
| **B3** | "Applicable Indian Standards for manufacturing" -> out-of-corpus refusal with internal refs | Missing `needs_clarification` route when no product is named. Out-of-corpus handler (`llm-provider.ts:195-223`) outputs refusal with internal refs (`§11.4 Axiom A1`) while UI attaches a verified badge. |
| **B4** | Citation markers render as empty black circles | UI citation marker component in `PerplexityCitationTag.tsx` fails to render label because regex stripper removes `[S#]` content or receives null label. |
| **B5** | Opening citation shows raw JSON `{"error":"Document not held...", "document_id":"4.11.1"}` | `retrieval.ts:631` puts clause number (`"4.11.1"`) into `document_id`. `/api/v8/documents/4.11.1/pdf` returns 404 JSON, which `PdfSourceViewerModal.tsx:55` loads directly into an iframe. |
| **B6** | Prose claims like "30-day simplified MSME" and "80% fee concession" without source | Injected as hardcoded text in `llm-provider.ts:370`, `speed-gate.ts:59`, `orchestrator.ts:254`, and `form-generator.ts:76` without being tied to an evidence chunk or facts row. |
| **B7** | Testing clauses and labs mix content from unrelated standards | `retrieval.ts:678` does `finalEvidence = [...testingClauses, ...seedResult.activeEvidence]`, aggregating clauses and labs across all candidate standards instead of strictly isolating to the primary standard. |
| **B8** | Mixed score scales / wrong refusals | FTS raw rank, pgvector cosine distance (`<=>`), and heuristic seed points are compared directly in `retrieval.ts:690` without rank normalization or RRF. Raw user text passed to `plainto_tsquery`. |

---

## 4. Exact Files to be Changed in Phase 1

### New Files to Create:
1. `data/eval/golden.jsonl` — 25 golden test cases for eval runner.
2. `scripts/eval-rag.ts` — in-process evaluation runner (`npm run eval:rag`).
3. `scripts/calibrate-floor.ts` — calibration script to compute semantic floor from golden set into `data/calibration.json`.
4. `scripts/seed-facts.ts` — idempotent database seeding into Facts DB (`standards`, `qcos`, `schemes`, `labs`, `facts`).
5. `scripts/build-graph.ts` — knowledge graph builder for `kg_nodes` and `kg_edges`.
6. `lib/knowledge/graph-repository.ts` — graph navigation queries (`neighbors`, `standardsForProduct`, `qcosForStandard`, `labsForStandard`).
7. `lib/pipeline/normalize.ts` — Stage 1: NFC, lang detection, IS number canonicalizer with 10 unit test cases.
8. `lib/pipeline/route.ts` — Stage 2: speed gate, smalltalk, gibberish, out_of_scope, needs_clarification.
9. `lib/pipeline/context.ts` — Stage 3: conversation-scoped context with topic-shift detection.
10. `lib/pipeline/product.ts` — Stage 4: taxonomy synonyms and product disambiguation.
11. `lib/pipeline/retrieve.ts` — Stage 5: parallel multi-store retrieval.
12. `lib/pipeline/fuse.ts` — Stage 6: Reciprocal Rank Fusion (RRF, k=60).
13. `lib/pipeline/floor.ts` — Stage 7: calibrated floor check using `data/calibration.json`.
14. `lib/pipeline/adjudicate.ts` — Stage 8: deterministic rule-based adjudication (default `not_applicable`).
15. `lib/pipeline/package.ts` — Stage 9: frozen evidence package builder with `S1..Sn` labels.
16. `lib/pipeline/generate.ts` — Stage 10: constrained LLM slot generator (headline, points, next_steps).
17. `lib/pipeline/trust.ts` — Stage 11: trust gate (number support, citation validation, hallucination drop).
18. `lib/pipeline/respond.ts` — Stage 12: unified `BisvedaResponse` contract and stage event emitter.
19. `prototype/src/app/api/sources/[docVersionId]/file/route.ts` — clean PDF streaming endpoint.

### Existing Files to Modify / Refactor:
1. `prototype/src/lib/embeddings.ts` — configure `RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`.
2. `prototype/src/lib/db.ts` / `prototype/src/lib/local-db.ts` — add tables/collections for `standards`, `qcos`, `schemes`, `labs`, `facts`, `kg_nodes`, `kg_edges`, `document_versions`.
3. `prototype/src/app/api/v8/query/route.ts` — rewire to invoke the clean `lib/pipeline` stages and stream real stage events.
4. `prototype/package.json` — add `eval:rag` script.

---

## 5. Audit Conclusion & Gate

The audit confirms all 8 reported bugs stem from architectural issues:
1. Lack of deterministic rank fusion.
2. In-memory leaking of previous context across turns.
3. Permissive default classification in adjudicator.
4. Hardcoded marketing text ("30-day", "80%") in prompts.
5. Direct query-time reads of raw JSON files rather than a unified Facts DB.

**Next Step:** Awaiting human approval before creating `docs/v9/PHASE_1_PLAN.md` and implementing code.
