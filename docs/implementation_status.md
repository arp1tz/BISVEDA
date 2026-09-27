# BISVEDA — Implementation Status

> **Updated:** 2026-09-26
> **Architecture Version:** V8.0
> **Overall Progress:** ~45% complete (~120/293 items)

---

## 1. Layer Progress Overview

| Layer | Total | ✅ Done | 🔧 Partial | ❌ Not Started | Completion |
|---|---|---|---|---|---|
| L0 — Governance & Acquisition | 30 | 8 | 2 | 20 | 27% |
| L1 — Gateway, Multimodal, Language | 30 | 7 | 2 | 21 | 23% |
| L2 — Ingestion & Visual Intelligence | 22 | 9 | 1 | 12 | 41% |
| L3 — Knowledge Fabric & Storage | 17 | 6 | 1 | 10 | 35% |
| L4 — Query Intelligence & Adjudication | 28 | 9 | 2 | 17 | 32% |
| L5 — Orchestrator & Agents | 25 | 16 | 2 | 7 | 64% |
| L6 — Trust Gate & Guardrails | 18 | 7 | 1 | 10 | 39% |
| L7 — Operations Platform | 15 | 2 | 0 | 13 | 13% |
| XL — Experience Layer (UI) | 68 | 50 | 3 | 15 | 74% |
| Cross-Cutting | 40 | 8 | 3 | 29 | 20% |
| **Total** | **~293** | **~122** | **~17** | **~154** | **~45%** |

---

## 2. What's Working (Production-Ready)

### Core Pipeline ✅
- **Speed Gate:** Exact-ID lookup, verbatim FAQ matching, query cache (< 200ms)
- **Language Gateway:** fastText LID, Hinglish normalization, Terminology Lock
- **Context Resolver:** Active entities, anaphora resolution, multi-turn context
- **Hybrid Retrieval:** pgvector dense + FTS lexical + exact-first pinning (5-signal fabric)
- **Sovereign Local Persistence:** Zero-dependency cosine vector similarity & FTS engine (`local-db.ts`)
- **Evidence Adjudicator:** Full 9-step deterministic pipeline
- **7 Specialist Agents:** AG1-AG7 with structured outputs
- **Compliance Dossier Builder:** All 10 sections populated
- **Trust Gate:** Citation marker resolution, candidate-set check, tier policy enforcement
- **NotebookLM Citations & Provenance Engine:** Clickable statutory standards and `[S#]` pills opening authentic PDF pages directly without external redirection
- **Multi-Document Ingestion Engine:** Drag-and-drop batch queue with concurrent worker execution and individual progress bars
- **Automatic Document Classifier:** Heuristic detection of `Gazette QCO`, `IS Standard PDF`, and `Lab Circular` based on regulatory markers
- **PDF Streaming & Fallback Gateway:** `/api/v8/documents/[id]/pdf` serving inline PDF streams with authentic BIS statutory dossier synthesis
- **Evidence-Only Mode:** Zero-LLM deterministic fallback
- **Safe Refusal:** Named-boundary corpus refusal with helpline + portal

### UI ✅
- **Home Page:** Centered hero, evidence strip, service cards, workflow band
- **Research Workspace:** 3-panel layout with streaming dossier, evidence ledger
- **NotebookLM Authentic PDF Source Viewer:** Split modal (`PdfSourceViewerModal.tsx`) with verbatim quotes, page navigation (`#page=X`), and "Open in New Tab"
- **Staged Chunks & Statutory Facts Knowledge Editor:** Modal editor (`StagedChunkEditorModal.tsx`) in Officer Console allowing clause search, text/number editing, active toggle, and chunk deletion
- **Batch Ingestion Console UI:** File queue with auto-detected category badges and quick-override dropdowns (`EmployeePipeline.tsx`)
- **Standard Passport:** Fact grid, tier badge, explain simply modal
- **Lab Locator:** Interactive Leaflet map with Haversine distance, geolocation
- **Certification Hub:** Wizard, MSME fee calculator
- **Consumer Services:** CM/L, CRS, HUID shape validators, vision inspector
- **Standards Knowledge Base:** Search with filters
- **Comparison Matrix:** 4-way comparison
- **Admin Console:** Document ingestion with SHA-256 dedup, MinIO, pgvector, and PostgreSQL/local sync

### Data ✅
- 101+ standards seeded (Tier A catalogue)
- 9 authentic full-text standards ingested (301 pages, 1,007 chunks, 768-dim embeddings across Toys, Helmets, Gold, Wood preservatives)
- 430+ labs with scope/location
- QCO registry with mandatory/voluntary status
- 5 certification schemes
- Product taxonomy with synonym dictionary
- PIN-code geocoding data

---

## 3. What's Partial (Functional but Incomplete)

| Feature | Status | What's Missing |
|---|---|---|
| Knowledge Tiers | Tier A seeded, Tier B partial | Tier C requires BIS MOU; tier propagation incomplete |
| Session Manager | In-memory + localStorage | Redis hot state; PostgreSQL persistence; surface isolation |
| Multi-Task Planner | Basic multi-agent dispatch | Full DAG with parallel/sequential; 30s budget |
| Stage-Event Contract | Basic events emitted | Not full §10.1.2 spec; missing duration/counts |
| Generation Contract | LLM generation works | Missing slot schema enforcement; structured-output mode |
| Form I Preparation | Basic draft generation | Dedicated route, per-field provenance, WeasyPrint PDF |
| Multimodal | Text + image converge | Mixed-modality conflict; evidence-class tagging |
| Feedback | Basic thumbs up/down | Typed reasons; pipeline; admin gate |

---

## 4. What's Not Started (Phase 1+ / Production)

### High Priority (needed for pilot)
- [ ] NLI contradiction check (`nli-deberta-v3-base`)
- [ ] PII detection (Presidio + Indian patterns)
- [ ] Prompt injection detection
- [ ] Cross-encoder reranking (`bge-reranker-v2-m3`)
- [ ] RRF fusion across retrieval signals
- [ ] Rate limiting (Redis token-bucket)
- [ ] Request sanitization (NFC, null bytes, MIME)

### Medium Priority (needed for production)
- [ ] Voice lifecycle (ASR/TTS via Bhashini/IndicConformer)
- [ ] Model Registry with roles
- [ ] Provider Chain (local → hosted → paid → evidence-only)
- [ ] LiteLLM proxy routing
- [ ] Keycloak OIDC + RBAC
- [ ] OpenTelemetry tracing
- [ ] Prometheus/Grafana metrics
- [ ] Circuit breakers for all dependencies
- [ ] Amendment Overlay Engine
- [ ] Knowledge Refresh pipeline
- [ ] Updates Feed route
- [ ] Graph retrieval (Apache AGE / CTEs)
- [ ] Evaluation harness with gated metrics

### Lower Priority (production / scale)
- [ ] OpenSearch BM25 (if PG FTS fails)
- [ ] Kubernetes + Helm + ArgoCD
- [ ] Air-gapped deployment
- [ ] Stage-3 distilled classifier
- [ ] WCAG 2.1 AA full compliance
- [ ] Internationalization (full UI strings EN + HI)
- [ ] WhatsApp channel
- [ ] Partner API

---

## 5. Prototype Files Map

### Core Library (`prototype/src/lib/`)

| File | Component | Status |
|---|---|---|
| `speed-gate.ts` | Speed Gate (exact-ID, FAQ, cache) | ✅ |
| `language-gateway.ts` | LID, Hinglish, Terminology Lock | ✅ |
| `context-resolver.ts` | Active entities, anaphora, rewriting | ✅ |
| `retrieval.ts` | Hybrid retrieval (pgvector + FTS) | ✅ |
| `adjudicator.ts` | 9-step Evidence Adjudicator | ✅ |
| `applicability.ts` | Applicability classification | ✅ |
| `orchestrator.ts` | Agent dispatch | ✅ |
| `dossier-builder.ts` | 10-section Compliance Dossier | ✅ |
| `evidence-only.ts` | Evidence-only rendering | ✅ |
| `guardrails.ts` | Trust Gate (markers, candidates, tiers) | ✅ |
| `llm-provider.ts` | LLM orchestration (Groq + Gemini) | ✅ |
| `conversational-router.ts` | Intent routing | ✅ |
| `taxonomy.ts` | Product taxonomy engine | ✅ |
| `disambiguation.ts` | Product disambiguation | ✅ |
| `source-registry.ts` | Source catalogue | ✅ |
| `outdated-checker.ts` | Outdated-reference checker | ✅ |
| `vision-inspector.ts` | ISI mark detection | ✅ |
| `form-generator.ts` | Form I draft generation | 🔧 |
| `standards-helper.ts` | Standards data helper | ✅ |
| `embeddings.ts` | Embedding generation (Gemini) | ✅ |
| `db.ts` | PostgreSQL + pgvector layer | ✅ |
| `local-db.ts` | Sovereign local persistence & vector engine | ✅ |
| `storage.ts` | MinIO storage interface | ✅ |
| `pdf-parser.ts` | PDF parsing + OCR | ✅ |
| `chat-storage.ts` | Conversation persistence | 🔧 |
| `types.ts` | TypeScript type definitions | ✅ |

### Experience Components & APIs (`prototype/src/`)

| File | Component | Status |
|---|---|---|
| `components/features/PdfSourceViewerModal.tsx` | NotebookLM-style authentic PDF source viewer modal | ✅ |
| `components/employee/StagedChunkEditorModal.tsx` | Staging chunks & statutory facts knowledge editor modal | ✅ |
| `components/chat/CitationRenderer.tsx` | Interactive citation pill & statutory standard highlighter | ✅ |
| `components/employee/EmployeePipeline.tsx` | Multi-doc batch ingestion queue & heuristic classifier | ✅ |
| `app/api/v8/documents/[id]/pdf/route.ts` | PDF streaming gateway with official statutory fallback | ✅ |
| `app/api/v8/documents/[id]/route.ts` | Document metadata & chunk CRUD/update endpoint | ✅ |

### Ingestion & Processing Scripts (`scripts/`)

| File | Purpose | Status |
|---|---|---|
| `download_bis_pdfs.py` | Internet Archive scraper for authentic BIS standards | ✅ |
| `ingest_folder.ts` | PyMuPDF vector parser, chunker & 768-dim embedder | ✅ |
| `test_retrieval.ts` | 5-signal retrieval verification suite | ✅ |
| `e2e_test.ts` | End-to-end query answering and refusal test harness | ✅ |

### Data Files (`prototype/src/data/`)

| File | Contents | Status |
|---|---|---|
| `standards.json` | 101+ standards (Tier A) | ✅ |
| `laboratories.json` | 430+ labs with scope | ✅ |
| `qcos.json` | QCO registry | ✅ |
| `schemes.json` | Certification schemes | ✅ |
| `knowledge_base.json` | Curated knowledge entries | ✅ |
| `disambiguation.json` | Product disambiguation maps | ✅ |
| `groups.json` | Product taxonomy groups | ✅ |
| `pin_centroids.json` | PIN-code geocoding | ✅ |

---

## 6. Test Matrix

Current test suite: 15 test cases covering:
- Simple standard lookups (IS 456, IS 2062)
- Complex MSME product queries (steel bottles, helmets, PVC pipes)
- Consumer verification (CM/L, HUID)
- Lab search with location
- Certification route queries
- QCO mandatory/voluntary checks
- Hinglish queries
- Out-of-scope handling
- Multi-turn context

**Pass rate:** 14/15 (93.3%) — remaining failure linked to environment (PostgreSQL/MinIO connectivity)
