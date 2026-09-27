# BISVEDA Architecture & Context State (CONTEXT.md)

> **Living System Context Document**  
> **Target Spec:** BISVEDA V8 Canonical Specification (§6.4, §9.1, §9.8, §11.4)  
> **Style:** Caveman Lite (terse, factual, unambiguous)

---

## 1. System Overview

BISVEDA is an authoritative conversational compliance assistant for the Bureau of Indian Standards (BIS). It answers strictly from verified Indian Standards, gazette Quality Control Orders (QCOs), lab registries, and ingested PDF document chunks.

### Core Invariants
- **Axiom A1 / §11.4 (Truth Boundary):** Never invent standards or statutory claims. Out-of-corpus queries must trigger a named boundary refusal.
- **Axiom A13 / §9.8 (Adjudication Precedes Generation):** Adjudicate applicability, knowledge tier, and citable evidence before synthesis.
- **Axiom A16 (Observability Integrity):** Emitted stage events must reflect actual execution path. Never emit fake retrieve/adjudicate stages on fast-path hits.

---

## 2. Pipeline Routing Architecture

```
User Query
    ↓
Intent Gate (Conversational vs Regulatory) (§9.1)
    ├─ Greeting / Thanks / Help / Gibberish → Direct Static Response (NO retrieval)
    └─ Regulatory / Product / Standard Query
            ↓
       Speed Gate (§6.4)
            ├─ Exact Identifier ("IS 4151", "CM/L-1234567", "AB1234") → Fast-Path Response (<150ms)
            ├─ Verbatim Official FAQ ("What is BIS?", "What is HUID?") → Cached FAQ (<200ms)
            ├─ Exact Query Cache Hit → Memory Cache (<50ms)
            └─ MISS (Normal query / complex / "tell me about X")
                    ↓
               Language Gateway (§6.5)
                    ↓ (canonical English query + locked tokens)
               Ambiguity / Disambiguation Gate (§9.2)
                    ├─ Ambiguous Product Scope ("water bottle") → Clarification Chips
                    └─ Unambiguous Scope
                            ↓
                       Hybrid Retrieval Engine (Semantic + Lexical + Taxonomy)
                            ↓
                       9-Step Deterministic Adjudicator (§9.8)
                            ├─ Relevance Floor Check (<0.45 or no coverage) → Named Boundary Refusal
                            └─ Relevance Floor Passed
                                    ↓
                               Generate (LLM or Evidence-Only Mode §10.3)
                                    ↓
                               Trust Gate & Guardrails (§11) → Verified Response
```

---

## 3. Decision Boundary: Speed Gate vs Full Pipeline

| Query Type | Example | Routed Path | Max Latency | Retrieval Executed? |
|---|---|---|---|---|
| Pure Greeting | `"Hello"`, `"Namaste"` | Conversational Intent Gate | <50ms | No |
| Gratitude / Farewell | `"Thank you"`, `"Dhanyawad"` | Conversational Intent Gate | <50ms | No |
| System Identity / Help | `"Help"`, `"What can you do?"` | Conversational Intent Gate | <50ms | No |
| Gibberish / Noise | `"asdfghjk"`, `"123456!@#"` | Conversational Intent Gate | <50ms | No |
| Exact IS Code | `"IS 4151"`, `"IS:2347"` | Speed Gate (Exact Identifier) | <150ms | No |
| Exact CM/L Licence | `"CM/L-8493021"` | Speed Gate (Exact Identifier) | <150ms | No |
| Exact HUID Code | `"HUID 7A8B9C"` | Speed Gate (Exact Identifier) | <150ms | No |
| Verbatim General FAQ | `"What is BIS?"`, `"What is ISI mark?"` | Speed Gate (Official FAQ) | <200ms | No |
| Conversational Standard Inquiry | `"Tell me about IS 4151"`, `"Requirements of IS 4151"` | Full RAG Pipeline | <2500ms | Yes (Hybrid) |
| Product Query | `"standards for steel water bottles"` | Full RAG Pipeline | <2500ms | Yes (Hybrid) |
| Conversational Product Query | `"Tell me about helmet standards"` | Full RAG Pipeline | <2500ms | Yes (Hybrid) |
| Broad Product Scope | `"water bottle"`, `"cooker"`, `"wire"` | Disambiguation Gate | <100ms | No (Awaiting Scope) |
| Out of Corpus Product | `"LED aquarium strips"` | Full RAG Pipeline → Refusal | <500ms | Yes (Floor < 0.45) |
| Media Attached | Uploaded helmet image + text | Full RAG Pipeline (Bypass Speed Gate) | <3000ms | Yes (Vision + RAG) |

---

## 4. Knowledge Layer Components

1. **Semantic Search (`searchVectorChunks` in `db.ts` / `local-db.ts`):**
   - pgvector `vector(768)` embedding distance using cosine metric.
   - Fallback: Local cosine similarity on stored embeddings in `bisveda_local_db.json`.
   - Strictly enforces calibrated relevance floor (>= 0.45).

2. **Lexical Search (`searchFtsChunks` / `searchPhraseChunks`):**
   - PostgreSQL `tsvector` with GIN index over chunk text and clause titles.
   - Fallback: Token-ratio BM25 style lexical scorer in `local-db.ts`.
   - Phrase matching for multi-word technical specifications and exact standard identifiers.

3. **Relationship & Graph Layer (`taxonomy.ts`, `groups.json`, `standards.json`):**
   - Division → Committee → Product Group → Type → Variant taxonomy.
   - Colloquial synonym resolver (*sariya* → TMT rebars, *chuna* → Quicklime).
   - Supersession tracking (`supersedes`, `superseded_by`) to detect outdated standards.

4. **Facts DB / Structured Registry (`laboratories.json`, `qcos.json`, `schemes.json`):**
   - 430+ testing laboratories with geo-coordinates, testing scope, and Haversine distance ranking.
   - Gazette QCO database with mandatory/voluntary dates, issuing ministry, and Section 29 penal provisions.
   - Deterministic metadata lookups executed without LLM hallucination risk.

---

## 5. UI State Management

- **Streaming:** Server-Sent Events (SSE) via `/api/v8/query`. Emits lifecycle events (`stage.started`, `stage.completed`, `turn.completed`).
- **Research Workspace (`/research/[id]`):** Consumes SSE stream, displays live stage indicators, renders compliance dossier, and maps evidence chunks to source citations.
- **Evidence Ledger:** Links `[S#]` citations to verbatim standard clauses, source URLs, and knowledge tier badges (A: Catalogue, B: Product Manual, C: Full Text).
- **Standards Passport (`/standards/[id]`):** Presents complete standard specifications, testing parameters, and Form-I application draft generators.

---

## 6. Key Source Files & Roles

| Path | Primary Responsibility |
|---|---|
| `prototype/src/lib/speed-gate.ts` | Ultra-fast (<150ms) exact identifier and verbatim FAQ matching. |
| `prototype/src/lib/conversational-router.ts` | Intent classification: greeting, thanks, help, gibberish, vague scope. |
| `prototype/src/lib/llm-provider.ts` | Pipeline orchestrator: executes L0 → L1 → L4 → L5 → L6 flow. |
| `prototype/src/lib/retrieval.ts` | Hybrid search engine: combines exact ID, taxonomy, lexical FTS, and pgvector. |
| `prototype/src/lib/adjudicator.ts` | Deterministic 9-step evidence adjudicator, coverage analysis, and grounding state. |
| `prototype/src/lib/guardrails.ts` | Trust Gate: citation marker normalization, candidate verification, refusal generator. |
| `prototype/src/lib/evidence-only.ts` | Zero-hallucination deterministic synthesis fallback when LLM is unavailable. |
| `prototype/src/lib/db.ts` | PostgreSQL + pgvector connection pool and query interface. |
| `prototype/src/lib/local-db.ts` | Sovereign JSON-backed local persistence engine for offline operation. |
| `prototype/src/app/api/v8/query/route.ts` | Next.js API route handling JSON and SSE streaming queries. |

---

## 7. Change Log Template

```markdown
### [YYYY-MM-DD] Phase X.Y - Component Name
- **Change:** Concise description of modification.
- **Rationale:** Why change was needed (spec reference).
- **Verification:** Test query and observed outcome.
```
