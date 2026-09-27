# BISVEDA — V8 Research Report
### Competitor research, UI/UX research, and the V7 → V8 brainstorm

**Problem Statement:** SIH26107 · **Team:** fsociety · **Baseline:** BISVEDA V7 + V7 Decision Log
**Companion documents:** `BISVEDA_Architecture_V8.md` (full architecture) · `BISVEDA_V8_Prototype.md` (MVP + build plan) · `BISVEDA_V8_Antigravity_Prompt.md` (agent-team build prompt)

---

## 0. Method

1. Re-read the evolution chain: Problem Statement → V6 → Decision Log (D1–D34) → V7.
2. Unpacked all 11 repositories supplied in `D:\BIS VEDA\repos` and triaged each one (README, tree, stack, whether the pipeline is real or simulated). Went deep only where a repository contained a real, working idea.
3. Identified the UI/UX reference: **`https://bis-standards-client.vercel.app` is the production deployment of `BIS-master` ("BIS Standards Navigator")** — confirmed by `BIS-master/README.md` ("Live deployment: bis-standards-client.vercel.app") and `PRODUCTION_AUDIT.md` ("production alias `bis-standards-client.vercel.app`").
4. UI evidence came from the repository's six production screenshots (captured 2026-09-17 against the live instance), its UI/UX design docs (`docs/ui/*`), and its component source. Every UI finding below is labelled **Observed** (seen in a screenshot), **Partially observed** (present in source code, not visible in a screenshot) or **Inferred** (a potential we derive, not something the repo has).
5. Compared every candidate idea against the V7 decision that covers the same ground, before classifying it.

Nothing from any repository is copied. Where an idea is adopted, BISVEDA gets its own implementation.

---

## 1. The evolution chain in one page

| Stage | What it established | Why it changed next |
|---|---|---|
| **V6** | Governed, text-first RAG platform: L0 source governance with an honest **phased acquisition plan**, PostgreSQL unified store, Speed Gate, 4-level never-empty retrieval cascade, 8 bounded agents under LangGraph, deterministic eligibility engine, 3-tier Trust Gate, governed feedback loop. Cloud LLM (GPT-4o) primary. | Sovereignty (cloud-primary LLM can't run air-gapped), mentors asked for Form I, no multimodal input, assumed BIS verification APIs that do not exist. |
| **Decision Log (D1–D34)** | Every technology justified against alternatives, with a consistent bias: **self-hostable over SaaS** (D2, D7, D12, D14, D26, D28), **deterministic over LLM wherever the answer is a legal fact** (D11, D19, D20, D30), **structural defences over prompt-only defences** (D31, D32, D34). | — |
| **V7** | Local-first Qwen2.5-7B AWQ (D8/D29), multimodal intake + VLM + pyzbar + ClamAV (D9/D23/D24), document authenticity + clause-level gold diffing + wrong-document detection (D31), statutory Form I draft + Manak Online crosswalk (D20/D22, axiom A12), Exact-First identifier policy (D30), Multi-Task Planner (D33), Context Resolver (D34), Language Capability Registry, Knowledge Refresh Manager, full DDL. | See §3 — internal inconsistencies, unmeasured claims, and a data-acquisition gap. |

---

## 2. What V7 already does well (keep)

These survive into V8 unchanged in intent, because competitor research confirmed rather than challenged them:

- **Evidence before generation (A1)** and **never return nothing (A2).** Every serious competitor (BIS-master, Hackathon-2026, SIH2026-PS-107) converged on the same principle; the weak ones (pramaan's simulation, SIH2026-main) are exactly the ones that lack it.
- **PostgreSQL as the single multi-model store (D1–D5).** BIS-master, Hackathon-2026, ManakAI and sih-26107 all independently landed on Postgres + pgvector + FTS. Nobody who split into Qdrant/Chroma gained anything visible.
- **Exact-First identifier policy (D30).** BIS-master has the same "exact IS number → deterministic fast path, no LLM" rule and measured it as a reliability win.
- **Deterministic orchestrator with bounded agents (D11)** and **deterministic eligibility/QCO logic.** Competitors that let the LLM decide mandatory-vs-voluntary (SIH2026-PS-107) were caught fabricating QCO citations in their own red-team report.
- **Terminology Lock**, **XML sandboxing of untrusted extractions (D32)**, **Form I as draft + portal handoff (D20)** — no competitor has anything comparable; these are BISVEDA differentiators.
- **Honest boundaries** (no BIS verification APIs, no official submission, not a certification authority).

---

## 3. V7 defects found during the review (fix in V8)

| # | Defect | Where | V8 resolution |
|---|---|---|---|
| 1 | Two contradictory GPU plans: separate ~16 GB GPUs for LLM and VLM (§16.5) vs both AWQ models sharing GPU 1 at `utilization=0.42` (§22.3, D29). | V7 §16.5 vs §22.3 | Collapsed by moving to one natively multimodal model family (V8 §22); one allocation table. |
| 2 | Count drift: eval suite 6,550 (§28.2) vs "5,800+" (§12.7, §33); decisions 34 (log) vs 29 (§30) vs "28" (§33); diagram shows 3 of 9 agents; Agent 4 points to "§10.12 Eligibility" which is Conflict Resolution. | V7 multiple | V8 has a single numbered registry for agents, decisions and eval suites, and cross-references are by ID, not section number. |
| 3 | RBAC roles: 7 roles (§6.2) vs Admin/Operator/User (§12.5, §25.1). | V7 | One role model (V8 §25.2). |
| 4 | Celery rejected in D15 but "Temporal.io / Celery worker mesh" in §7.1; priority queue in Redis vs Temporal task queues. | V7 §7.1 | Temporal only in production; prototype uses an in-process job runner with the same job contract (V8 §7.1). |
| 5 | **A6 violations** — numbers stated as achieved with no measurement: intent classifier Macro-F1 > 0.92 on a "15,000-query" dataset that does not exist, Surya 98.5 % Devanagari accuracy, 2.5 s total pipeline budget (while Flow B says ~4 s), `>0.82` cross-lingual cosine. | D6, D8, D10, D19 | Every metric in V8 is tagged **Target** or **Measured (date, eval suite ID)**. No "Measured" value exists until the prototype produces it. |
| 6 | **Gold diffing is circular.** It needs a canonical full-text master of every standard, which requires exactly the BIS MOU that V6 marked High-risk. V7 also thinned V6's phased acquisition plan. | D31, V7 §5.3 | Knowledge Tiering (V8 §5.3): gold diffing applies only to Tier C (licensed full text). Tiers A/B use provenance + checksum + source-URL allowlist + wrong-document detection. |
| 7 | DistilBERT intent classifier (D19) presupposes a labelled dataset that can only come from production traffic. | D19 | Staged router (V8 §9.1): deterministic rules → small-LLM JSON classifier → distilled classifier once feedback data exists. |
| 8 | Model generation is dated: Qwen2.5-7B / Qwen2.5-VL-7B / "Claude 3.5" chosen ~a year ago. The Qwen3.5 family (Feb 2026, Apache-2.0) ships small dense models with native vision, e.g. 9B. | D8, D9 | Role-based Model Registry (V8 §22.1); defaults re-picked and **eval-gated**, never hard-wired. |
| 9 | "Template responses" as the final LLM fallback is under-specified. | V7 §12.9 | First-class **Evidence-Only Answer Mode** (V8 §10.3) — adopted from BIS-master. |
| 10 | SSE "status spinners" promised, but no contract saying progress events must correspond to real pipeline stages. | D21 | Stage-Event Contract (V8 §10.1.2): the UI may only show a stage the orchestrator actually emitted. |

---

## 4. Repository triage

| Repo (zip) | Product name | Stack | Real or simulated | Value | Verdict |
|---|---|---|---|---|---|
| **BIS-master** | BIS Standards Navigator — **the UI/UX reference (live at bis-standards-client.vercel.app)** | Next.js 16, TS, Postgres+pgvector (Neon), Drizzle, Vercel AI SDK, Leaflet, Vitest+Playwright+axe | **Real**, live, 618 tests; corpus is small (≈19–51 standards, 4 documents, 430 geocoded labs) | ★★★★★ UI/UX · ★★★★ engine discipline | Deep-dived |
| **Hackathon-2026** | BIS Sahayak | FastAPI, Supabase pgvector+FTS, Groq (gpt-oss-120b / qwen3.8-27b), Jina v3 embeddings, Next.js | **Real**; the only repo with a large real corpus: 6,209 catalogue entries, 790 chunks, 790 labs, 223 FAQs | ★★★★★ data acquisition · ★★★★ guardrails | Deep-dived |
| **pramaan** | PRAMAAN | Next.js 16 front-end only | **Simulated** — keyword `if/else` product extraction, `mockKnowledgeBase.ts`, fake pipeline progress; production stack is described but not built | ★★★ product narrative · ★ engineering | Architecture on paper is close to ours but weaker than V7; product-journey ideas extracted |
| **sih-26107** | BIS Saarthi (Hexaminds) | Turborepo, Next.js 14, NestJS, Prisma, pgvector | Partially real; 2,310-line "22-language translator" is a static phrase dictionary | ★★ | Skimmed |
| **SIH2026-PS-107** | e-BIS Sahayak | Next.js 14, FastAPI, Qdrant, Groq | Real; ships its own **"Brutal QA" red-team report (241 tests, 66 % pass)** | ★★★ (the QA report, the pre-retrieval branches) | Skimmed |
| **SIH26107** | ManakAI (manakai-delta.vercel.app) | Vanilla JS + Tailwind CDN, FastAPI, Supabase, Firebase Auth, Groq, Bhashini | Real; verification service is regex shape-check + optional BIS Care URL (no public API exists) | ★★ (Bhashini smoke test, consumer/MSME modes) | Skimmed |
| **BIS-agent** | — | Vite React, SQLite + ChromaDB, Gemini | Real but tiny (26 standards) | ★★ | Skimmed |
| **SIH-108** | BIS SmartSpec AI (**different PS: SIH26108**, procurement) | FastAPI, ChromaDB MiniLM, BM25, Next.js | Real | ★★ (outdated-reference checker, allied-standards graph) | Skimmed |
| **SIH2026-main** | BIS Standards RAG Assistant | FastAPI, Supabase, Redis, Gemini, Vite | Real, thin; unsupported marketing claims ("95 %+ citation accuracy") | ★ | Rejected |
| **BIS-Saathi** | BIS Saathi | README only | No code | — | Rejected |
| **111111** | BIS Sahayak | Empty Next.js scaffold (no `src/`) | No code | — | Rejected |

---

## 5. Deep dives

### 5.1 BIS-master (BIS Standards Navigator) — the strongest engine discipline

**Architecture.** One Next.js deployable (UI + API routes). Pipeline: normalization → identifier resolution (exact ID ⇒ deterministic fast path) → intent extraction (LLM or deterministic keyword fallback) → hybrid retrieval (pgvector HNSW + Postgres FTS → RRF) → in-repo diversity reranker → **evidence aggregation per standard** (resists "many chunks from one doc" bias) → **coverage analysis** (product / material / use-case / testing / certification / identifier) → **conflict/version detection** → **relevance floor** (`0.45`, calibrated on in/out-of-corpus queries) → **deterministic grounding** (`verified` / `supported_inference` / `insufficient_evidence`) → deterministic confidence → LLM prose → standard-number + citation validation.

**The idea that matters most:** *the LLM's response schema has no field for the grounding state, the confidence score, or citation identity, so it physically cannot override them.* This is a stronger formulation of V7's A1 axiom: V7 validates after generation; BIS-master makes the dangerous fields un-writable by the model.

**Other real ideas:** provider chain `local → free cloud → paid → evidence-only`, zero retries per provider, 60 s cooldown on failure; `LLM_PROVIDER=none` still produces a useful evidence-only answer; fixed refusal text that **names the corpus boundary**; feedback intake with a human `promote/reject` CLI; axe-core accessibility tests in CI; honest status docs (`PROJECT_STATUS.md`, measured numbers with dates).

**Weaknesses:** tiny corpus (the evidence engine has little to be rigorous about); in-repo reranker is heuristic; a single blocking request means no real progress signal; branding imitates BIS's official identity closely (emblem, "© 2026 Bureau of Indian Standards") — we must not copy that.

### 5.2 Hackathon-2026 (BIS Sahayak) — the strongest data acquisition

- **Real corpus through BIS's own portal endpoints** (`standards.bis.gov.in`, `lims.bis.gov.in`, `bis.gov.in` What's New, QCO pages, hallmarking pages), throttled to 1 req/s and cached on disk so re-runs are free and crashes lose nothing. Documents the undocumented traps (endpoints that silently return 10 rows, page caps of 100, case-inconsistent IS numbers, encrypted committee IDs, links that redirect to the homepage, typos in lab lists). Also found **official Hindi titles** in the catalogue and per-standard lab/licence-holder endpoints.
- **Self-verifying taxonomy:** 25 priority product groups mapped to 82 sectional committees; ingestion **fails loudly** if a group's committees don't contain its known-important IS numbers. It caught real surprises (helmets IS 4151 under CED 22 "Fire Fighting", electric toys under ETD 32).
- **Honest corpus scope:** catalogue metadata for 6,209 standards (enough for *which standard applies?*), full text only for public documents (schemes, QCOs, hallmarking regulations, FAQs). Never invents clause text for a metadata-only standard.
- **Citation guard:** `[S1]` markers are parsed and any marker that does not resolve to a retrieved passage is stripped; handles full-width brackets (`【S1】`) that silently broke validation.
- **Translation refused if a citation marker does not survive translation.**
- **User context is never evidence:** inferred business context and attached documents sit *outside* the `SOURCES` block, so they can shape an answer but can never be cited as BIS.
- Verbatim FAQ fast path (223 official FAQs), answer cache, follow-up suggestions, compliance roadmap with tickable steps, BIS Updates feed grouped by week, document vault with expiry warnings.
- **Weakness vs V7:** LLM used as reranker (a trained cross-encoder is better and cheaper — V7 D7 stands); hosted-API-only stack (no sovereignty path).

### 5.3 pramaan — similar on paper, simulated in code

Its stated pipeline (Understand → Retrieve → Rerank → Generate → Cite & Guard → Deliver; Qdrant + BM25, bge-reranker-large, abstain below 0.45, Llama-Guard) is a subset of V7. The implementation is a front-end simulation: product attributes come from `if (query.includes('cooker'))`, results come from a mock knowledge base, and the pipeline stepper animates stages that never ran. Several clause-level test values in its data should be treated as unverified.

**What is worth taking is the product narrative, not the engineering:**
- the **connected 10-step compliance journey** for one flagship query (understanding → standard → applicability → certification → tests → labs → evidence → confidence → next action);
- **"Explain Simply"** — a plain-language rendering of a standard for non-experts;
- **VERIFIED vs DEMO DATA** badges on every record;
- a consumer **Mark Verifier** screen (ISI CM/L and HUID).

### 5.4 Others — single ideas worth noting

- **SIH2026-PS-107:** pre-retrieval branching (greeting / help / clarification-required / out-of-scope bypass RAG entirely); numbered clarification chips; and its own red-team report, whose failure categories (gibberish strings retrieving IS 1293, fictional products getting fabricated citations, naive query-rewrite concatenation producing `"3 - What documents do I need?"`, topic-switch leakage) are an excellent adversarial eval template.
- **SIH-108 (different PS):** "outdated reference checker" — detects edition years cited in an uploaded document and flags superseded editions; allied-standards (normative reference) graph.
- **ManakAI:** Consumer vs Industry/MSME modes; Bhashini smoke-test script; deterministic identifier shape validation before any lookup.
- **sih-26107:** clean monorepo separation (`packages/ai`, `packages/ui`, `packages/api-client`) — but its "22-language translator" is a static phrase table, which is the failure mode V7's Language Capability Registry exists to prevent.

---

## 6. UI/UX research — BIS-master (bis-standards-client.vercel.app)

Treated as an idea library. **Observed** = visible in a production screenshot; **Partially observed** = in component source, not visible in a screenshot; **Inferred** = a potential we propose.

### 6.1 Characteristic catalogue

| # | Characteristic | Status | What it is | Why it works | BISVEDA improvement |
|---|---|---|---|---|---|
| U1 | **Institutional visual language** | Observed | White/light-neutral surfaces, navy primary, one warm accent (orange headline words), thin borders, modest shadows, generous whitespace; utility bar with *Skip to main content*, *Screen Reader Access*, language selector, theme toggle. | Reads as a credible public service rather than an "AI toy"; trust is the product. | Own palette/identity for BISVEDA (not BIS's logo/emblem); keep the restraint; add a Hindi-first toggle in the utility bar. |
| U2 | **Search-first hero** | Observed | One large input ("Describe your product, process or compliance question…"), mic button, language chip, *Popular searches* chips, a secondary *Check Your Certification Route · Interactive Wizard* entry. | The core task is discovery, not chat; the hero teaches what to ask. | Hero also accepts image and document drops (V8 multimodal) and shows a rotating example per user mode (Consumer / MSME / Student). |
| U3 | **Service cards** ("How can we help you today?") | Observed | Find Applicable Standards, Certification Routes, Testing Requirements, Compare Standards. | Task-language navigation for low-literacy users. | Add Consumer Verify, Hallmarking, Labs, Form I Prep; each card deep-links into the same research workspace with a pre-set intent. |
| U4 | **"What's New" rail with typed badges** | Observed | Standard cards with IS number, title, category, `Scheme-I (ISI)` tag, `Mandatory QCO · Active` status. | Live signal that the knowledge base is current. | Fed by the real BIS What's New connector (Hackathon-2026's idea) with provenance links. |
| U5 | **Three-panel research workspace** | Observed | Left *Sources* (search BIS sources + research summary + grounding badge + technical details disclosure); centre *BIS Research* (recommendation + follow-up thread); right *Workspace* (Product Compliance Map with tabs *Certification / Testing / Labs* + *Recent searches*). Collapsible panels, resize handles. | Keeps evidence one glance away without a chat transcript; the reader can work, not just read. | Centre panel renders BISVEDA's **Compliance Dossier** (V8 §10.1.3) instead of prose; stages stream in as they complete. On mobile: tabbed panels. |
| U6 | **Honest grounding badges** | Observed | `Partially supported` badge + plain explanation naming the corpus boundary; *No standard meets the applicability bar for this query.* | Makes abstention a first-class, trustworthy outcome. | Badge driven by V8's deterministic grounding state; always pairs with the *next honest action* (clarify / official channel). |
| U7 | **Refinement chips** | Observed | "Recommended specifications for Stainless steel water bottles": `+ Stainless Steel (Grade 304)`, `+ Vacuum Insulated Flask`, `+ Single Wall Bottle`, `+ Food Grade 316`. | Clarification without a wall of questions; one tap narrows the search. | Chips are generated from V8's taxonomy *missing attributes* (deterministic), not from an LLM guess; an *Active parameters* row shows what has been applied and can be undone. |
| U8 | **Standard Passport** | Observed | Register-style record: breadcrumb, record ID, huge monospaced IS number, title, `VERIFIED RECORD` pill, "Full-Text Evidence Indexed (10 passages)", a 6-cell fact grid (Standard No., Category, Edition Year, Regulatory Status, Certification, Issuing Authority), numbered sections (01 Scope, 02 Regulatory Context…), side *Standard Actions* (Ask in Chat, Add to Comparison Matrix, Official Gazette Link), Related Standards. | A standard becomes an inspectable object, not a paragraph. Unknown fields are shown as *unknown*, not invented. | Add amendment timeline (from V7's graph), QCO block, lab count, *knowledge tier* badge (metadata-only vs full text), and a **plain-language summary** toggle (pramaan's "Explain Simply", labelled AI interpretation). |
| U9 | **Real laboratory map** | Observed | Leaflet/OSM map with pins for 430 geocoded labs; List/Map toggle; labs with no resolvable location are listed but never plotted at a guessed point. | Visual proof of coverage; honest about missing geodata. | PostGIS distance sort from user PIN code; clustering; filter by IS scope + validity; AHC layer for hallmarking. |
| U10 | **Certification hub with numbered pathway** | Observed | Hero with three CTAs (Wizard / Find a Scheme / Explore Process) and a 01–05 pathway strip (Determine route → Find scheme → Check requirements → Understand testing → Proceed to BIS service). | Turns a regulatory maze into five steps. | Each step bound to BISVEDA's deterministic eligibility engine; progress tickable and saved per session (Hackathon-2026 roadmap idea). |
| U11 | **Interactive scheme decision tree (wizard)** | Partially observed | `SchemeDecisionTree.tsx` + tests. | Guided mode for low digital literacy (V6/V7 "Simple Mode"). | Wizard answers feed the same Eligibility Engine as chat — one logic, two surfaces. |
| U12 | **Floating site-wide assistant, separate from the page thread** | Observed | Bottom-right bubble opens *Discuss these results*; *Referenced standards* chips at the end of an answer; timestamp. Two independent conversation instances by design. | Page-scoped research and general questions don't pollute each other. | Keep the separation; the widget can "pull in" the current page scope with one explicit tap. |
| U13 | **Search overlay** | Partially observed | Global search (header icon) with *Try asking* suggestions and *Browse by section*. | Fast navigation for returning users. | Add keyboard shortcut and exact-ID jump (`IS 456` → passport directly). |
| U14 | **Why panel with progressive disclosure** | Partially observed | Level 1 plain reason always visible; levels 2–4 (matched attributes, clause, document) behind a disclosure; AI reasoning and official source shown side by side. | Novices aren't buried; experts are one click from the clause. | Same structure, fed by the Evidence Package; each level shows its evidence class. |
| U15 | **Provenance tags that don't rely on colour** | Partially observed | Official = solid filled tag; AI interpretation = outlined; inference = dashed; user-provided = neutral. | Colour-blind users can still tell official text from AI text — the one distinction that must never be ambiguous. | Adopt as a design-system primitive for every claim, citation and card. |
| U16 | **Evidence-oriented confidence wording** | Partially observed | `Verified evidence` / `Partially supported` / `Limited evidence` / `No verified evidence` — never raw percentages. | Avoids false precision (our A6). | Adopt verbatim as the label set for V8's grounding states. |
| U17 | **Coverage panel** | Partially observed | Shows which dimensions (material, intended use, testing, certification, identifier) the evidence covers; unknown dimensions omitted rather than shown as false negatives. | Explains *why* a standard is only partially applicable. | Driven by V8's Coverage Analyzer. |
| U18 | **Conflict panel** | Partially observed | "Multiple editions retrieved", "Possibly superseded standard", "Conflicting evidence" — copy never escalates beyond what the engine asserts. | Honest version handling. | Wired to V7's amendment graph + Conflict Resolution Skill. |
| U19 | **Applicability classes on recommendation cards** | Partially observed | Directly applicable / Potentially applicable / Related standard / Related — material mismatch / Scope unclear / Insufficient evidence / Not applicable. | Richer and more honest than a ranked list. | Adopt as V8's applicability enum. |
| U20 | **Typed feedback control** | Partially observed | Reasons: wrong standard, wrong applicability, missing evidence, poor explanation, outdated information; "It will be reviewed before it affects future results." | Intake-only honesty; feeds a governed loop. | Adopt as V7 §18's feedback taxonomy. |
| U21 | **Honest loading state** | Partially observed | Single `role="status"` line; deliberately **no** fake multi-stage progress because the API is one blocking call. | Refuses to fake progress. | **Improve:** BISVEDA streams *real* stage events over SSE, so we can show a true stage list (pramaan's stepper idea, made honest). |
| U22 | **Voice input with graceful fallback** | Partially observed | Web Speech API; on browsers that can never support it, switches to server transcription for the session; language selector for voice. | Works across browsers without a broken mic button. | Server path = Bhashini ASR / IndicConformer; confidence gate from V7. |
| U23 | **Read-aloud in the answer's actual language** | Partially observed | TTS uses `answerLanguage`, never a mismatched voice. | Small detail that prevents a jarring failure. | Adopt. |
| U24 | **Document workspace** | Partially observed | Upload PDF/text; the Indian Standards it cites become the assistant's scope; file text never sent to a model. | Privacy-preserving document-grounded research. | Extend with the outdated-reference checker (SIH-108) and V7's multimodal extraction, behind explicit consent. |
| U25 | **Empty / error states with a next action** | Partially observed | Distinguishes API failure, retrieval failure, AI unavailable, source unavailable, validation error; "This is not a relevant BIS search — Try instead: …". | Every screen has a next action. | Adopt as design rule. |
| U26 | **Accessibility engineering** | Partially observed | Skip link, screen-reader access link, reduced-motion respected, axe-core Playwright suite, `role="status"` live regions. | WCAG 2.1 AA as architecture (our A9). | Adopt the test suite in CI. |
| U27 | **Motion** | Partially observed | Mostly `transition-colors`/`transition-all`, a few `animate-in`/`duration-300`, one spin, one pulse, one ping, one bounce; `prefers-reduced-motion` honoured. No elaborate animation observable. | Restraint suits an official service. | Keep subtle; add meaningful motion only where it carries information (stage completion ticks, dossier sections sliding in as evidence arrives). |
| U28 | **Stage-by-stage ingestion progress for admins** | Inferred | BIS-master has no ingestion UI; Hackathon-2026 has none; pramaan's `/admin` ETL dashboard is simulated. | The PS values document/knowledge ingestion; judges will want to *see* it. | BISVEDA Admin **Ingestion Console**: per-document stage timeline (upload → scan → identity check → parse/OCR → chunk → embed → index → review → publish) driven by real job events. |

### 6.2 UI/UX principles to carry into BISVEDA (from BIS-master's own doc, restated as BISVEDA rules)

Service before AI · Evidence before confidence · Search before conversation · Clarify instead of hallucinating · Explain every recommendation · Separate fact from inference · Progressive disclosure · Never overclaim certification · Every screen has a next action · Never fake progress · Never communicate meaning by colour alone.

### 6.3 Do not copy

BIS's logo, national emblem usage, "© Bureau of Indian Standards" footer, the BIS-master component code, its exact layouts and copy. BISVEDA gets its own identity (name, mark, palette variant) and its own implementation of each characteristic.

---

## 7. Idea classification

| Idea | Source | Class | V7 counterpart | V8 location | Prototype / Production |
|---|---|---|---|---|---|
| LLM output schema has no field for grounding state, confidence, or citation identity | BIS-master | **ADOPT** | A1 + L6 validation after the fact | §10.2 Generation Contract | Both |
| Deterministic Evidence Adjudicator (aggregation → coverage → conflict → relevance floor → grounding state → confidence) *before* any LLM call | BIS-master | **ADOPT** | Spread across L4/L6 | §9.8 new stage | Both |
| Calibrated relevance floor with a named-boundary refusal | BIS-master, PS-107 | **ADOPT** | Cascade level 4 | §9.6 | Both |
| Provider chain local → cloud → evidence-only, no retries, cooldown | BIS-master | **ADAPT** (inside LiteLLM + our breaker) | D12, §12.9 | §22.2 | Both |
| Evidence-only answer mode (`LLM_PROVIDER=none`) | BIS-master | **ADOPT** | "Template responses" | §10.3 | Both |
| `[S#]` marker validation + full-width bracket normalisation + strip unresolved | Hackathon-2026 | **ADOPT** | Fake Citation Detector | §11.1 | Both |
| Refuse translation if citation markers don't survive | Hackathon-2026 | **ADOPT** | Terminology Lock | §6.5 | Both |
| User context and uploads kept outside the SOURCES block (never citable) | Hackathon-2026 | **ADOPT** | D32 sandboxing (visual only) | §10.2, §11.5 generalised | Both |
| BIS portal catalogue connector (throttled, disk-cached, trap-aware) + official Hindi titles | Hackathon-2026 | **ADOPT** | L0 connectors (unspecified) | §5.4 | Both |
| Self-verifying product-group ↔ committee taxonomy | Hackathon-2026 | **ADOPT** | Product Taxonomy | §5.5 | Both |
| Knowledge tiers (metadata / public full text / licensed full text) with per-tier answer capability | Hackathon-2026 + V6 phases | **ADAPT** | V7 §5.3 (thin) | §5.3 | Both |
| Verbatim official-FAQ fast path | Hackathon-2026 | **ADOPT** | Speed Gate FAQ | §6.4 | Both |
| BIS Updates feed (What's New), weekly grouping | Hackathon-2026 | **ADOPT** | Refresh triggers | §17.1, UI §U4 | Both |
| Compliance roadmap with tickable steps | Hackathon-2026 | **ADAPT** | Certification Agent output | §10.1.3 Dossier | Both |
| Document vault with expiry warnings | Hackathon-2026 | **CONSIDER** | — | §34 Future | Production |
| LLM as reranker | Hackathon-2026 | **DO NOT INCLUDE** | D7 cross-encoder | — | — |
| Connected compliance journey for one flagship query | pramaan | **ADAPT** → Compliance Dossier | Multi-Task Planner output | §10.1.3 | Both |
| Explain Simply (plain-language standard summary) | pramaan | **ADAPT** (grounded in scope text, labelled AI interpretation) | — | §10.4 | Both |
| VERIFIED / DEMO DATA record badges | pramaan | **ADOPT** | Governance labels | §5.6 data status | Both |
| Mark Verifier screen | pramaan, ManakAI | **ADAPT** (shape validation + official deep link, never "genuine") | Agent 6 | §10.6 (AG6) | Both |
| Simulated pipeline / mock KB / animated fake stages | pramaan | **DO NOT INCLUDE** | — | — | — |
| Pre-retrieval branches (smalltalk / clarify / out-of-scope / domain) | SIH2026-PS-107 | **ADOPT** | Intent classifier | §9.1 | Both |
| Red-team categories (gibberish, fictional products, topic switch, rewrite corruption) | SIH2026-PS-107 | **ADOPT** | Adversarial probes | §28.3 | Both |
| Outdated-reference checker for uploaded documents | SIH-108 | **ADOPT** | Document Verification | §7.10 | Both |
| Allied / normative-reference graph | SIH-108 | Already in V7 (`:REFERENCES`) | — | §8.3 | Production |
| Consumer / MSME / Student modes | ManakAI, pramaan | **ADAPT** as UI presets over one role model | Business Context Engine | §6.9 | Both |
| Static phrase-dictionary "translator" | sih-26107 | **DO NOT INCLUDE** | Language Capability Registry | — | — |
| Separate Qdrant/Chroma vector DB | pramaan, PS-107, BIS-agent, SIH-108 | **DO NOT INCLUDE** | D1/D2 | — | — |
| Supabase/Firebase-bound auth and storage | Hackathon-2026, ManakAI | **DO NOT INCLUDE** (lock-in, not air-gappable) | D26/D28 | — | — |
| Gamified "compliance score that counts up" | Hackathon-2026 | **CONSIDER** only if the score is a transparent, deterministic checklist ratio | — | §34 | Production |
| Two independent conversation surfaces (page thread vs global widget) | BIS-master | **ADOPT** | Session manager | §6.8 | Both |
| All UI characteristics U1–U28 | BIS-master | ADOPT/ADAPT as listed in §6.1 | D21 | §21 Experience Layer | Both |
| Axe-core accessibility + responsive + visual Playwright suites | BIS-master | **ADOPT** | A9 | §28.4 | Both |
| Honest status doc with dated, measured numbers | BIS-master | **ADOPT** | A6 | §28.5 | Both |

---

## 8. Brainstorm against V7 — significant proposed changes

Each change is given in the required seven-part form.

### C1 — Evidence Adjudicator + un-writable grounding fields
1. **V7:** Retrieval (L4) → agents generate (L5) → Trust Gate validates (L6); confidence partly from NLI after generation.
2. **V6/Decision context:** A1 "evidence before generation"; D25 rejects LLM-as-judge; D11 deterministic orchestration.
3. **Research:** BIS-master computes coverage, conflicts, relevance floor, grounding state and confidence deterministically *before* the LLM, and its LLM schema cannot express them. Measured 0/20 false-standard hallucinations on its golden set.
4. **Change:** Insert an **Evidence Adjudicator** stage (L4, after reranking). Agents receive an *adjudicated* evidence package; the generation schema contains only prose slots and citation markers.
5. **Fits:** L4 §9.8 → L5 §10.2 → L6 §11.
6. **Why:** Moves the most dangerous decision (is this standard applicable?) out of the stochastic component entirely; NLI in L6 becomes a second line, not the first.
7. **Scope:** Prototype and production.

### C2 — Knowledge Tiering replaces "full text or nothing"
1. **V7:** Assumes full standard text for clause answers; gold diffing needs a canonical master.
2. **Context:** V6 §3.3 flagged full-text access as High risk and phased it; V7 thinned this.
3. **Research:** Hackathon-2026 answers "which standard applies?" from catalogue metadata for 6,209 standards and never invents clauses for metadata-only standards.
4. **Change:** Three tiers — **A** catalogue metadata (all standards), **B** full text of public documents (schemes, QCOs, hallmarking regulations, FAQs, consumer guidance, lab directories), **C** licensed full text (MOU). Each chunk and each standard carries its tier; agents' permitted claim types depend on tier; gold diffing is Tier C only.
5. **Fits:** L0 §5.3, L3 schema (`knowledge_tier`), L5 claim policy, L6 check.
6. **Why:** Makes the prototype honest *and* broad on day one, and removes D31's circular dependency.
7. **Scope:** Both.

### C3 — One natively multimodal model family, role-based registry
1. **V7:** Separate Qwen2.5-7B (text) and Qwen2.5-VL-7B (vision) with two contradictory GPU plans.
2. **Context:** D8/D9/D29 chose them for Indic fluency, vLLM compatibility, VRAM fit.
3. **Research:** Qwen3.5 small dense models (e.g. 9B, Apache-2.0, Feb 2026) are natively multimodal; competitors on hosted stacks use gpt-oss-120b / qwen3.8-27b via Groq.
4. **Change:** A **Model Registry** defines *roles* (reasoning, fast/router, vision, embedding, reranker, NLI, ASR, TTS, NMT); defaults: one local multimodal ~9B model for reasoning+vision, a hosted large model as escalation, bge-m3 + bge-reranker-v2-m3 + NLI unchanged. Every default is eval-gated before promotion.
5. **Fits:** §22.
6. **Why:** Halves generative-model serving, resolves the GPU contradiction, keeps swap-ability.
7. **Scope:** Both (prototype runs the registry with cloud defaults + optional local).

### C4 — Staged intent router with pre-retrieval branches
1. **V7:** DistilBERT fine-tuned on a dataset that does not exist (D19).
2. **Context:** D19 rejected zero-shot LLM classification for latency/cost.
3. **Research:** PS-107 branches greeting/help/clarify/out-of-scope before RAG; its red-team shows gibberish reaching retrieval is a real failure; Hackathon-2026 routes with a small fast model (~0.4 s).
4. **Change:** Stage 1 deterministic rules (identifiers, greetings, gibberish, blocked topics) → Stage 2 small-LLM JSON classifier → Stage 3 (production) distilled classifier trained on governed feedback data. D19 is kept as the Stage 3 target.
5. **Fits:** §9.1.
6. **Why:** Correct today, cheaper tomorrow; no fictional dataset.
7. **Scope:** Stages 1–2 prototype; Stage 3 production.

### C5 — Compliance Dossier as the primary answer object
1. **V7:** Output Merger produces a merged prose draft.
2. **Context:** D33 multi-task plan already decomposes the flagship question.
3. **Research:** pramaan's 10-step journey, BIS-master's Product Compliance Map, Hackathon-2026's roadmap — all converge on a structured multi-section answer.
4. **Change:** A typed **Compliance Dossier** (product interpretation, candidate standards with applicability class, QCO status, certification route, tests, labs, next actions, evidence ledger) is the orchestrator's output contract; prose is one field inside it. The UI renders sections as they stream in; the dossier is exportable (PDF) and seeds Form I prep.
5. **Fits:** §10.1.3, §21.
6. **Why:** Directly answers the PS's MSME question in one turn, with evidence per section.
7. **Scope:** Both.

### C6 — Real Stage-Event streaming
1. **V7:** SSE status updates, unspecified.
2. **Context:** D21.
3. **Research:** BIS-master refuses fake progress (correct); pramaan fakes it (wrong).
4. **Change:** The orchestrator emits typed events (`stage.started/completed`, `section.ready`, `clarification.required`, `answer.delta`, `trust.result`); the UI may only render stages it received.
5. **Fits:** §10.1.2.
6. **Why:** Honest *and* rich progress.
7. **Scope:** Both.

### C7 — Citation & translation contract hardening
1. **V7:** Fake-citation detector; Terminology Lock.
2. **Context:** D30, §6.5.
3. **Research:** Hackathon-2026's marker resolution, bracket normalisation, translation refusal.
4. **Change:** `[S#]` markers bound to evidence IDs; unresolved markers stripped; translated output must contain the same marker set and the same locked tokens or the translation is refused and English is shown with a notice.
5. **Fits:** §6.5, §11.1.
6. **Why:** Closes the "looks cited, cites nothing" failure in every language.
7. **Scope:** Both.

### C8 — Evidence classes everywhere (official / user-provided / AI interpretation)
1. **V7:** `<untrusted_visual_extraction>` for images only.
2. **Context:** D32, A11.
3. **Research:** Hackathon-2026 keeps user context outside SOURCES; BIS-master's SourceTag shapes.
4. **Change:** Every piece of context entering a prompt and every claim leaving the system carries an evidence class; only `official_source` can be cited; UI renders class by shape + colour + label.
5. **Fits:** §10.2, §11.5, §21.
6. **Why:** Generalises D32 from images to all untrusted inputs (uploads, business context, voice transcripts).
7. **Scope:** Both.

### C9 — Real acquisition connectors + self-verifying taxonomy
1. **V7:** Connector registry without concrete sources; taxonomy admin-curated.
2. **Context:** V6 §3.3 acquisition phases.
3. **Research:** Hackathon-2026's portal ingesters and committee self-checks.
4. **Change:** Named connectors (catalogue, lab directories, QCO list, What's New, hallmarking pages, scheme pages), throttled/cached, trap-aware; taxonomy seeded from committee mapping with fail-loud invariants.
5. **Fits:** §5.4, §5.5.
6. **Why:** A credible, large, verifiable corpus is the biggest gap between every V7-grade design and a working demo.
7. **Scope:** Both (prototype ingests a scoped set).

### C10 — Ingestion Console with live stage timeline
1. **V7:** Admin console lists capabilities; Temporal UI integration.
2. **Context:** D15, §7.9 approval gate.
3. **Research:** No competitor has a *real* ingestion UI; pramaan's is simulated.
4. **Change:** Per-document job timeline driven by real job events; wrong-document and outdated-reference findings shown inline; approve/reject.
5. **Fits:** §7.11, §12.8.
6. **Why:** Makes the PS's "authorized knowledge sources" requirement visible and demonstrable.
7. **Scope:** Both.

### C11 — Evaluation honesty and red-team suite
1. **V7:** 6,550 cases specified; metrics stated as achieved.
2. **Context:** A6.
3. **Research:** PS-107's brutal QA categories; BIS-master's dated measured numbers.
4. **Change:** Every metric is Target vs Measured; add adversarial categories; publish an in-app **Quality page** with the latest measured run.
5. **Fits:** §28.
6. **Why:** Judges trust measured numbers; A6 becomes real.
7. **Scope:** Both (prototype ships a ~250-case suite).

---

## 9. Summary for the final architecture review

- **Unchanged:** L0–L7 layering; Postgres-unified store; Exact-First; deterministic orchestrator/eligibility/QCO; Trust Gate tiers; Terminology Lock; sandboxing; Form I as draft + handoff; Language Capability Registry; refresh manager; honest boundaries.
- **Changed:** evidence adjudication moved before generation; knowledge tiering; model registry with a multimodal model family; staged intent router; real stage-event streaming; citation/translation contract; evidence classes; RBAC unified; Temporal-only production workflows; all metrics Target vs Measured.
- **Added:** Compliance Dossier; BIS portal connectors + self-verifying taxonomy; FAQ verbatim fast path; Updates feed; Ingestion Console; outdated-reference checker; plain-language summaries; mode presets; red-team eval; Quality page; the BIS-master-inspired experience layer (U1–U28).
- **Rejected:** simulated pipelines and fake progress; LLM-as-reranker; separate vector DBs; Supabase/Firebase lock-in; phrase-dictionary translation; copying BIS branding.

---

## Sources

- Repositories in `D:\BIS VEDA\repos` (11 zips), especially `BIS-master/README.md`, `BIS-master/PRODUCTION_AUDIT.md`, `BIS-master/docs/ui/*`, `BIS-master/docs/screenshots/*`, `Hackathon-2026-main/README.md`, `Hackathon-2026-main/src/bis/guardrails/citations.py`, `pramaan-main/README.md`, `pramaan-main/src/services/queryService.ts`, `SIH2026-PS-107-main/docs/BRUTAL_QA_REPORT.md`.
- Live UI reference: [bis-standards-client.vercel.app](https://bis-standards-client.vercel.app)
- Model landscape: [Qwen 3.5 to 3.8: Alibaba Open-Weights Guide (2026)](https://codersera.com/blog/qwen-3-5-complete-guide-2026/), [Qwen3.5: Towards Native Multimodal Agents](https://qwen.ai/blog?id=qwen3.5), [Qwen/Qwen3.5-27B on Hugging Face](https://huggingface.co/Qwen/Qwen3.5-27B)
- Embeddings landscape: [BentoML — Best Open-Source Embedding Models in 2026](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)