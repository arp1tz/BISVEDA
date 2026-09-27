# Phase 1 Implementation Plan: RAG Pipeline & Knowledge Layer

**Status:** Approved to Proceed  
**Objective:** Replace fragile waterfall search and hallucinated prose with a deterministic, multi-store knowledge layer, Reciprocal Rank Fusion (RRF), calibrated semantic floor, deterministic adjudication, and a verifiable Trust Gate.

---

## Numbered Checklist

### Step 1: Golden Test Set & Eval Runner
- [ ] **1.1** Create `data/eval/golden.jsonl` with 25 calibrated test cases covering helmet, toys, cooker, water, gold, power bank, sariya, identifier queries, clarification traps, follow-ups, conversation isolation, out-of-scope, not-in-corpus, gibberish, prompt injection, and Hindi smalltalk.
- [ ] **1.2** Create `scripts/eval-rag.ts` executing the pipeline in-process, checking `kind`, `primary`, `must_include`, `must_not_include`, `qco`, citation validity, and number support. Add `"eval:rag": "tsx scripts/eval-rag.ts"` to `prototype/package.json`.
- [ ] **1.3** Run `npm run eval:rag` to establish the baseline score and save output in `data/eval/results/baseline.json`.

### Step 2: Knowledge Layer (Four Stores, One Schema)
- [ ] **2.1** Schema & Migrations:
  - Create database migration `migrations/001_knowledge_layer.sql` defining:
    - `standards`, `qcos`, `qco_standards`, `schemes`, `standard_schemes`, `labs`, `lab_scopes`, `faq_entries`, `facts`
    - `document_versions` and update `chunks` (`doc_version_id`, `clause_id`, `page`, `tsv`)
    - `kg_nodes` and `kg_edges` with indices
    - Weighted tsvector triggers and HNSW / cosine vector indices
  - Ensure compatibility with both PostgreSQL/pgvector and the local fallback store (`local-db.ts`).
- [ ] **2.2** Seeding Facts & Relationships:
  - Create `scripts/seed-facts.ts` (idempotent) loading `standards.json`, `qcos.json`, `schemes.json`, `laboratories.json`, `groups.json`. Set `status='approved'`, `created_by='seed'`.
  - Create `scripts/build-graph.ts` (idempotent) creating graph nodes (`std:*`, `qco:*`, `scheme:*`, `lab:*`, `pg:*`, `prod:*`, `doc:*`, `ver:*`, `chunk:*`) and approved edges (`MANDATES`, `CERTIFIED_UNDER`, `ACCREDITED_FOR`, `COVERS`, `IS_A`, `MAINTAINS`, `SUPERSEDES`, `HAS_VERSION`, `DOCUMENTS`, `HAS_CHUNK`, `HAS_CLAUSE`).
- [ ] **2.3** Graph Repository Module:
  - Create `lib/knowledge/graph-repository.ts` providing typed queries: `neighbors()`, `standardsForProduct()`, `qcosForStandard()`, `schemesForStandard()`, `labsForStandard()`.
- [ ] **2.4** Semantic Floor Calibration:
  - Create `scripts/calibrate-floor.ts` computing distribution separation between in-scope golden cases and out-of-corpus queries, generating `data/calibration.json`.

### Step 3: Modular Pipeline Stages (`lib/pipeline/`)
- [ ] **3.1** Stage 1 — `normalize.ts`: NFC normalization, language detection, IS number canonicalizer with 10 unit tests.
- [ ] **3.2** Stage 2 — `route.ts`: Rule-based router (`identifier`, `smalltalk`, `gibberish`, `out_of_scope`, `needs_clarification`, `question`).
- [ ] **3.3** Stage 3 — `context.ts`: Conversation-scoped context (keyed strictly by `conversation_id`), explicit topic-shift detection to prevent standard leaks.
- [ ] **3.4** Stage 4 — `product.ts`: Taxonomy synonyms and disambiguation for broad product groups.
- [ ] **3.5** Stage 5 — `retrieve.ts`: Parallel multi-store retrieval (exact, taxonomy/graph, semantic standards, semantic chunks, lexical chunks).
- [ ] **3.6** Stage 6 — `fuse.ts`: Reciprocal Rank Fusion (`rrf`, k=60) producing fused standards and chunks.
- [ ] **3.7** Stage 7 — `floor.ts`: Similarity floor evaluation using calibrated threshold from `data/calibration.json`.
- [ ] **3.8** Stage 8 — `adjudicate.ts`: Deterministic classification (`applies`, `may_apply`, `related`, `not_applicable` as default), primary standard selection, QCO/scheme/lab attachment for primary standard only.
- [ ] **3.9** Stage 9 — `package.ts`: Build frozen `EvidencePackage` with stable `S1..Sn` labels, verified `doc_version_id`, `clause_id`, and `page`.
- [ ] **3.10** Stage 10 — `generate.ts`: Constrained LLM slot filler (`headline`, `points`, `next_steps`) at temperature 0.1, with fallback to evidence-only template.
- [ ] **3.11** Stage 11 — `trust.ts`: Deterministic Trust Gate validating citation existence, dropping sentences with unsupported numbers, and dropping hallucinated standards.
- [ ] **3.12** Stage 12 — `respond.ts`: Single `BisvedaResponse` contract and real stage event emitter.

### Step 4: Wire Pipeline & Fix Data Paths
- [ ] **4.1** Connect `prototype/src/app/api/v8/query/route.ts` to `lib/pipeline/` orchestrator, streaming real stage events (`understand`, `search`, `check`, `write`).
- [ ] **4.2** Create `GET /api/sources/[docVersionId]/file` route in `prototype/src/app/api/sources/[docVersionId]/file/route.ts` to stream PDF cleanly from storage with proper JSON error handling.
- [ ] **4.3** Update `prototype/src/lib/ingestion/pipeline.ts` to write `document_versions` with `status='draft'`, `doc_version_id` on chunks, and create `proposed` `REFERENCES` edges.

### Step 5: Unit Tests, Acceptance Testing & Verification
- [ ] **5.1** Add unit tests for `normalize`, `rrf`, `adjudicate`, `trustGate`, and `toSimilarity`.
- [ ] **5.2** Run `npm run eval:rag` and verify all acceptance metrics:
  - Wrong-standard rate = 0
  - Kind accuracy >= 23 / 25
  - Primary standard accuracy = 100%
  - Citation validity = 100%
  - Number support = 100%
  - Conversation isolation tests pass
  - `ALLOW_DEMO_DATA=false` check
  - `GENERATION=none` evidence-only check
- [ ] **5.3** Write `docs/v9/PHASE_1_REPORT.md` documenting test results and baseline comparisons.
