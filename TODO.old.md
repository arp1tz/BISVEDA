# BISVEDA V9 — Feature & Phase TODO

> **Updated:** 2026-09-27  
> **Status Legend:** ✅ Done · 🔧 Partial · ❌ Not Started · 🔮 Production-Only  
> **Phase Status:**
> - ✅ **Phase 1 — RAG Pipeline + Knowledge Layer (P0)** (Completed: 25/25 golden tests passed, 0 wrong standards, 100% primary/citation/number support, 17/17 unit tests passed) — [PHASE_1_REPORT.md](file:///c:/BISVEDA/docs/v9/PHASE_1_REPORT.md)
> - ✅ **Phase 2 — Knowledge Console (graph + version control + facts)** (Completed: 8/8 acceptance checks passed, 25/25 golden tests passed, Obsidian-style graph, PDF versioning, fact review, audit trail) — [PHASE_2_REPORT.md](file:///c:/BISVEDA/docs/v9/PHASE_2_REPORT.md)
> - ✅ **Phase 3 — Minimal UI & Conversational Refinements** (Completed: 10/10 acceptance checks, 25/25 golden tests, multi-turn context retention, interactive Leaflet labs map, near-me sorting, Read Aloud TTS, Voice mic STT, attachment preview, guided pathways) — [PHASE_3_REPORT.md](file:///c:/BISVEDA/docs/v9/PHASE_3_REPORT.md)
> - 🔧 **Phase 4 — Photo Inspector Honesty & Conversational Vision** (Plan Approved: multi-turn vision stream, fake licensee removal, honest categorical verification, random image rejection) — [PHASE_4_PLAN.md](file:///c:/BISVEDA/docs/v9/PHASE_4_PLAN.md)
> - ❌ **Phase 5 — Later (lab links, polish)**

---

## L0 — Data Governance, Source Authority & Acquisition

### Source Registry (§5.1)
- ✅ `source-registry.ts` — Source catalog with trust policies and tier definitions
- ❌ Source Trust Policy persistence (primary/supplementary/deprecated/experimental)
- ❌ Connector Registry (connector name, schedule, health, rows ingested)
- ❌ Access Policy Map (per-role visibility)
- ❌ URL Allowlist enforcement (`bis.gov.in`, `manakonline.in`, etc.)

### Primary Data Sources (§5.2)
- ✅ `standards.json` — 101+ standards seeded (Tier A catalogue metadata)
- ✅ `laboratories.json` — 430+ labs with scope/location data
- ✅ `qcos.json` — QCO registry with mandatory/voluntary status
- ✅ `schemes.json` — Certification schemes (I, II, X, FMCS, Hallmarking)
- ✅ `knowledge_base.json` — Curated BIS knowledge entries
- ✅ `disambiguation.json` — Product disambiguation mappings
- ✅ `pin_centroids.json` — PIN-code geocoding data
- ❌ Amendment slips data
- ❌ Hallmarking regulations & mandatory-hallmarking orders
- ❌ AHC directory data
- ❌ Official FAQ entries (structured `faq_entries`)
- ❌ What's New / announcements feed data
- ❌ Fee schedules (structured)
- ❌ Recalls / safety alerts data
- ❌ NABL directory data
- ❌ Standards Clubs & training calendar data

### Knowledge Tiers (§5.3)
- 🔧 Tier A (catalogue metadata) — seeded in `standards.json`
- 🔧 Tier B (public full text) — `knowledge_base.json` has curated entries
- ❌ Tier C (licensed full text) — requires BIS MOU
- ❌ Tier propagation on `documents.knowledge_tier`, `chunks.knowledge_tier`
- ❌ Claim policy enforcement per tier in generation

### Acquisition Connectors (§5.4)
- ✅ `catalogue` connector (standards.bis.gov.in scraper contract & runner)
- ✅ `labs` connector (BIS recognized-lab list scraper contract & runner)
- ✅ `ahc` connector (AHC directory scraper contract)
- ✅ `qco` connector (QCO/eGazette scraper contract)
- ✅ `whats_new` connector (BIS What's New scraper contract)
- ✅ `schemes` / `hallmarking` / `faq` / `consumer` connectors
- ✅ `geocode` connector (PIN-code centroid + OSM Nominatim)
- ✅ Connector rules (1 req/sec rate limit, on-disk cache, SHA-256 provenance)

### BIS Product Taxonomy (§5.5)
- ✅ Full Division → Committee → Product Group → Type → Variant hierarchy (`groups.json`)
- ✅ `taxonomy.ts` — Engine with colloquial synonym dictionary (*sariya*, *chuna*, *plastic pipe*, etc.)
- ✅ Self-verification invariant (verifies product group committees & known IS containment)
- ✅ Priority groups enumeration & missing-attribute clarification chips

### Governance Controls (§5.6)
- ✅ Provenance tracking (source ID, doc ID, page, clause, ingestion time, SHA-256 checksum, tier)
- ✅ Effective dating (publication, amendment, QCO enforcement)
- ✅ Version locking & record verification status (`verified` / `provisional` / `demo`)
- ✅ Badging on demo/provisional records

### Document Authenticity (§5.7)
- ✅ Tiered authenticity checks (Tier B: provenance; User: integrity & minimum size thresholds)
- ✅ Outcomes: `VERIFIED`, `PROVISIONALLY_VERIFIED`, `REJECTED`
- ✅ Wrong Document Detection (§5.8) in ingestion pipeline
- ❌ Source Change & Refresh Manager (§5.9)

---

## L1 — Gateway, Multimodal Input, Language & Session

### API Gateway & Security (§6.2)
- 🔧 Next.js API routes serve as gateway — basic request handling
- ❌ Rate limiting (anonymous 30 rpm, authenticated 120 rpm, partner 600 rpm)
- ❌ RBAC via Keycloak/middleware
- ❌ Request sanitization (NFC normalization, null bytes, size/MIME limits)
- ❌ Abuse detection

### Multimodal Input Handler (§6.3)
- ✅ Image upload for helmet ISI detection (vision inspector)
- ❌ Image validation (JPEG/PNG/WebP/HEIC, ≤10 MB, 200–4096 px)
- ❌ ClamAV malware scan
- ❌ EXIF strip + auto-orient
- ❌ Document upload (PDF/DOCX/TXT, ≤25 MB, ≤100 pages)
- ❌ Voice input (WAV/OGG/MP3/M4A/WebM, ≤120s, ≤10 MB)
- ❌ `media_id` (SHA-256) generation + quarantine TTL

### Speed Gate (§6.4)
- ✅ `speed-gate.ts` — Fast-path engine (<150ms) strictly for exact identifiers and verbatim official FAQs
- ✅ Exact identifier lookup (IS standard codes, CM/L license numbers, HUID hallmarking codes) without conversational traps
- ✅ Verbatim official FAQ matching with source links (strictly meta/procedural BIS questions)
- ✅ Exact query cache (in-memory 10-minute TTL, <50ms response)
- ❌ Semantic cache (embedding similarity ≥ threshold for `verified` responses)
- ✅ Media-present bypass logic
- ✅ Stage-event alignment per Axiom A16 (never emits fake RAG stages on Speed Gate hits)

### Language Gateway (§6.5)
- ✅ `language-gateway.ts` — fastText LID + script heuristics + English bypass
- ✅ Hinglish normalization (code-mix handler)
- ✅ Terminology Lock (IS codes, clause IDs preserved)
- ❌ IndicXlit transliterator
- ❌ Bhashini / IndicTrans2 translation
- ❌ Marker & Lock Survival Contract (multiset citation check after translation)
- ❌ Official Hindi titles from catalogue preferred over machine translation

### Voice Lifecycle (§6.6)
- ❌ ASR (Bhashini / IndicConformer)
- ❌ TTS in answer's actual language
- ❌ Noise reduction (`noisereduce`)
- ❌ Confidence gate (<0.65: ask to repeat)
- ❌ Web Speech API client fallback
- ❌ Audio purge after transcription

### Context Resolver (§6.7)
- ✅ `context-resolver.ts` — Active entities tracking (standards, products, materials, locations)
- ✅ Clarification memory & parameter refinement ("1 litre, stainless steel 304")
- ✅ Anaphora resolution ("iska fee kitna hai?", "tell me about this", "what certification do I need?")
- ✅ Context-aware conversational rewriting without forcing user repetition
- 🔧 1,500-token budget & multi-turn structured history resolution

### Session Manager (§6.8)
- ❌ Research thread surface (bound to current research)
- ❌ Site-wide assistant surface (general BIS questions)
- ❌ Redis hot state + PostgreSQL persistence
- ❌ Surface isolation (messages never cross surfaces)

### User Modes & Accessibility (§6.9)
- ❌ Mode presets: Consumer / Business / Student / Laboratory
- ❌ WCAG 2.1 AA compliance
- ❌ Skip link, screen-reader access, keyboard-complete
- ❌ Focus management, reduced motion
- ❌ Hindi-first UI toggle

---

## L2 — Knowledge Ingestion, Authenticity & Visual Intelligence

### Ingestion Orchestrator (§7.1)
- ✅ In-process multi-step job runner with SSE event streaming
- ✅ Intake controller (validates payloads from connectors/admin/users)
- ✅ Format normalizer (DOCX/TXT/PDF fallback parser)
- ✅ Deduplicator (SHA-256 + IS number)
- ✅ Job Event Emitter (`job.step.started/completed/failed` with counts)

### Parsing & OCR (§7.2)
- ✅ Text/Document parser with OCR fallback
- ❌ Docling layout analysis (headings, tables, figures, footnotes in production)
- ❌ Formula extraction (LaTeX-OCR)
- ✅ Page-level parsing & char count extraction

### Clause-Aware Chunking (§7.3)
- ✅ Hierarchical chunking (Standard > Part > Section > Clause > Sub-clause)
- ✅ Never-split-a-table rule
- ✅ Breadcrumbs on every chunk
- ✅ 256–512 token target, 32-token overlap within clause

### Metadata Enrichment (§7.4)
- ✅ Product classification (taxonomy tagging via `groups.json`)
- ✅ Scheme tagging & QCO linkage
- ✅ Knowledge tier + verification status tagging

### Visual Content Analyzer (§7.6)
- ✅ Vision Inspector for ISI mark detection on helmets
- ❌ General figures/diagrams/charts → description + labels
- ❌ Logo/stamp detection as evidence signals

### Outdated-Reference Checker (§7.10)
- ✅ `outdated-checker.ts` — Extracts cited IS numbers, resolves against catalogue
- ✅ Reports: `current`, `older edition`, `withdrawn`, `superseded`, `not in catalogue`
- ✅ Integrated into Ingestion Pipeline

### Amendment Overlay Engine (§7.8)
- ❌ Amendment parser (substitute/insert/delete)
- ❌ Overlay producing effective-version chunks
- ❌ Supersession linker
- ❌ Chronological multi-amendment resolution

### Ingestion Console (§7.11)
- ✅ Admin surface driven by real `ingestion_job_events` (SSE streaming)
- ✅ Per-step status, duration, counts, warnings
- ✅ Connector runs view with manual trigger action
- ✅ Review queue (provisional documents, approve / reject actions)

---

## L3 — Knowledge Fabric & Storage

### Stores (§8.1)
- ✅ PostgreSQL 16+ with `pgvector` (HNSW), `pg_trgm`, `tsvector` active via Docker Compose
- ✅ MinIO S3 object storage for raw documents (`bisveda-documents`) and artifacts (`bisveda-artifacts`)
- 🔧 Redis 7 (in-process hot state with browser localStorage + PostgreSQL persistence)
- 🔮 OpenSearch 2.x (Phase 2+ only if PG FTS fails)

### Relational Schema (§8.2)
- ✅ `documents` table (+tier, +verification, +source_url, +sha256)
- ✅ `chunks` table (+embedding vector(768), +tier, +locator, +tsv)
- ✅ `ingestion_jobs` + `ingestion_job_events` tables (job status, metrics, step events)
- ✅ `outdated_reference_reports` table
- 🔧 `standards`, `labs`, `qco_registry`, `sources` (seeded & queried via relational DB layer / fallback)
- 🔧 `conversations` + `conversation_turns` (persisted in local storage + DB sync)
- 🔧 `dossiers` + `adjudications` (generated, audited, exportable)

### Apache AGE Graph (§8.3)
- ❌ Nodes: Standard, Clause, Amendment, QCO, Scheme, Lab, AHC, Product, Committee, ProductGroup
- ❌ Edges: HAS_CLAUSE, MODIFIES, SUPERSEDES, MANDATES, etc.
- 🔧 Fallback: relational edge tables with recursive CTEs behind `GraphRepository` interface

---

## L4 — Query Intelligence, Context, Retrieval & Adjudication

### Staged Intent Router (§9.1)
- ✅ Stage 1 — Rule-based routing (identifier regexes, greeting/help, speed-gate)
- ✅ Stage 2 — LLM classifier for intent routing
- ✅ Clarification as structured chips from taxonomy missing-attributes & recommended specifications
- ✅ Gibberish detector (character entropy, key-smash detection, vowel ratio, script mix)
- ✅ Blocked-topic & out-of-scope regulatory boundary lists
- 🔮 Stage 3 — Distilled multilingual classifier (production, ≥500 labels/class)

### Multi-Task Planner (§9.2)
- 🔧 Multi-task planning across standard discovery, QCO check, lab search, and certification route
- ❌ DAG of typed subtasks (sequential where dependent, parallel otherwise)
- ❌ Max 5 parallel tasks, 30s wall-clock

### Image-Augmented Query (§9.3)
- ✅ Image → OCR + Vision → ISI mark entity extraction (Gemini Multimodal)
- ✅ Live Camera capture stream (`getUserMedia`) and arbitrary file upload/drop
- ✅ Separate confidence metrics (`ocrConfidence`, `extractionConfidence`, `kbMatchConfidence`, `groundingState`)
- ✅ Strict `UNABLE_TO_VERIFY` state for uncertified/ambiguous images
- ❌ QR/URL payload validation against allowlist

### Exact-First Identifier Policy (§9.4)
- ✅ Full normalize → exact lookup → pinned rank 1 in retrieval
- ✅ Dense/sparse retrieval never displaces exact match

### Hybrid Retrieval (§9.5)
- ✅ `retrieval.ts` — hybrid retrieval querying pgvector chunks (Rank 1) + FTS tsvector + curated KB
- ✅ Chunk dense retrieval (`chunks.embedding` via Gemini 768-dim embeddings)
- ✅ Full BM25 / FTS lexical search (`to_tsquery('english', ...)`)
- ✅ Real ingested PDF chunk citations (`[S#]`) returned in synthesis
- ❌ Graph retrieval (supersession, amendments, QCO mandates, lab scope)
- 🔧 Structured SQL retrieval (labs, AHCs, fees, workflows)
- ❌ FAQ entry retrieval (`faq_entries.embedding`)

### Fusion, Reranking & Relevance Floor (§9.6)
- ❌ RRF (k=60) across dense/lexical/taxonomy lists
- ❌ Cross-encoder reranking (bge-reranker-v2-m3, top 30 → top 8)
- ✅ Calibrated relevance floor (0.45 floor → out_of_corpus named-boundary refusal)
- ✅ Exact phrase search (ILIKE) & exact-first pinned rank 1 (preventing vector displacement)

### Evidence Adjudicator (§9.8)
- ✅ `applicability.ts` — deterministic applicability classification
- ✅ `adjudicator.ts` — Full 9-step deterministic Evidence Adjudicator (Axiom A1 / §9.8 / C1):
  - ✅ Step 1: Chunk-volume bias resistance (weighted top-chunk + top-3 depth aggregation)
  - ✅ Step 2: Coverage analysis per 7 query dimensions (product, material, use, rating, testing, certification, identifier)
  - ✅ Step 3: Full 7 applicability classes (`directly_applicable`, `potentially_applicable`, `related_standard`, `related_material_mismatch`, `scope_unclear`, `insufficient_evidence`, `not_applicable`)
  - ✅ Step 4: Conflict detection (superseded editions, conflicting materials)
  - ✅ Step 5: Calibrated relevance floor check (0.45 floor → out_of_corpus refusal)
  - ✅ Step 6: Grounding state resolution (`verified` / `supported_inference` / `insufficient_evidence`)
  - ✅ Step 7: Confidence label derivation (`verified_evidence` / `partially_supported` / `limited_evidence` / `no_verified_evidence`)
  - ✅ Step 8: Citable evidence ledger with `[S#]`, `official_source`, tier, locator, snippet
  - ✅ Step 9: Knowledge tier claim policy enforcement (Tier A forbids numeric test claims)
- 🔧 Adjudication report audit logging in-memory (PostgreSQL persistence in Phase 3)

---

## L5 — Orchestrator & Specialist Agents

### Orchestrator Core (§10.1)
- ✅ `orchestrator.ts` — specialist agent dispatch
- ✅ SSE stage-event streaming from `api/v8/query/route.ts`
- 🔧 Stage-Event Contract — basic events emitted (not full §10.1.2 spec)
- ❌ LangGraph deterministic state machine
- ❌ Plan executor (runs §9.2 DAG)
- ❌ Clarification controller (emits `clarification.required` with options)
- ❌ Budget controller (max 3 agents/query, max 2 LLM calls/agent, 30s)
- ❌ Trace writer

### Compliance Dossier (§10.1.3)
- 🔧 Partial dossier structure in SSE response
- ✅ `dossier-builder.ts` — Full 10-section Compliance Dossier (§10.1.3):
  - ✅ `interpretation` — product, substrate, intended use, capacity rating, user type, market scope
  - ✅ `standards` — candidates with 7 applicability classes and why coverage
  - ✅ `regulatory` — QCO status, order reference, enforcement date, ministry, Section 29 penal liability
  - ✅ `certification_route` — scheme name, MSME 30-day simplified track, ordered steps, required enclosures, fee schedule, Manak Online link
  - ✅ `testing` — tier-gated STI clauses; Tier A records disclose catalogue boundaries
  - ✅ `labs` — BIS-recognized labs with location, distance, and scope
  - ✅ `next_actions` — concrete compliance checklist
  - ✅ `evidence_ledger` — authoritative `[S#]` citations
  - ✅ `summary` — synthesized statutory prose
  - ✅ `trust` — grounding state, confidence label, caveats
- 🔧 Browser / Print PDF export (WeasyPrint in Phase 5)
- ✅ Dossier seeds Form I preparation

### Generation Contract (§10.2)
- 🔧 LLM generation with system prompts and evidence
- ❌ Slot schema (only prose fields, no decision fields)
- ✅ IS numbers in prose must be in adjudicated candidate set (enforced by L6)
- ✅ Claims beyond tier's claim policy rejected by L6 (Tier A numeric limits caught)
- ❌ Temperature ≤ 0.2, max output tokens per slot
- ❌ Structured-output mode with JSON repair + retry

### Evidence-Only Mode (§10.3)
- ✅ `evidence-only.ts` — Deterministic template rendering from adjudicated package
- ✅ Same citations, same trust result, zero hallucination
- ✅ Terminal fallback of provider chain when LLM is unavailable or throttled

### Specialist Agents (§10.5)
- ✅ AG1 — Standards & Clause Intelligence (basic)
- ✅ AG2 — QCO & Regulatory (basic)
- ✅ AG3 — Technical Specifications (basic)
- ✅ AG4 — Certification & Licensing (basic)
- ✅ AG5 — Lab & Centre Locator (basic)
- ✅ AG6 — Consumer Assistance (basic)
- ✅ AG7 — Education & Training (basic)
- ❌ AG8 — Standard Comparison (diff engine)
- ❌ AG9 — Form Preparation (template-driven)
- ❌ AGF — Fallback (FAQ search, catalogue lookup, official links)
- ❌ SK-CR — Conflict Resolution Skill
- ❌ Document Review flow

### Eligibility Assessment Engine (§10.13)
- ❌ Deterministic rule engine over `eligibility_rules`
- ❌ Per-rule trace
- ❌ Outputs applicable schemes, mandatory vs voluntary, gaps

### Business Context Engine (§10.14)
- ❌ Role/org/industry/MSME class/product/market/location → filters + detail level
- ❌ Mode presets set defaults

---

## L6 — Trust Gate & Guardrails

### Validation Tier 1 — Hard Blocks (§11.1)
- ✅ `guardrails.ts` — Hardened Trust Gate & Guardrails pipeline
- ✅ Citation marker resolution (bracket normalization `【S1】`, `［S1］`, `〔S1〕`, `『S1』` → `[S1]`)
- ✅ Unresolved markers stripped against citable ledger
- ✅ Candidate-set check (all IS numbers in prose verified against adjudicated candidate set; ungrounded ones dropped)
- ✅ Tier claim policy enforcement (numeric test limits forbidden for Tier A catalogue records)
- ❌ NLI contradiction check (`nli-deberta-v3-base`)
- ❌ PII detection (Presidio + Indian patterns: Aadhaar, PAN, phone)
- ❌ Prompt injection detection (input classifier + output patterns)
- ❌ Evidence-class violation check (`user_provided` cited as `[S#]`)
- ❌ Access policy enforcement (role vs source licence)

### Validation Tier 2 — Caveats (§11.1)
- ✅ Basic caveats in response
- ❌ NLI neutral caveat
- ❌ Stale source caveat
- ❌ Low retrieval confidence caveat
- ❌ Low OCR/VLM/ASR confidence caveat
- ✅ Superseded source caveat
- ❌ Translation confidence caveat
- ✅ Metadata-only (Tier A) notice ("Numeric test values omitted in compliance with catalogue license boundaries")

### Validation Tier 3 — Quality Logging
- ❌ Completeness, citation density, coverage logging
- 🔧 Stripped-marker counts logging
- ❌ Translation refusals logging

### Safe Refusal (§11.4)
- ✅ `out_of_corpus` — names corpus boundary + helpline 14434 + official portal next steps
- ✅ `out_of_scope` refusal template
- ✅ `insufficient_evidence` — names missing facts + clarification offer
- ✅ `blocked` — injection/policy refusal

### Evidence Classes (§11.5)
- ✅ `official_source` (citable `[S#]`, solid emerald tag in Research Workspace)
- ❌ `user_provided` (not citable, neutral tag)
- ✅ `ai_interpretation` (not citable, outlined tag in Layman Explain modal)

---

## L7 — Operations Platform

### Observability (§12.1)
- ❌ OpenTelemetry traces (trace_id per turn + stage)
- ❌ Prometheus/Grafana metrics
- ❌ Loki structured logs with PII redaction
- ❌ Dashboards (query volume, intent mix, latencies, cache rates, etc.)

### Deployment (§12.3)
- ✅ `npm run dev` — local dev server
- ❌ Docker Compose (dev/demo)
- ❌ Kubernetes with Helm, Terraform, ArgoCD

### Admin Console (§12.8)
- ❌ Source registry & connectors view
- ❌ Ingestion Console
- ❌ Review queues
- ❌ Taxonomy & synonym editor
- ❌ QCO/lab/AHC managers
- ❌ Form template manager
- ❌ Quality page (§28.5)
- ❌ Audit log

### Circuit Breakers (§12.9)
- ❌ Provider chain fallback (generation → evidence-only)
- ❌ Vision model degradation (OCR + pyzbar → ask user)
- ❌ Embeddings fallback (cached → lexical + taxonomy + exact-ID)
- ❌ Translation fallback (alternate engine → English with notice)
- ❌ ASR/TTS fallback (alternate engine → text-only)

---

## XL — Experience Layer (UI)

### Home Page (§21.3 `/`)
- ✅ Distinct centered full-width Hero with industrial blueprint overlay (`/bis_bg_engineering.jpg`)
- ✅ Single prominent ask/search bar with integrated action triggers: `[Ask BISVEDA]`, `[Upload Image]`, `[Camera]`, `[Upload Document]`, `[Check Certification Route]`
- ✅ Dynamic example-query chips and popular search chips
- ✅ Horizontal BISVEDA Evidence Strip (`✓ BIS Standards • ✓ QCO & Gazette Information • ✓ Certification Guidance • ✓ Verified Laboratory Network • ✓ Source-backed Answers`)
- ✅ Clean 2×3 "What can BISVEDA do for you?" grid with icon, description, and direct action triggers
- ✅ Distinct 4-step "How BISVEDA Works" statutory compliance workflow (`1 ASK → 2 IDENTIFY → 3 VERIFY → 4 ACT`)
- ✅ Asymmetric layout: Recent Regulatory Research (65%) on left, Latest BIS Updates (35%) on right
- ✅ Clean initial state: Starts empty and new without prefilled queries
- ✅ Zero architecture jargon exposed (pgvector, RAG, embeddings, orchestration hidden from public UI)

### Research Workspace (§21.3 `/research/[id]` & `/`)
- ✅ 3-Column Studio Layout:
  - **LEFT COLUMN**: Workspace Context & Recent Searches (active research query, recent search history, related standards, location filter)
  - **CENTER COLUMN**: Conversational Research Feed with multi-turn streaming, dynamic query-relevant product specification refinements, STI clauses, Scheme-I MSME concessions, interactive Leaflet OpenStreetMap laboratory geolocation
  - **RIGHT COLUMN**: Verified BIS Sources & Evidence Panel (statutory citations, verbatim text inspection modal, dossier export)
- ✅ Dynamic Product Specification Refinements: Only shown when inquiring about configurable products; hidden on operational, lab, or fee queries
- ✅ Quick direct-action chips (`🔬 Find Labs`, `📋 STI Clauses`, `💰 80% MSME Subsidy`, `📜 Gazette QCO`, `⚖️ Compare Standards`)
- ✅ Multi-turn conversational flow with auto-scroll and direct conversational search input
- ✅ Streaming dossier sections (stage-driven rendering)
- ✅ Clarification card UI with actionable option selection
- ✅ Evidence ledger (citable `[S#]` items with official source tags and outbound portal links)
- ✅ Testing requirements strictly scoped to primary standard (no cross-contamination from unrelated standards)
- ✅ Watermark / scraper artifact cleaning (removes china-gauges / URLs from evidence chunks)
- ✅ "Research in Full Workspace" action from Visual Inspector modal smoothly transitions to 3-column studio research
- ✅ Clean header aesthetics (removed unnecessary top tricolor/gradient bar)
- ✅ Why panel (coverage rationale per candidate)
- ✅ Tickable roadmap (certification steps & next actions checklist with strikethrough)
- ✅ Export PDF button (Print/PDF export trigger)
- 🔧 Feedback control with typed reasons

### Standards Knowledge Base (§21.3 `/standards`)
- ✅ `/standards` route — search by number/title/category
- ✅ Filters (group, committee, status)
- ✅ Tier filter (Tier A Catalogue / Tier B Full Text & STI / All Tiers)
- ✅ Multi-select → compare with floating comparison dock

### Standard Passport (§21.3 `/standards/[id]`)
- ✅ `/standards/[id]` route — fact grid, status badge
- ✅ Monospaced IS number (`font-mono font-black`)
- ✅ Official Hindi titles (EN/HI dual-language statutory headings)
- ✅ Tier badge ("Tier B: Public Full Text")
- ✅ Verification badge (VERIFIED STATUTORY RECORD with SHA-256 Merkle Provenance)
- ✅ "Explain simply" toggle (AI interpretation tag via `ExplainSimplyModal`)
- ✅ Actions: "Research Workspace (3-Panel)", "Ask Questions in Chat", "Add to Comparison Matrix", "Official BIS Details"

### Certification Hub (§21.3 `/certification`)
- ✅ `/certification` route with wizard
- ✅ MSME fee concession calculator
- ✅ 01–05 sequential pathway visualization
- ✅ Scheme explorer (Scheme-I, II, IV, FMCS, Tatkal/Simplified)
- ✅ Tickable roadmap bound to Eligibility Engine

### Testing & Labs (§21.3 `/testing`)
- ✅ `/testing` route with lab list
- ✅ Browser geolocation permission prompt (`navigator.geolocation`) with dynamic proximity sorting
- ✅ Haversine distance ranking with real-time `~X km away` badge
- ✅ User location marker (pulsing blue pin) and map auto-fit bounds
- ✅ Accurate laboratory geocoding (Ghaziabad/Sahibabad accurately pinned in UP, Mumbai in Maharashtra, etc.)
- ✅ PIN-code / city distance sorting
- ✅ List/Map interactive Leaflet OpenStreetMap view with custom pins & popups
- ✅ AHC layer (Assaying & Hallmarking Centres) filter
- ✅ Un-geocoded entries listed, not plotted (strictly geocoded coordinates mapped)
- ✅ Validity filter (Active Only / Renewal Pending)

### Consumer Services (§21.3 `/consumer`)
- ✅ `/consumer` route with mark verifier
- ✅ CM/L, CRS, HUID shape validators
- ✅ Multimodal Visual Product Inspector Modal with camera capture & image upload
- ✅ Interactive Leaflet OpenStreetMap location preview box alongside accredited testing facilities
- ✅ Complaint routes with official links (BIS e-Complaint, NCH 1915, E-Daakhil)
- ✅ Recalls list & Safety alerts directory with status filters

### Updates Feed (§21.3 `/updates`)
- ✅ `/updates` route
- ✅ Weekly groups with category filters (QCOs, Amendments, New Standards, Lab Circulars, Safety Alerts)
- ✅ Source links + standard Passport links

### Document Workspace (§21.3 `/documents`)
- ✅ `/documents` route exists
- ❌ Upload → identity/authenticity → cited-IS list → outdated-reference report
- ❌ "Research with this document" action

### Form I Preparation (§21.3 `/forms/form-i`)
- ✅ `form-generator.ts` — Schedule II draft generation
- ✅ 1-click form draft button in workspace
- ✅ Dedicated `/forms/form-i` route
- ✅ 7 statutory field groups with provenance and confidence
- ✅ Amber confirmations for factory verification
- 🔧 Draft PDF rendering (Browser/Print export)
- ✅ Manak Online tab-by-tab crosswalk (Tabs 1–6)
- 🔧 Dossier seeds Form I job

### Comparison (§21.3 `/compare`)
- ✅ `/compare` route — 4-way comparison matrix
- ❌ Amendment differences with sources
- ❌ Side-by-side facts with evidence

### Admin Console (§21.3 `/admin/*`)
- ✅ `/admin` route exists
- ✅ Ingestion Console with real PDF upload, SHA-256 deduplication, MinIO storage, and pgvector persistence
- ❌ Sources & connectors management
- ❌ Review queues
- ❌ Taxonomy editor
- ❌ Quality page

### Quality Page (§21.3 `/quality`)
- ✅ `/quality` route exists
- ❌ Latest measured eval summary with date and suite IDs
- ❌ Admin view links failing cases

### Site-Wide Assistant
- ❌ Floating widget (separate conversation surface)
- ❌ "Discuss these results" imports scope explicitly

### Design System Primitives (§21.5)
- ✅ `SearchHero` (Centered hero with action triggers & example queries)
- ✅ `ServiceCard` (2×3 "What can BISVEDA do for you?" grid)
- ✅ `StandardCard` (Applicable standard cards with scope & applicability rationale)
- ✅ `ApplicabilityBadge` (DIRECTLY_APPLICABLE / POTENTIALLY_APPLICABLE badges)
- ✅ `GroundingBadge` (Verified BIS Finding / Verified against BIS sources)
- ✅ `VerificationBadge` (VERIFIED / PROVISIONAL badges)
- ✅ `SourceTag` (official: solid · user: neutral · AI: outlined)
- ✅ `EvidenceCitation` ([S1], [S2] inline statutory citations)
- ✅ `EvidenceLedger` (Sources & Evidence Panel on right rail)
- ✅ `WhyPanel` (Statutory rationale per candidate standard)
- ✅ `ClarificationCard` (Pre-RAG polysemous ambiguity trap)
- ✅ `RefinementChips` (Dynamic product-relevant specifications & measurement pills)
- ✅ `StageList` (SSE real-time stream status indicator)
- ✅ `LabMap` (Interactive Leaflet OpenStreetMap with custom pins & popups)
- ✅ `Roadmap` (Scheme-I sequential roadmap & MSME fast-track checklist)
- ❌ `PassportHeader`
- ❌ `FactGrid`
- ❌ `EmptyState`
- ❌ `ErrorState`
- ❌ `InsufficientEvidence`
- ❌ `FeedbackControl`
- ❌ `JobTimeline`

### Visual Identity (§21.2)
- ✅ Deep navy primary (`#002147` / `#001529`) + controlled saffron/orange accent (`#FF9933` / `#E65100`)
- ✅ Restrained green exclusively for verification and NABL accreditation states
- ✅ Official Ministry of Consumer Affairs, Food & Public Distribution and Bureau of Indian Standards branding
- ✅ Monospaced IS numbers throughout (`font-mono font-black`)
- ✅ Light/dark theme toggle in navbar
- ❌ Devanagari/Indic script tuning (line-height, no clipped matras)

### Accessibility (§21.7)
- ❌ WCAG 2.1 AA
- ❌ `role="status"` live regions for stage updates
- ❌ Keyboard-complete workspace (panel focus cycling)
- ❌ Reduced-motion honoured
- ❌ axe-core CI checks
- ❌ Three-panel → two-panel → tabbed responsive layout

### Internationalization (§21.9)
- 🔧 Bilingual language notices in chat
- ❌ Full UI strings in EN + HI
- ❌ Locked tokens never localized
- ❌ Western Arabic numerals for IS numbers and units

---

## Cross-Cutting Features

### Form I Architecture (§13)
- 🔧 Basic form draft generation
- ❌ 7 statutory sections with per-field provenance and confidence
- ❌ Deterministic validation (PAN/GSTIN formats, STI check, subcontracting)
- ❌ WeasyPrint PDF rendering with watermark
- ❌ Manak Online crosswalk
- ❌ Dossier seeds Form I (product, standard, scheme, labs pre-filled)

### Multimodal Architecture (§14)
- 🔧 Text + Image input converge on query pipeline
- ❌ Mixed-modality conflict → clarification
- ❌ All non-text extractions as `user_provided`/`untrusted_extraction`

### Voice Architecture (§15)
- ❌ ASR: Bhashini / IndicConformer
- ❌ TTS: Bhashini / IndicTTS
- ❌ LID: Bhashini / fastText
- ❌ Noise reduction: `noisereduce`
- ❌ Streaming (WebSocket) and batch (WhatsApp) modes
- ❌ Confidence gate
- ❌ TTS in answer's actual language

### Image Architecture (§16)
- ✅ Vision Inspector for ISI marks on helmets
- ❌ Preprocessing (OpenCV)
- ❌ Parallel OCR ∥ Vision ∥ pyzbar
- ❌ ISI-mark heuristic + vision confirmation
- ❌ Entity merger into candidates

### Knowledge Refresh (§17)
- ❌ Change detection → impact assessment → reprocess → re-embed → cache invalidation
- ❌ Updates feed (`What's New` rail + filterable page)
- ❌ Lifecycle states (CURRENT, AMENDED, SUPERSEDED, WITHDRAWN, etc.)

### Feedback-to-Learning (§18)
- ❌ Typed feedback collection (7 reason categories)
- ❌ Implicit signals (rephrase, drop-off)
- ❌ Pipeline: normalize → classify → queues → curated datasets → eval
- ❌ Admin promotion gate
- ❌ Auto-rollback on regression (>5% relative drop)

### Language Capability Registry (§19)
- ❌ Per language × capability matrix
- ❌ Marker-and-lock survival suite pass rate stored
- ❌ Automatic downgrade on survival regression

### Model Architecture (§22)
- 🔧 Groq API for generation + Gemini for vision
- ❌ Model Registry with roles (reasoning, vision, router, escalation, embedding, reranker, NLI, etc.)
- ❌ Provider Chain: local → hosted → paid → evidence-only
- ❌ LiteLLM proxy routing
- ❌ Zero retries per provider + cooldown (60s)
- ❌ Cascade: rules → Speed Gate → evidence-only → reasoning → escalation

### Security & Privacy (§25)
- ✅ API keys in `.env` (not in code)
- ❌ TLS 1.3 + internal mTLS
- ❌ Keycloak OIDC
- ❌ Vault for secrets
- ❌ Presidio PII redaction
- ❌ Audit logs
- ❌ Single Role Model (public, consumer, business, laboratory, content_admin, auditor, super_admin)

### Evaluation Strategy (§28)
- ❌ Gated metrics (false-standard rate = 0, citation validity = 100%, etc.)
- ❌ 13 eval suites (~360 pilot cases)
- ❌ Quality page with latest measured values
- ❌ Playwright E2E tests
- ❌ axe-core accessibility audits
- ❌ Visual regression on design-system primitives

---

## Implementation Priority Order

### Phase 1 & 2 — Foundation & UI/UX Revamp Complete ✅
1. ✅ L0 Source Registry + seeded data
2. ✅ L1 Language Gateway (LID, Hinglish, Terminology Lock)
3. ✅ L2 Outdated-Reference Checker
4. ✅ L4 Basic retrieval + applicability + pgvector hybrid search
5. ✅ L5 7 Specialist Agents + Orchestrator + SSE
6. ✅ L6 Basic guardrails + Hallucination prevention
7. ✅ XL Distinct Landing Page Revamp (Centered hero, horizontal Evidence Strip, clean 2×3 What Can BISVEDA Do grid, 4-step ASK→IDENTIFY→VERIFY→ACT workflow band, 65/35 asymmetric Recent Research & Latest BIS Updates)
8. ✅ XL 3-Column Research Workspace (LEFT: Workspace Context | CENTER: Conversational Research + Leaflet Lab Map | RIGHT: Verified BIS Sources)
9. ✅ XL Dynamic Product Specification Refinements (Contextual pills rendered ONLY when query pertains to configurable products; hidden on operational, lab, fee, or statutory queries)
10. ✅ XL Product Photo Verification Modal with interactive Leaflet OpenStreetMap location preview box alongside accredited testing laboratories
11. ✅ L2 Real PDF document ingestion with SHA-256 deduplication, chunking, MinIO persistence, and pgvector embeddings
12. ✅ XL Lab Locator with interactive nationwide Leaflet OpenStreetMap facility mapping
13. ✅ XL Testing Locator (`/testing`) — Embedded interactive Leaflet OpenStreetMap preview with genuine Haversine distance calculations (fixed `lat`/`lng` mapping, 2-digit regional PIN prefix resolution, accurate city coordinates)
14. ✅ XL Certification Pathway Dashboard (`/certification`) — Redesigned into intuitive user modules: 5-step sequential pathway bar (`01` $\to$ `05`), 6-card "What are you looking for?" dashboard, interactive 3-step decision tree (Origin $\to$ Category $\to$ Statutory Scheme & MSME 80% subsidy calculator), and live product-to-standard retrieval search with popular suggestion chips
15. ✅ L1/L4 Core Conversational Layer — Universal conversational handling across all query types: fast-path greetings & small talk, instant speed-gate for exact standards/licences/regulatory FAQs (e.g. Scheme-I vs Scheme-II, FMCS, QCOs, Manak Online), broad catalog search & recommendation, multi-turn follow-up context memory (e.g. helmet testing in Pune $\to$ ARAI), cross-standard chunk leakage elimination in pgvector retrieval, and LLM-powered open inquiry synthesis with Gemini Flash Lite & Groq

---

## Progress Summary

| Layer | Total Items | Done | Partial | Not Started |
|-------|------------|------|---------|-------------|
| L0 — Governance | 30 | 8 | 2 | 20 |
| L1 — Gateway | 30 | 7 | 2 | 21 |
| L2 — Ingestion | 22 | 5 | 0 | 17 |
| L3 — Storage | 17 | 4 | 1 | 12 |
| L4 — Query & Adjudication | 28 | 9 | 2 | 17 |
| L5 — Orchestrator | 25 | 16 | 2 | 7 |
| L6 — Trust Gate | 18 | 7 | 1 | 10 |
| L7 — Operations | 15 | 2 | 0 | 13 |
| XL — Experience | 68 | 45 | 4 | 19 |
| Cross-Cutting | 40 | 8 | 3 | 29 |
| **Total** | **~293** | **~111** | **~17** | **~165** |

> **~40% complete & fully functional prototype.** The BISVEDA V8 consumer/business product revamp is live with a distinct landing page (centered hero, horizontal evidence strip, 2×3 services grid, 4-step workflow, asymmetric 65/35 research/updates), conversational research flow with dynamic, query-relevant product specification refinements, an interactive 3-column workspace with nationwide Leaflet OpenStreetMap testing lab geolocation, and multimodal product packaging inspection under the Ministry of Consumer Affairs, Food & Public Distribution and Bureau of Indian Standards identity.
