# BISVEDA Architecture Decision Log (V8 Evolution)

**Lineage:** V6 (D1–D22) → V7 (D23–D34) → V8 (D35–D45)  
**Companion Documents:** `BISVEDA_Architecture_V8.md`, `BISVEDA_V8_Prototype.md`, `BISVEDA_V8_Research_Report.md`  
**Governing Axiom:** *Contracts first, deterministic legal facts, measured not claimed.*

---

## Decisions Overview (D1–D34 Summary)

| Range | Context | Key Decisions |
|---|---|---|
| **D1–D5** | Database Strategy | Consolidated Neo4j/MongoDB/Qdrant into unified PostgreSQL 16 (pgvector, PostGIS, pg_trgm, Apache AGE). |
| **D6–D10** | ML & Retrieval | BAAI/bge-m3 embeddings (1024d), BAAI/bge-reranker-v2-m3, local vLLM Qwen2.5-7B AWQ, Docling + Surya OCR. |
| **D11–D15** | Orchestration & Framework | LangGraph state machine (rejected CrewAI/AutoGen), LiteLLM abstraction, Temporal for production workflows. |
| **D16–D22** | Language, Speech & Regulatory | MeitY Bhashini cloud NMT/ASR/TTS with local Indic fallback, Terminology Lock, Schedule II Form I draft with WeasyPrint. |
| **D23–D34** | V7 Multimodal & Trust | Multimodal Input Handler, Document Authenticity Pipeline, Wrong Document Detection, Exact-First Policy (D30), XML sandboxing (D32), Multi-Task Planner (D33). |

---

## V8 Architectural Decisions (D35–D45)

### D35: Evidence Adjudicator Before Generation
- **Decision:** All regulatory determinations (applicability, grounding state, confidence label, QCO status, eligibility, citable set) are evaluated deterministically in L4 *before* the generative LLM is invoked.
- **Rationale:** Competitor research (BIS-master) proved that relying on post-generation LLM self-reporting or asking the model "is this grounded?" leads to subtle regulatory hallucinations. The LLM's output `SlotSchema` physically contains zero fields for applicability or confidence, preventing overrides.
- **Trace:** Axiom A1, Axiom A13, C1.

### D36: Knowledge Tiering (Tiers A, B, C) & Claim Policy
- **Decision:** Every standard, document, and chunk carries a `knowledge_tier`:
  - **Tier A (Catalogue Metadata):** Basic title, scope, number, committee, QCO status. Only identity, description, and "why" claims allowed.
  - **Tier B (Public Official Text):** Schemes, QCO gazette text, FAQs, hallmarking regulations. Paragraph citations allowed.
  - **Tier C (Licensed Full Text):** Detailed technical clauses, numeric limits, test methods. Clause-level citations allowed.
- **Rationale:** Resolves V6 acquisition risk and circular gold-diff assumptions. If we only have catalogue metadata for a standard, the system must never invent test values or pretend to possess full-text clauses.
- **Trace:** Axiom A14, C2.

### D37: Compliance Dossier as Unified Output Contract
- **Decision:** For any business, manufacturer, or product inquiry, the orchestrator outputs a structured **Compliance Dossier** (interpretation, standards, regulatory QCO, certification route, testing, labs, next actions, evidence ledger, trust).
- **Rationale:** MSMEs and startups do not want a wall of chat prose. They need an actionable, structured compliance dossier that can be exported to PDF and used to seed Form I filing.
- **Trace:** Problem Statement (MSME journey), C5.

### D38: Real Stage-Event Streaming Contract
- **Decision:** Streaming Server-Sent Events (SSE) emit `stage.started` and `stage.completed` strictly when backend nodes execute.
- **Rationale:** Rejects the cosmetic "fake progress" anti-pattern observed in prototype simulations (e.g. pramaan). Clients render stages only when real stage events arrive.
- **Trace:** Axiom A16, C6.

### D39: Citation Marker & Translation Survival Contract
- **Decision:** Every citable item uses `[S#]` tags. Translation pipelines must preserve these markers. If translation drops or corrupts a citation marker, the system falls back to English with an explicit notice.
- **Rationale:** Ensures legal traceability across Indic languages.
- **Trace:** Axiom A6, C7.

### D40: Concrete Model Selections (M0 Open Choices)
- **Hosted Reasoning Role (Primary):** `groq/llama-3.3-70b-versatile` (primary low-latency hosted model) with `openai/gpt-4o-mini` and `gemini/gemini-1.5-flash` via LiteLLM as fallbacks.
- **Hosted Router Role (Fast):** `groq/llama-3.1-8b-instant` or `groq/qwen-2.5-32b`.
- **Hosted Vision Role:** `gemini/gemini-1.5-flash` or `groq/llama-3.2-11b-vision-preview`.
- **Local Fallback Role:** `ollama/qwen2.5:7b` (verified lightweight open-weight model).
- **Terminal Fallback:** Evidence-Only Answer Mode (`GENERATION=none`), requiring zero LLM inference.
- **Trace:** V8 §22.1, Prototype §8.

### D41: OCR Strategy for Scanned Pages
- **Decision:** PyMuPDF (`fitz`) handles direct vector PDF text extraction. Docling handles complex table layouts. Tesseract OCR (`eng` + `hin`) is utilized specifically for scanned/raster pages in the prototype.
- **Rationale:** Surya OCR and PaddleOCR require heavy GPU worker pools. Tesseract CPU provides a reliable, self-contained fallback for scanned documents in the prototype milestone.
- **Trace:** Prototype §4, D10.

### D42: PIN-Centroid Geocoding Source
- **Decision:** The laboratory locator utilizes India Post PIN code centroids bundled locally in `data/seed/pin_centroids.json` to calculate distance (Haversine / PostGIS) without external Google Maps API dependencies.
- **Rationale:** Aligns with government sovereignty and zero-external-API operational requirements.
- **Trace:** Prototype §4, V8 §21.

### D43: Evidence Classes & Untrusted Data Isolation
- **Decision:** Inputs and snippets are classified into three strict classes:
  1. `official_source`: Citable official BIS documents (`[S#]`).
  2. `user_provided`: User context, uploaded tender text, inquiry attributes. (Never citable as BIS).
  3. `ai_interpretation`: Layman summaries, plain-language interpretations. (Clearly badged).
- **Rationale:** Prevents prompt injection via user uploads from becoming cited government authority.
- **Trace:** Axiom A11, Axiom A15, C8.

### D44: Self-Verifying Taxonomy Invariant
- **Decision:** Product groups, Sectional Committees, and must-contain standards are defined declaratively in `data/taxonomy/groups.yaml`. Ingestion builds fail loudly if any priority standard is unmapped.
- **Rationale:** Eliminates silent catalog indexing drops.
- **Trace:** C9.

### D45: Target vs. Measured Metric Convention
- **Decision:** Every metric in BISVEDA documentation and UI is labeled as **Target** (aspirational goal) or **Measured (YYYY-MM-DD, suite-ID)**. No claim is presented as fact without a stored evaluation run in `eval_runs`.
- **Rationale:** Enforces institutional integrity and resolves V7's A6 violations.
- **Trace:** Axiom A6, C11.

### D46: LiteLLM gateway with OpenRouter as the hosted tier
- **Decision:** D12 stands: LiteLLM is the gateway. OpenRouter is added as its hosted-model provider, so hosted access uses one managed key with routed fallback. The chain is hosted (via OpenRouter), then self-hosted open models in India, then evidence-only, and every model id still comes from env.
- **Rationale:** LiteLLM is self-hosted, so it can also route to models we run in India and work in the air-gapped and government-cloud modes, which OpenRouter (hosted only) cannot. OpenRouter removes the need for a key per hosted provider.
- **Not changed:** D2 stands. Vectors stay in PostgreSQL with pgvector (Qdrant was considered and rejected: no extra service, co-located with the relational data, scales to 10M+ vectors).
