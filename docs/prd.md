# BISVEDA — Product Requirements Document (PRD)

> **Problem Statement ID:** SIH26107
> **Title:** AI-powered Intelligent Assistant for Indian Standards and BIS Services
> **Category:** Software · **Theme:** Smart Automation
> **Organization:** Ministry of Consumer Affairs, Food & Public Distribution
> **Architecture Version:** V8.0

---

## 1. Executive Summary

BISVEDA (बिसवेदा — BIS + Veda, "Knowledge of Standards") is an AI-powered conversational assistant that enables users to obtain accurate, context-aware, and **source-backed** information related to Indian Standards and BIS services through natural language interactions.

The system addresses a critical gap: users — particularly MSMEs, startups, students, and consumers — struggle to identify applicable standards, certification requirements, licensing procedures, testing requirements, and answers to technical queries across thousands of documents, portals, and PDFs.

### 1.1 Key Value Proposition

- **One interface** to navigate thousands of Indian Standards, QCOs, certification schemes, and BIS services
- **Source-backed answers** — every claim traces to an authorized document with clause-level citations
- **Multilingual** — Hindi, English, Hinglish, and 20+ scheduled Indian languages
- **Multimodal** — text, voice, image (packaging/marks), and document upload
- **Honest by design** — never claims more than its knowledge tier supports

---

## 2. Problem Statement

### 2.1 Official Problem (SIH26107)

The Bureau of Indian Standards publishes thousands of Indian Standards and provides services including product certification, hallmarking, laboratory recognition, Standards Clubs, training, consumer affairs, and conformity assessment.

**User pain points:**
- Identifying applicable Indian Standards for products
- Understanding certification requirements and BIS schemes
- Navigating licensing procedures and testing requirements
- Finding related standards and answers to technical queries
- Searching across multiple documents, portals, and PDFs is time-consuming

### 2.2 Expected Solution

An Intelligent Assistant that can:
1. Answer questions related to Indian Standards
2. Recommend applicable standards based on product descriptions
3. Provide guidance on BIS certification schemes
4. Explain certification processes
5. Answer consumer-related queries
6. Guide users regarding hallmarking
7. Suggest relevant testing laboratories
8. Support multilingual interaction

---

## 3. Target Users

| User Segment | Primary Needs | Mode Preset |
|---|---|---|
| **MSMEs & Startups** | Product-to-standard matching, certification route, fee concessions, lab discovery | Business |
| **Manufacturers** | QCO compliance, Form I preparation, testing requirements, certification renewal | Business |
| **Consumers** | ISI mark verification, HUID check, complaint filing, product recall alerts | Consumer |
| **Students & Educators** | Standards education, Standards Clubs, training programs, research | Student |
| **Testing Laboratories** | Accreditation scope, recognized lab lists, standard test requirements | Laboratory |
| **Government Agencies** | Regulatory compliance, QCO monitoring, conformity assessment | Business |
| **BIS Internal Staff** | Knowledge management, document ingestion, taxonomy maintenance | Admin |

---

## 4. Functional Requirements

### 4.1 Core Capabilities

| # | Capability | Description | Priority |
|---|---|---|---|
| F1 | Standards Q&A | Technical, procedural, regulatory questions with clause-level citations | P0 |
| F2 | Product-to-Standard Matching | Recommend standards from product descriptions with applicability classes and rationale | P0 |
| F3 | Certification Guidance | ISI Mark (Scheme-I), CRS (Scheme-II), Scheme-X, FMCS, Hallmarking/HUID, Lab Recognition, FMCS | P0 |
| F4 | QCO Compliance | Mandatory vs voluntary determination from QCO registry (deterministic) | P0 |
| F5 | Consumer Assistance | ISI/CM-L mark verification, HUID checks, complaints, counterfeits, recalls | P0 |
| F6 | Lab & Centre Locator | BIS-recognized labs and AHCs by scope, validity, distance (map view) | P0 |
| F7 | Multilingual Interaction | Text in 20+ languages, voice in Hindi/English/Hinglish | P0 |
| F8 | Image-Based Query | Packaging, labels, marks, hallmarks → candidate entity extraction | P1 |
| F9 | Standards Education | Standards Clubs, training programmes | P1 |
| F10 | Standard Comparison | Revisions, amendments, edition differences | P1 |
| F11 | Document Verification | Authenticity check, wrong-document detection, outdated-reference check | P1 |
| F12 | Form I Preparation | Draft Schedule II Form I + Manak Online crosswalk | P1 |
| F13 | Compliance Dossier | Structured, exportable answer (standard → QCO → certification → tests → labs → actions) | P0 |
| F14 | Plain-Language Summaries | Grounded "explain simply" rendering, labelled AI interpretation | P2 |
| F15 | BIS Updates Feed | New standards, amendments, QCOs, notices from What's New | P2 |
| F16 | Conformity Assessment | FMCS, import inspection, surveillance guidance | P2 |

### 4.2 Non-Functional Requirements

| # | Requirement | Target |
|---|---|---|
| NF1 | Fast path latency (exact-ID / FAQ) | < 200ms (p95) |
| NF2 | First stage event latency | < 300ms (p95) |
| NF3 | Full dossier latency | < 10s (p95) |
| NF4 | Fast-path share | ≥ 40% of queries |
| NF5 | Citation marker validity after Trust Gate | 100% |
| NF6 | False-standard rate | 0 on golden set |
| NF7 | QCO status accuracy | ≥ 0.99 |
| NF8 | Faithfulness (NLI) | ≥ 0.95 |
| NF9 | Accessibility | WCAG 2.1 AA, 0 serious/critical violations |
| NF10 | Candidate recall@5 (product → standard) | ≥ 0.92 |
| NF11 | Marker & lock survival per supported language | ≥ 0.99 |
| NF12 | Deployment modes | Demo, Cloud, NIC Government, Air-Gapped |

---

## 5. User Stories

### 5.1 MSME Journey (Flagship Flow)

> **As an MSME manufacturer**, I want to describe my product in plain language and receive a complete compliance roadmap — applicable standards, mandatory certification requirements, the certification process, test requirements, nearby labs, fees, and next steps — so that I can get BIS certified without hiring a consultant.

**Acceptance:**
- Product description → applicable standards with applicability class and rationale
- QCO mandatory/voluntary determination (deterministic)
- Certification scheme identification with ordered steps
- Fee schedule with MSME concessions
- Nearby labs with scope match and distance
- Exportable Compliance Dossier (PDF)
- Every claim source-backed with `[S#]` citations

### 5.2 Consumer Journey

> **As a consumer**, I want to photograph a product's ISI mark or hallmark and verify whether it appears legitimate, file a complaint, or check for recalls.

**Acceptance:**
- Image → ISI mark / HUID extraction (candidate with confidence)
- Shape validation (deterministic)
- Official verification route (BIS Care app / portal link)
- Clear caveat: "Image analysis cannot confirm authenticity"
- Complaint filing guidance with official links

### 5.3 Student Journey

> **As a student**, I want to search for standards by topic or product category, understand their scope in simple language, and find Standards Clubs and training programs.

### 5.4 Lab Journey

> **As a testing laboratory**, I want to find which standards I can get accredited for, understand the test requirements, and verify my accreditation scope.

---

## 6. MVP Boundary

### 6.1 Phase 0 — Prototype (Current)

**In scope:**
- Tier A (catalogue metadata) for priority product groups + Tier B (public documents)
- Text + image input
- 7 specialist agents (AG1-AG7)
- Research Workspace with 3-panel layout
- Compliance Dossier with all 10 sections
- Evidence Adjudicator (9-step deterministic)
- Speed Gate (exact-ID, FAQ, cache)
- Hybrid retrieval (pgvector + FTS)
- Standard Passport pages
- Lab locator with Leaflet map
- Certification hub with wizard
- Evidence-only fallback mode
- ~360 eval cases across 13 suites

**Out of scope (Phase 1+):**
- Tier C (licensed full text — requires BIS MOU)
- Voice input/output (ASR/TTS)
- WhatsApp channel
- Real-time BIS connector sync
- Form I PDF rendering (WeasyPrint)
- Keycloak authentication
- OpenSearch (only if PG FTS fails)
- Full WCAG 2.1 AA compliance
- Stage-3 distilled classifier

### 6.2 Modular vs Monolithic Decision

**Decision: Modular monolith behind interfaces.**

The prototype is a Next.js monolith where every component sits behind an interface that production replaces without changing callers:

| Component | Prototype | Production |
|---|---|---|
| Job orchestration | In-process runner | Temporal |
| Object storage | Local filesystem | MinIO |
| Session state | In-memory / localStorage | Redis |
| Auth | None / API keys | Keycloak |
| LLM routing | Direct API calls | LiteLLM proxy |
| Graph queries | Recursive CTEs | Apache AGE |
| Search | pg_trgm + tsvector | OpenSearch (if needed) |

This means: **zero rewrite to scale**, only configuration changes and infrastructure additions.

---

## 7. Hybrid RAG Strategy

### 7.1 Architecture Decision

**Decision: Hybrid RAG with deterministic adjudication.**

BISVEDA does not use a simple "embed → retrieve → generate" pipeline. The RAG strategy is:

1. **Exact-First:** Identifier lookups bypass embedding search entirely
2. **Multi-signal retrieval:** Dense (pgvector/bge-m3) + Sparse (BM25/tsvector) + Graph (AGE/CTE) + Structured SQL
3. **RRF Fusion:** Reciprocal Rank Fusion across retrieval signals
4. **Cross-encoder reranking:** bge-reranker-v2-m3 for semantic entailment
5. **Deterministic adjudication:** 9-step Evidence Adjudicator produces applicability, grounding, confidence, citable set **before** any LLM generation
6. **Constrained generation:** LLM fills prose slots only; cannot override adjudicator decisions
7. **Evidence-only fallback:** Renders answers from adjudicated package with zero LLM calls

### 7.2 Why Not Pure Vector RAG?

- BIS has exact identifiers (IS numbers, CM/L, HUID) that must match exactly, not approximately
- Regulatory answers require deterministic QCO lookups, not probabilistic generation
- Standards have graph relationships (supersession, amendments) that vectors don't capture
- Knowledge tiers require different claim policies per evidence piece
- Citation integrity requires deterministic validation, not LLM-generated citations

### 7.3 Knowledge Tier Enforcement

Every evidence piece carries its tier (A/B/C), and the claim policy is enforced end-to-end:
- Adjudicator restricts claims per tier
- Generation Contract limits prose fields per tier
- Trust Gate strips claims that violate tier policy
- UI badges show the tier of each source

---

## 8. Success Metrics

| Metric | Pilot Target | Production Target |
|---|---|---|
| False-standard rate | 0 | 0 |
| Citation marker validity | 100% | 100% |
| Candidate recall@5 (product → standard) | ≥ 0.85 | ≥ 0.92 |
| Out-of-corpus refusal precision/recall | ≥ 0.90 | ≥ 0.95 |
| QCO status accuracy | ≥ 0.98 | ≥ 0.99 |
| Faithfulness (NLI + judge) | ≥ 0.90 | ≥ 0.95 |
| Marker & lock survival per language | ≥ 0.98 | ≥ 0.99 |
| Intent accuracy (Stage 1+2) | ≥ 0.90 | ≥ 0.95 |
| Fast-path share | ≥ 25% | ≥ 40% |
| p95 latency (exact-ID) | < 300ms | < 200ms |
| p95 latency (full dossier) | < 15s | < 10s |
| WCAG violations (axe) | 0 serious/critical | 0 |

---

## 9. Risks & Mitigations

| Risk | Level | Mitigation |
|---|---|---|
| BIS full-text access (Tier C) | **High** | System operates on Tier A + B; Tier C only after MOU |
| BIS portal endpoint stability | Medium | Connector snapshots; freshness warnings; trap detection |
| LLM hallucination of standards | Medium | Adjudicator + candidate-set check + Trust Gate = deterministic safety net |
| Multilingual translation accuracy | Medium | Marker & Lock Survival Contract; auto-downgrade on regression |
| GPU availability for self-hosting | Medium | Provider chain: local → hosted → paid → evidence-only |
| User adoption (complex domain) | Medium | Mode presets; guided wizards; plain-language summaries |

---

## 10. System Boundaries

**BISVEDA IS:**
- An AI guidance and navigation layer over authorized BIS knowledge
- Source-backed, citation-first
- Multilingual, multimodal
- A form *preparation* assistant
- A document *verification* tool

**BISVEDA IS NOT:**
- A replacement for Manak Online (official submission happens there)
- A certification authority (only BIS grants certificates)
- A legal advisor
- A laboratory system or product-testing system
- A counterfeit detector (provides verification guidance only)
- A system that reproduces licensed standard text beyond access rights
