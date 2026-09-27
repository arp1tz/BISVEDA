# BISVEDA V9 — Phase 1 Acceptance Report: RAG Pipeline & Knowledge Layer

**Date:** 2026-09-27  
**Status:** Completed & Accepted  
**Scope:** Phase 1 — RAG Pipeline + Knowledge Layer (P0)

---

## 1. Executive Summary

Phase 1 eliminates data fabrication, false cross-standard contamination, and hallucinated specifications in BISVEDA. The fragile waterfall search has been replaced with a deterministic multi-store knowledge architecture, Reciprocal Rank Fusion (RRF), a calibrated similarity floor, deterministic standard resolution, and a strict Trust Gate.

All 25 calibrated golden test cases in [data/eval/golden.jsonl](file:///c:/BISVEDA/data/eval/golden.jsonl) pass acceptance checks with zero wrong standards, 100% primary standard accuracy, 100% citation validity, and 100% supported numbers.

---

## 2. Acceptance Metrics vs Requirements

| Metric | Target | Baseline (Pre-Fix) | Phase 1 Result | Status |
|---|---|---|---|---|
| **Total Golden Cases** | 25 | 25 | **25 / 25 Passed** | **PASS** |
| **Wrong-Standard Rate** | **0 violations** | 7 violations | **0 violations** | **PASS** |
| **Kind Accuracy** | **>= 23 / 25 (92%)** | 14 / 25 (56%) | **25 / 25 (100%)** | **PASS** |
| **Primary Standard Accuracy** | **100%** | 8 / 13 (61%) | **13 / 13 (100%)** | **PASS** |
| **Citation Validity** | **100%** | 0% (missing citations) | **46 / 46 (100%)** | **PASS** |
| **Number Support** | **100%** | 24% | **66 / 66 (100%)** | **PASS** |
| **Unit Test Suite** | **17 / 17** | 0 (none existed) | **17 / 17 Passed** | **PASS** |
| **Multi-Turn Isolation** | **Pass (iso-01, follow-01/02)** | Leaked previous standard | **All 3 Passed** | **PASS** |

---

## 3. 25 Golden Test Cases Evaluation Table

Results from `npm run eval:rag` run on `2026-09-27`:

| Test ID | Query Summary | Kind | Primary Standard | Wrong Standards | Citations | Number Support | Result |
|---|---|---|---|---|---|---|---|
| `helmet-01` | Mandatory helmets check | `answer` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `helmet-02` | Two-wheeler helmet standard | `answer` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `helmet-03` | Helmet license query (Hinglish) | `answer` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `helmet-04` | Helmet standard (Hindi) | `answer` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `helmet-05` | Safety helmet for construction | `answer` | `IS 2925` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `toys-01` | Toys for children | `answer` | `IS 9873 (Part 1)` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `toys-02` | Electric toys safety | `answer` | `IS 15644` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `cooker-01` | Domestic pressure cooker | `answer` | `IS 2347` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `water-01` | Packaged drinking water 1L | `answer` | `IS 14543` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `gold-01` | 22 carat gold hallmarking | `answer` | `IS 1417` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `power-01` | Lithium-ion power bank | `answer` | `IS 16046 (Part 2)` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `sariya-01` | Sariya standard (TMT rebar) | `answer` | `IS 1786` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `id-01` | Exact standard code `IS 4151` | `identifier` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `id-02` | Exact standard code `is4151:2015` | `identifier` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `vague-01` | Vague manufacturing inquiry | `clarify` | N/A | 0 violations | N/A | N/A | **PASS** |
| `vague-02` | Which certification do I need | `clarify` | N/A | 0 violations | N/A | N/A | **PASS** |
| `follow-01` | Helmet -> Which labs can test? | `answer` | `IS 4151` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `follow-02` | Helmet -> And for cookers? | `answer` | `IS 2347` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `iso-01` | Helmet -> Reset -> Toys | `answer` | `IS 9873 (Part 1)` | 0 violations | PASS (100%) | PASS (100%) | **PASS** |
| `oos-01` | Frappuccino recipe | `refusal_out_of_scope` | N/A | 0 violations | N/A | N/A | **PASS** |
| `oos-02` | Weather in Delhi | `refusal_out_of_scope` | N/A | 0 violations | N/A | N/A | **PASS** |
| `nis-01` | Quantum teleportation device | `refusal_not_in_sources` | N/A | 0 violations | N/A | N/A | **PASS** |
| `gib-01` | Gibberish string | `gibberish` | N/A | 0 violations | N/A | N/A | **PASS** |
| `inj-01` | Prompt injection attack | `answer` | `IS 4151` | 0 violations (`IS 9999` blocked) | PASS (100%) | PASS (100%) | **PASS** |
| `hi-01` | Hindi greeting (नमस्ते) | `smalltalk` | N/A | 0 violations | N/A | N/A | **PASS** |

---

## 4. Unit Test Suite Results (`tests/pipeline.test.ts`)

Ran via `npx tsx tests/pipeline.test.ts`:
- **Test Suite 1 (Normalize):** 10/10 variants of Indian Standard numbers correctly parsed:
  - `IS 4151` -> `IS 4151`
  - `is4151` -> `IS 4151`
  - `IS 456:2000` -> `IS 456`
  - `is 456 : 2000` -> `IS 456`
  - `IS-456` -> `IS 456`
  - `IS 9873 (Part 1)` -> `IS 9873 (Part 1)`
  - `IS 9873 (Pt 1)` -> `IS 9873 (Part 1)`
  - `IS 9873 Part-1` -> `IS 9873 (Part 1)`
  - `IS 16046 (Part 2):2018` -> `IS 16046 (Part 2)`
  - `IS:4151-1993` -> `IS 4151`
- **Test Suite 2 (RRF):** Reciprocal Rank Fusion calculation verified (`IS 4151` ranked #1 with `k=60`).
- **Test Suite 3 (Adjudication):** Helmet query isolation verified:
  - `IS 4151` included as primary.
  - `IS 1417` (Gold Jewellery), `IS 2925` (Industrial Helmet), and `IS 14767` dropped.
- **Test Suite 4 (Trust Gate):** Dropping unsupported claims verified:
  - Sentences containing ungrounded numbers or percentages (e.g. `80% fee concession`) without source citation are discarded.
- **Test Suite 5 (toSimilarity):** Cosine distance conversion (`1 - distance`) verified.
- **Overall:** 17 / 17 passed.

---

## 5. Seeded Knowledge Layer & Storage Sync

1. **Database Schema & Migrations:**
   - [migrations/001_knowledge_layer.sql](file:///c:/BISVEDA/migrations/001_knowledge_layer.sql) defines relations for standards, QCOs, schemes, labs, facts, chunks, and graph tables (`kg_nodes`, `kg_edges`).
   - [prototype/src/lib/local-db.ts](file:///c:/BISVEDA/prototype/src/lib/local-db.ts) synchronizes writes between [data/bisveda_local_db.json](file:///c:/BISVEDA/data/bisveda_local_db.json) and [prototype/data/bisveda_local_db.json](file:///c:/BISVEDA/prototype/data/bisveda_local_db.json).
2. **Seeded Relational & Graph Records:**
   - **147** Standards registered with Part-specific base number aliases.
   - **101** Quality Control Orders (QCOs) linked to mandatory product groups.
   - **461** Recognized Testing Laboratories with scope and location data.
   - **288** Curated facts with document and source links.
   - **2,870** Knowledge Graph nodes and **2,723** edges built via [scripts/build-graph.ts](file:///c:/BISVEDA/scripts/build-graph.ts).
3. **Calibrated Semantic Floor:**
   - Computed via [scripts/calibrate-floor.ts](file:///c:/BISVEDA/scripts/calibrate-floor.ts) and saved to [data/calibration.json](file:///c:/BISVEDA/data/calibration.json).
   - In-scope similarity threshold: `>= 0.40`. Queries below this threshold yield named boundary refusals (`refusal_not_in_sources`).

---

## 6. Pipeline Architecture Verification

The 12-stage pipeline in [prototype/src/lib/pipeline/](file:///c:/BISVEDA/prototype/src/lib/pipeline/) operates in strict sequence:
1. `normalize.ts`: NFC normalization, language detection, IS code canonicalization.
2. `route.ts`: Rule-based intent routing with Devanagari script support.
3. `context.ts`: Conversation-scoped memory preventing cross-turn leakage.
4. `product.ts`: Synonym matching and product group disambiguation.
5. `retrieve.ts`: Parallel multi-store retrieval (exact match, graph, semantic, lexical).
6. `fuse.ts`: Reciprocal Rank Fusion (`k=60`) with priority boosting for target standards.
7. `floor.ts`: Calibrated semantic threshold check.
8. `adjudicate.ts`: Deterministic classification (`applies`, `may_apply`, `related`, `not_applicable`).
9. `package.ts`: Frozen `EvidencePackage` with verified sources (`S1..Sn`).
10. `generate.ts`: Constrained slot filling (`headline`, `points`, `next_steps`) at `temperature: 0.1` with deterministic fallback.
11. `trust.ts`: Deterministic Trust Gate validating citation existence, dropping unsupported numbers, and eliminating hallucinated standards.
12. `respond.ts`: Single response contract and SSE event streaming.

---

## 7. Acceptance Sign-Off

Phase 1 acceptance checks have **PASSED** in full. The system is ready to proceed to **Phase 2: Knowledge Console (graph + version control + facts)** upon user instruction.
