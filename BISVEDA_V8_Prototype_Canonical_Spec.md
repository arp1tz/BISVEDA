# BISVEDA V8 — Canonical Prototype Specification

**System:** BISVEDA — BIS + Veda, Knowledge of Standards  
**Problem Statement:** SIH26107 — AI-powered Intelligent Assistant for Indian Standards and BIS Services for Industries and Consumers  
**Prototype Version:** V8.1 — Canonical Prototype Specification  
**Purpose:** Single standalone handoff specification for implementation in an agentic development environment  
**Status:** Build Specification  
**Source Lineage:** V7 Final Production Architecture → V8 Production Architecture → V8 Prototype Architecture and Development Plan → consolidated prototype decisions  

---

## 0. Document Purpose

This document is the canonical specification for the BISVEDA prototype. It defines what the prototype must be, how it should behave, what knowledge it may use, how evidence must flow through the system, how the user experience should work, what must be measurable, and where the prototype must preserve seams for eventual production scale.

This document is intended to be sufficient for an implementation agent or engineering team to derive a phase-wise implementation plan and execute the prototype without requiring another architecture document.

The prototype is not a throwaway demonstration. It is a **production-shaped, high-scale prototype**: intentionally smaller in infrastructure footprint than the eventual production system, but compatible with the production contracts, trust model, knowledge model, routing logic, agent boundaries, and user-facing information architecture.

The central rule is:

**Same contracts as production, fewer services.**

A prototype simplification is acceptable only when it is hidden behind a stable interface so that the production implementation can replace it without redesigning callers, data contracts, or user-facing behavior.

The prototype must not simulate capabilities that are presented as real. Where a capability is not actually available, the interface must state the limitation honestly and provide a safe fallback.

---

# 1. Product Definition

## 1.1 What BISVEDA is

BISVEDA is a governed, source-backed, multilingual, multimodal AI assistant and compliance research workspace for Indian Standards and BIS services.

It enables users to:

- discover applicable Indian Standards from product descriptions,
- understand why a standard is applicable or only a candidate,
- determine whether a requirement is mandatory, voluntary, conditional, or unresolved,
- understand BIS certification pathways,
- understand Quality Control Order implications,
- identify relevant testing requirements when the evidence tier permits,
- locate relevant BIS-recognized laboratories and Assaying & Hallmarking Centres,
- compare standards and revisions,
- inspect evidence and source provenance,
- review uploaded documents for identity, outdated references, and compliance gaps,
- interact through text, image, voice, documents, and supported Indian languages,
- maintain a structured research context,
- generate a structured Compliance Dossier,
- and preserve a traceable evidence record for every material conclusion.

BISVEDA is not the official BIS certification authority, not a substitute for official BIS portals, not a laboratory information system, not a legal advisor, and not a definitive counterfeit-detection authority. It provides guided intelligence, source-backed explanations, and preparation assistance.

Official actions and submissions remain with the relevant official BIS systems and authorities.

## 1.2 Product thesis

The prototype must not be designed as only a better chatbot.

Its product thesis is:

**BISVEDA is an evidence-first Compliance Intelligence Workspace that converts a user’s product or compliance question into a structured, inspectable decision path.**

The core experience is therefore:

**Product or Question → Applicable Standards → Applicability Reasoning → Regulatory Status → Certification Path → Testing → Laboratory → Required Evidence → Next Actions → Change Impact**

The prototype should make this workflow visible to the user instead of hiding the intelligence inside a chat response.

## 1.3 Primary product outcome

The user should be able to arrive with a vague business question and leave with one of four useful outcomes:

1. a grounded answer;
2. a structured Compliance Dossier;
3. a clear statement of what is unknown and what information is needed to continue;
4. an honest refusal with the correct next step when the knowledge boundary does not support the requested claim.

The system must never manufacture certainty merely to make the conversation feel complete.

---

# 2. Design Lineage from V7 to V8

V7 established the production-shaped foundation:

- governed data acquisition,
- source authority,
- multimodal and multilingual interaction,
- clause-aware knowledge ingestion,
- hybrid retrieval,
- deterministic orchestration,
- bounded specialist agents,
- a trust gate,
- document authenticity handling,
- context resolution,
- eligibility logic,
- knowledge refresh,
- feedback-to-learning controls,
- observability,
- evaluation,
- and multiple deployment modes.

V8 keeps that foundation but tightens the parts most important for a credible AI standards assistant:

- Evidence Adjudicator before generation,
- explicit Knowledge Tiers A/B/C,
- evidence classes on inputs and claims,
- staged intent routing before expensive retrieval,
- Compliance Dossier as the orchestrator output contract,
- real stage events instead of simulated progress,
- citation-marker and translation-survival contracts,
- named BIS acquisition connectors,
- self-verifying taxonomy,
- ingestion job timelines,
- outdated-reference checking,
- target-versus-measured evaluation,
- and a dedicated Experience Layer.

The prototype must therefore preserve the V7 production principles while implementing the V8 trust and product improvements from day one.

---

# 3. Non-Negotiable Design Axioms

## A1 — Evidence before generation

The language model is never the source of truth. Material technical, regulatory, procedural, or eligibility claims must be grounded in authorized evidence or explicitly labelled as interpretation.

## A2 — Never return nothing

When a direct answer is unavailable, the system returns one of:

- a partial answer with limitations,
- a clarification question,
- a guided research path,
- an evidence-only response,
- or a refusal with the exact boundary and next action.

## A3 — Fast by default, deep when needed

Cheap deterministic paths are used before expensive reasoning, retrieval, reranking, vision, translation, or generation.

## A4 — Validate proportionally

High-risk unsupported claims are blocked. Lower-risk uncertainty can be exposed as caveats. Quality signals are recorded for future improvement.

## A5 — Graceful degradation everywhere

Every critical dependency has a defined fallback. Failure of a model, translator, reranker, or external endpoint must not automatically become a blank error page.

## A6 — Measurable, not claimed

The system distinguishes targets from measured results. No benchmark, latency, accuracy, or quality number may be presented as achieved unless an evaluation run produced it.

## A7 — Source authority is architecture

Source quality, authority, provenance, licensing, effective dating, and refresh policy are part of the system architecture.

## A8 — Cost-aware routing

The system uses the cheapest sufficient path for the task and escalates only when the query requires it.

## A9 — Inclusive by design

Language coverage, varying digital literacy, bandwidth limitations, accessibility, and multimodal interaction are first-class requirements.

## A10 — Feedback drives governed quality improvement

Feedback may improve retrieval, taxonomy, FAQs, datasets, and product UX only through offline evaluation and controlled promotion.

## A11 — Multimodal-safe

OCR, vision, ASR, and other model-derived signals are candidate evidence. They are not automatically authoritative evidence.

## A12 — Form-safe

The assistant can help prepare forms, but must never claim official submission or invent official form structure.

## A13 — Adjudicate before you generate

Applicability, evidence coverage, grounding state, conflicts, claimability, and confidence are computed before prose generation.

## A14 — Claim only what the knowledge tier holds

Catalogue-only knowledge may identify a standard and support candidate matching, but must not be used to invent or imply clause-level technical details.

## A15 — Every evidence item and claim has an evidence class

The system distinguishes:

- official source evidence,
- user-provided evidence,
- AI interpretation.

Only official source evidence is authoritative for citation of BIS requirements.

## A16 — Show only real progress

The interface renders a stage only when that stage actually executed. No decorative fake pipeline progress is allowed.

---

# 4. Core Product Surfaces

The prototype should be built around one coherent experience rather than a collection of unrelated pages.

## 4.1 Home / Search Entry

The home experience provides:

- natural-language question entry,
- optional voice input,
- image upload,
- document upload,
- mode selection where useful,
- common research prompts,
- product and service discovery,
- recent research access for signed-in users,
- a visible corpus-scope statement,
- and a concise explanation of what BISVEDA can and cannot verify.

The search entry must encourage complete business questions, not only keyword queries.

## 4.2 Research Workspace

The Research Workspace is the primary application surface.

It contains:

- conversation and research context,
- live stage execution,
- clarification questions,
- refinement chips,
- structured dossier sections,
- applicability reasoning,
- evidence ledger,
- source inspection,
- compliance map,
- document findings,
- laboratory results,
- related standards,
- update impact,
- and exportable research output.

The workspace is the main differentiator of BISVEDA. Chat is one component of the workspace, not the product itself.

## 4.3 Standard Passport

Every supported standard or standard-like record should have a structured passport containing, where the knowledge tier permits:

- standard identifier,
- title,
- language variants,
- year or edition,
- status,
- knowledge tier,
- verification state,
- source authority,
- applicable product groups,
- related standards,
- QCO relationship,
- amendments and supersession information,
- laboratory scope links where available,
- simple explanation,
- evidence sources,
- and the exact limits of what BISVEDA knows about the standard.

## 4.4 Standard Comparison

Comparison should show factual differences such as:

- edition or year,
- current versus superseded state,
- amendments,
- scope metadata,
- applicable product groups,
- source availability,
- and evidence availability.

Where clause-level comparison is not supported by the available tier, the system must say so rather than imply full-text equivalence analysis.

## 4.5 Certification Hub

The certification surface should help the user understand:

- which BIS scheme may apply,
- what eligibility information matters,
- what steps appear in the relevant pathway,
- which steps are deterministic,
- which steps require source evidence,
- what documents are typically needed where the corpus supports the requirement,
- and what must ultimately be completed through official channels.

## 4.6 Testing and Laboratory Surface

The testing surface connects product or standard scope to laboratory options.

It supports:

- laboratory search,
- scope matching,
- validity filtering,
- geographic distance,
- list and map views,
- AHC search where relevant,
- and evidence showing why a laboratory is included.

## 4.7 Consumer Surface

Consumer workflows include:

- ISI/CM-L guidance,
- HUID guidance,
- mark or label image analysis as a candidate-identification step,
- complaints guidance,
- recall and safety information,
- and official verification pathways.

The UI must not imply that image recognition alone is definitive authentication.

## 4.8 Documents Surface

Users can upload documents for:

- identity extraction,
- referenced standard discovery,
- outdated-reference detection,
- document-scoped research,
- potential compliance gaps,
- and evidence extraction.

User documents are always classified as user-provided evidence unless independently matched to an authoritative source.

## 4.9 Updates Surface

A structured feed should surface relevant:

- new standards,
- amendments,
- QCOs,
- notices,
- recalls,
- and other supported BIS updates.

The long-term product direction is to turn updates into **impact analysis**, not only news presentation.

## 4.10 Administrative and Quality Surfaces

The prototype includes internal surfaces for:

- ingestion jobs,
- connector health,
- source freshness,
- taxonomy integrity,
- document review,
- knowledge status,
- evaluation results,
- known limitations,
- and system health.

---

# 5. The Flagship Product Workflow

The prototype must prove one complete business workflow end to end.

A canonical example is:

**“I manufacture stainless-steel water bottles in Nagpur. Which standard applies, is BIS certification mandatory, how do I get certified, what tests are needed, and where can I test?”**

The expected workflow is:

1. Understand the natural-language product description.
2. Detect missing attributes that materially change the answer.
3. Ask only the minimum useful clarification questions.
4. Map the product description to the product taxonomy.
5. Retrieve candidate standards and regulatory records.
6. Determine applicability class for each candidate.
7. Check mandatory versus voluntary status from the available QCO and regulatory evidence.
8. determine the relevant certification pathway using deterministic rules where possible.
9. identify testing requirements only to the degree supported by available evidence.
10. match laboratories to the relevant test or scope.
11. assemble the Compliance Dossier.
12. generate grounded explanation only from the adjudicated evidence set.
13. validate citations and claims through the Trust Gate.
14. stream real stage events to the user.
15. allow the user to inspect every material claim.
16. allow export of the resulting dossier.

The system should visibly distinguish:

- confirmed,
- probable or candidate,
- unavailable,
- user-provided,
- and AI-interpreted information.

---

# 6. New Core Product Concept — Compliance Mission

The V7/V8 dossier becomes more useful when treated as a persistent **Compliance Mission**.

A Compliance Mission is the user’s structured working state for a product or compliance objective.

It contains:

- product identity,
- relevant product attributes,
- candidate standards,
- applicability decisions,
- mandatory or voluntary status,
- QCO state,
- certification route,
- test requirements,
- laboratory options,
- document evidence,
- open questions,
- unresolved issues,
- next actions,
- source evidence,
- and change-impact signals.

The Compliance Mission must survive beyond a single chat turn.

## 6.1 Mission state

Each step may be:

- not evaluated,
- candidate,
- supported,
- unsupported,
- blocked by missing information,
- superseded,
- expired,
- or completed by the user outside BISVEDA.

## 6.2 Mission explainability

Every important decision in a mission should support three questions:

**Why?**  
What product attribute, rule, document, or source caused the decision?

**Evidence?**  
What authoritative source supports it?

**What could change this?**  
Which product attribute, regulatory change, or missing evidence would cause re-evaluation?

This turns the result into a decision workspace rather than a static answer.

---

# 7. Compliance Dossier

The Compliance Dossier is the canonical output contract for complex questions.

A dossier should contain, where applicable:

1. User question and understood objective.
2. Product or entity profile.
3. Clarifications asked and their answers.
4. Applicable-standard candidates.
5. Applicability reasoning.
6. Mandatory versus voluntary status.
7. QCO findings.
8. Certification route.
9. Testing requirements.
10. Laboratory suggestions.
11. Required or relevant documents.
12. Outdated or conflicting references.
13. Next actions.
14. Unknowns and limitations.
15. Evidence ledger.
16. Change-impact notes when prior research exists.

Every section must be optional so that a partial query still produces a valid partial dossier.

The dossier must support an evidence-only rendering when language generation is unavailable.

---

# 8. Evidence and Knowledge Governance

## 8.1 Knowledge tiers

The prototype implements the V8 tier model.

### Tier A — Catalogue and structured metadata

Contains standard metadata and structured relationships such as:

- identifier,
- title,
- committee,
- year,
- status,
- product-group relationships,
- and supported metadata relationships.

Tier A can support discovery, identification, candidate matching, and metadata-level explanations.

Tier A cannot support clause-level quotation, exact test values, exact tolerances, or technical numeric claims that are not present in the metadata.

### Tier B — Public authoritative full-text documents

Contains publicly available authoritative material such as:

- schemes,
- QCOs,
- public regulations,
- hallmarking material,
- public FAQs,
- consumer guidance,
- lab and AHC directories,
- public amendments,
- and other authoritative documents that the source policy permits.

Tier B can support paragraph- or clause-level answers within the actual document held.

Tier B must not be represented as the full text of an Indian Standard unless the document itself is an authoritative Indian Standard and the source policy permits that representation.

### Tier C — Licensed Indian Standard full text

Tier C represents authoritative full text obtained under the appropriate licence or agreement.

Tier C is not required for the prototype unless valid access has been established.

Tier C enables clause-level Indian Standard answers, subject to access policy and provenance.

## 8.2 Evidence classes

Every evidence object carries a class:

- official_source,
- user_provided,
- ai_interpretation.

Official source evidence may be cited as authoritative evidence.

User-provided evidence may influence reasoning but must be clearly labelled as supplied by the user unless independently verified.

AI interpretation is derived reasoning and must never be disguised as an official BIS statement.

## 8.3 Claim policy

The system must evaluate every claim against:

- source authority,
- evidence tier,
- evidence class,
- applicability,
- document status,
- effective dates,
- conflict state,
- and evidence coverage.

Claims that exceed the permitted tier must be rejected, downgraded, or reformulated.

---

# 9. Data Acquisition and Source Authority

## 9.1 Authorized source registry

Every source must have:

- source identity,
- owner or authority,
- source type,
- expected format,
- authority level,
- knowledge tier,
- licence or access policy,
- refresh cadence,
- connector identity,
- status,
- last successful retrieval,
- checksum or content fingerprint where applicable,
- and provenance metadata.

## 9.2 Priority source groups

The prototype should support the following source categories where access permits:

- standards catalogue metadata,
- Indian Standards records,
- public amendments,
- QCOs and Gazette notifications,
- certification scheme documents,
- hallmarking regulations and public guidance,
- BIS-recognized laboratory information,
- Assaying and Hallmarking Centre information,
- official FAQs,
- BIS announcements and updates,
- fee schedules,
- application forms and public templates,
- recalls and safety alerts,
- Standards Clubs and training information,
- and supported supplementary directories such as NABL where permitted.

## 9.3 Source freshness

The prototype must record freshness and last successful synchronization.

A stale source must be distinguishable from a current source.

Freshness must affect retrieval and user messaging rather than being treated as an administrative-only field.

## 9.4 Snapshot fallback

The prototype must support reproducible dated snapshots of connector output so the complete demo can continue even when live source endpoints are unavailable.

Snapshot use must be visible internally and must never be confused with live current retrieval.

---

# 10. Product Taxonomy and Knowledge Graph

## 10.1 Taxonomy

The prototype requires a self-verifying BIS-oriented taxonomy:

**BIS Division → Section Committee → Product Group → Product Type → Variant Attributes**

Variant attributes may include, where relevant:

- material,
- composition,
- grade,
- dimensions,
- capacity,
- intended use,
- consumer or industrial use,
- market context,
- application domain,
- and other product-specific properties.

Taxonomy data is not merely a search enhancement. It is a decision-support layer for applicability reasoning.

## 10.2 Taxonomy invariants

The system must be able to verify that:

- required product groups have their referenced standards,
- standards do not point to invalid product groups,
- synonyms map to valid entities,
- required identifiers exist,
- and connector updates do not silently corrupt the taxonomy.

Invalid taxonomy state should block publication when it would compromise answer quality.

## 10.3 Knowledge graph behavior

The logical graph should support relationships such as:

- product group → standard,
- standard → amendment,
- standard → superseding standard,
- standard → QCO,
- standard → scheme,
- standard → test scope,
- test scope → laboratory,
- product → product group,
- lab → geography,
- document → referenced standard,
- update → impacted standard,
- and standard → related standard.

The prototype may implement this graph using relational edge tables and recursive queries while preserving a graph repository interface for future graph infrastructure.

---

# 11. Ingestion and Knowledge Lifecycle

## 11.1 Ingestion principles

No document enters the retrieval corpus merely because it was downloaded or uploaded.

The lifecycle is:

**Acquire → Validate → Identify → Parse → Extract → Chunk → Enrich → Verify → Detect stale references → Stage → Review when required → Publish**

## 11.2 Document identity

The system must compare:

- claimed identifier,
- filename metadata,
- extracted title,
- extracted identifier,
- edition or year,
- source registry identity,
- and catalogue identity.

A genuine document with the wrong identity must be treated as a wrong-document case rather than an authenticity success.

## 11.3 Authenticity

Prototype authenticity should include the V7/V8 foundational checks that are realistically available without licensed gold references:

- provenance validation,
- source allowlisting,
- catalogue identity matching,
- metadata consistency,
- file integrity,
- MIME validation,
- malware scanning,
- structural checks,
- and content-identity consistency.

Gold clause diffing belongs to the Tier C licensed production path unless a valid canonical reference corpus is actually available.

## 11.4 Outdated-reference checking

The ingestion and document-analysis system should detect references to:

- superseded standards,
- withdrawn standards,
- outdated revisions,
- stale QCO references,
- and other known version changes.

This creates a useful bridge between knowledge ingestion and compliance analysis.

## 11.5 User-uploaded documents

User uploads are never automatically promoted to authoritative corpus evidence.

They remain user-provided evidence and are isolated from the shared authoritative index.

They can be used for:

- extraction,
- contextual analysis,
- referenced-standard discovery,
- comparison against known authoritative records,
- and compliance-gap analysis.

---

# 12. Query Intelligence and Routing

## 12.1 Staged routing

The prototype must use staged intent routing.

### Stage 1 — deterministic detection

Identify cheap patterns such as:

- exact standard identifier,
- exact FAQ-like question,
- known verification-format input,
- known service request,
- obvious gibberish,
- document-specific queries,
- or cacheable queries.

### Stage 2 — lightweight semantic intent routing

Use a compact model or equivalent controlled classification mechanism when deterministic rules do not sufficiently resolve the query.

### Stage 3 — future production classifier

The production architecture retains a path for a distilled or specialized classifier. The prototype does not require this stage if it cannot be justified by evaluation.

## 12.2 Query normalization

Before retrieval, normalize:

- Unicode form,
- standard-number spelling,
- edition notation,
- common abbreviations,
- transliterated language terms,
- terminology aliases,
- and structured identifiers.

## 12.3 Context resolution

Multi-turn context must maintain the current research objective, product profile, selected standards, unresolved attributes, language, and user-selected entities.

The system must not infer sensitive or important attributes that the user has not provided.

## 12.4 Clarification strategy

Ask the minimum number of questions that materially affect the answer.

Questions should be:

- explicit,
- easy to answer,
- tied to a known decision point,
- and presented with selectable options when possible.

---

# 13. Retrieval Architecture

## 13.1 Exact-first retrieval

Exact identifiers are resolved before broad semantic retrieval.

This applies especially to:

- IS numbers,
- QCO identifiers,
- known scheme names,
- CM/L-like identifiers,
- HUID-like identifiers,
- and other canonical identifiers supported by the source model.

## 13.2 Hybrid retrieval

For exploratory queries the prototype combines:

- dense retrieval,
- lexical retrieval,
- taxonomy and synonym expansion,
- FAQ retrieval,
- and structured relationship retrieval.

The fusion stage is followed by semantic reranking when available.

## 13.3 Relevance floor

The retrieval system requires a calibrated relevance threshold so the system can refuse to treat weak matches as sufficient evidence.

The relevance floor is versioned and produced from an evaluation suite rather than guessed from intuition.

## 13.4 Supersession awareness

Retrieval must be status-aware.

When a historical or superseded document is encountered, the system should distinguish:

- current active information,
- historical information requested explicitly,
- and outdated information that should not silently be used as current guidance.

## 13.5 Evidence package

Retrieval produces a structured Evidence Package containing the candidate evidence and metadata required for adjudication.

It should contain enough context for downstream agents and generation without forcing those components to independently reinterpret the source database.

---

# 14. Evidence Adjudication

The Evidence Adjudicator is a mandatory V8 component.

It occurs after retrieval and reranking and before answer generation.

Its responsibilities are to determine:

- evidence coverage,
- applicability class,
- grounding state,
- conflicts,
- freshness and status,
- knowledge tier,
- citable evidence set,
- confidence state,
- and claimability.

## 14.1 Applicability classes

The prototype should support a controlled vocabulary such as:

- directly applicable,
- conditionally applicable,
- potentially relevant,
- related but not sufficient,
- unsupported,
- and unresolved.

These are not generated by the language model. They are adjudicated from structured evidence, rules, taxonomy, and retrieval results.

## 14.2 Confidence

Confidence must describe evidence-supported system state, not the model’s subjective confidence.

Confidence should be based on observable signals such as:

- evidence coverage,
- source authority,
- retrieval agreement,
- conflict presence,
- applicability evidence,
- and tier support.

## 14.3 Conflict handling

When authoritative sources disagree, the system must not average them or ask the LLM to choose arbitrarily.

The system should:

1. record the conflict,
2. classify the source authority and effective dates,
3. determine whether one source supersedes the other,
4. otherwise expose the unresolved conflict,
5. and require an appropriate caveat or refusal.

---

# 15. Specialist Agent Architecture

BISVEDA uses bounded specialist agents orchestrated by a central deterministic workflow. It is not a free-roaming multi-agent swarm.

## 15.1 Agent roster

### AG1 — Standards and Product Matching Agent

Responsibilities:

- product-to-standard matching,
- applicability explanations,
- standard discovery,
- clause or metadata retrieval according to tier,
- related-standard discovery.

### AG2 — Regulatory and QCO Agent

Responsibilities:

- mandatory versus voluntary analysis,
- QCO discovery,
- effective-date interpretation,
- regulatory relationships,
- enforcement context supported by evidence.

### AG3 — Certification and Eligibility Agent

Responsibilities:

- scheme identification,
- eligibility determination,
- certification pathway,
- preparation steps,
- fee or form references where supported,
- official-channel handoff.

### AG4 — Testing and Laboratory Agent

Responsibilities:

- test-scope matching,
- laboratory retrieval,
- laboratory suitability filtering,
- geographic filtering,
- AHC discovery where relevant.

### AG5 — Consumer Affairs Agent

Responsibilities:

- ISI/CM-L guidance,
- HUID guidance,
- recalls,
- complaints guidance,
- consumer verification paths.

### AG6 — Hallmarking Agent

Responsibilities:

- hallmarking process guidance,
- HUID-related information,
- AHC discovery,
- applicable public hallmarking material.

### AG7 — Education and Standards Club Agent

Responsibilities:

- Standards Clubs,
- training,
- education and outreach information.

### AG8 — Comparison and Change Agent

Responsibilities:

- edition comparison,
- amendment tracking,
- supersession relationships,
- update impact on prior research.

### AG9 — Document and Form Preparation Agent

Responsibilities:

- document-scoped research,
- form preparation support,
- document evidence extraction,
- compliance-gap analysis,
- template-oriented preparation.

### AGF — Fallback and Evidence Agent

Responsibilities:

- evidence-only rendering,
- boundary explanation,
- unsupported-query handling,
- degraded-mode responses,
- and routing recovery.

## 15.2 Agent constraints

Each agent has:

- a defined responsibility boundary,
- approved tools,
- approved evidence types,
- a structured output contract,
- execution budget,
- and explicit fallback behavior.

Agents must not independently invent system state, applicability class, or source authority.

---

# 16. Orchestration

The orchestrator is a deterministic state machine.

Its responsibilities include:

- accepting the routed query,
- resolving required plan shape,
- dispatching bounded subtasks,
- controlling execution budgets,
- managing clarification,
- collecting structured agent results,
- merging outputs,
- emitting stage events,
- building the Compliance Dossier,
- and passing the final evidence package to the generation and Trust Gate stages.

## 16.1 Planning

The planner supports reusable patterns such as:

- exact lookup,
- standard discovery,
- product-to-standard matching,
- certification workflow,
- QCO compliance check,
- lab search,
- consumer verification,
- document review,
- standard comparison,
- and multi-step MSME compliance research.

The planner must prefer deterministic known plan shapes over arbitrary tool planning for the prototype.

## 16.2 Execution budgets

Budgets must be enforced for:

- wall-clock duration,
- maximum agent fan-out,
- maximum model calls,
- retrieval depth,
- vision calls,
- and translation calls.

Budgets should be configuration-driven and measurable rather than embedded as assumptions in individual agents.

---

# 17. Generation Contract

The language model is responsible for rendering already-adjudicated evidence into readable language.

The model is not responsible for deciding:

- whether evidence is authoritative,
- whether a standard applies,
- whether evidence is sufficient,
- whether a citation is allowed,
- or which confidence state should be presented.

Generated content must use only the approved evidence identifiers supplied to it.

The generation layer supports two modes.

## 17.1 Grounded generation

Readable prose is generated from the evidence package and structured dossier.

## 17.2 Evidence-only mode

When generation is unavailable, the same structured evidence and adjudicated data are rendered using deterministic templates.

This is a core resilience requirement, not a cosmetic fallback.

---

# 18. Trust Gate

The Trust Gate is the final output validation layer.

It should validate, where applicable:

- citation marker integrity,
- source membership in the candidate evidence set,
- evidence class restrictions,
- knowledge-tier rules,
- numerical consistency,
- contradiction signals,
- NLI-based entailment checks,
- PII policy,
- prompt-injection indicators,
- access policy,
- and unsupported-claim patterns.

A Trust Gate failure must result in one of:

- regeneration under stricter constraints,
- removal of the unsupported claim,
- evidence-only rendering,
- or an explicit limitation notice.

The system must never silently pass a blocked claim through to the user.

---

# 19. Citation and Evidence Experience

The citation system is part of the UX, not just a backend feature.

Every material source marker should allow the user to inspect:

- source title,
- source authority,
- document identity,
- locator such as page or clause when available,
- knowledge tier,
- evidence class,
- applicability class where relevant,
- and the reason the source supports the claim.

The user should be able to move from:

**claim → evidence → source → context**

without losing the current research state.

The source view must not expose protected full text beyond the permitted access policy.

---

# 20. Multilingual Architecture

The prototype should provide strong English and Hindi support for the primary UI and interaction path.

Additional supported answer languages may include Tamil, Bengali, Marathi, Telugu, Gujarati, and Kannada where the capability registry and translation path support them.

The system must not imply equal capability across every language and modality.

## 20.1 Language capability registry

The registry records capability for each language across:

- input,
- detection,
- retrieval,
- UI,
- generation,
- translation,
- OCR,
- ASR,
- and TTS.

## 20.2 Terminology lock

Critical terms such as:

- IS identifiers,
- scheme names,
- QCO identifiers,
- clause references,
- standard titles,
- product identifiers,
- and citations

must survive translation.

## 20.3 Translation survival

After translation, the system checks that required identifiers and citation markers remain intact.

If the survival check fails, the system falls back to a safe language output with an explicit notice.

---

# 21. Multimodal Architecture

## 21.1 Image input

Image input may support:

- product identification candidates,
- packaging and label interpretation,
- CM/L-like identifiers,
- barcode or QR extraction,
- hallmark-related visual cues,
- and document-image understanding.

Vision output is candidate information. It is not authoritative verification by itself.

## 21.2 Voice input

Voice should support:

- browser-side speech where available,
- server-side ASR fallback,
- language detection,
- text normalization,
- and optional answer speech output.

## 21.3 Document input

Document input is handled as a knowledge-analysis workflow rather than simply attaching text to the prompt.

It includes:

- file validation,
- malware scanning when enabled,
- identity extraction,
- parsing,
- OCR for scanned content when required,
- chunking,
- referenced-standard detection,
- outdated-reference detection,
- evidence separation,
- and document-scoped research.

---

# 22. Compliance Gap Analysis

A major prototype capability is structured review of a user-provided document or product specification.

The system should identify, when evidence permits:

- referenced standards,
- current or outdated references,
- missing supporting information,
- potentially missing test evidence,
- possible certification requirements,
- and unresolved compliance questions.

The output should separate:

- verified findings,
- probable findings,
- and review-required findings.

It must not claim regulatory non-compliance solely because a document lacks information that BISVEDA has not actually established as mandatory.

---

# 23. Change Impact Intelligence

The update and comparison capabilities should evolve into change-impact analysis.

When an update affects a standard, QCO, scheme, or other supported authoritative record, BISVEDA should be able to identify affected Compliance Missions.

A change-impact result should answer:

- what changed,
- which knowledge item changed,
- effective date if available,
- which product or compliance step may be affected,
- whether re-evaluation is required,
- and what source supports the change.

The prototype may initially implement this for explicit user-requested comparisons or seeded update scenarios, but the data model must preserve the ability to extend it.

---

# 24. User Safety and Honest Boundaries

The system must clearly distinguish among:

- authoritative facts,
- source-backed interpretations,
- user-provided documents,
- model-generated explanation,
- and unresolved questions.

It must refuse or qualify when:

- evidence is outside the supported corpus,
- the requested technical value is not present in the available tier,
- authoritative sources conflict without a resolvable precedence,
- an uploaded document is suspicious,
- the query requests an unsupported official action,
- or the system cannot establish sufficient evidence.

The refusal should remain useful by explaining what is known, what is missing, and what official source or action should be consulted next.

---

# 25. High-Scale Prototype Architecture

The prototype is intentionally a modular monolith or small-deployable system rather than a full microservice estate.

The architecture should be logically separated into:

1. Experience layer.
2. Gateway and session layer.
3. Language and multimodal normalization.
4. Query routing and planning.
5. Retrieval and adjudication.
6. Agent orchestration.
7. Generation and Trust Gate.
8. Ingestion and connectors.
9. Knowledge and storage.
10. Evaluation and operations.

Each logical subsystem must have a stable interface.

## 25.1 Prototype deployment shape

The initial implementation should be practical to run locally and in a small cloud environment with:

- a web application,
- an API/application runtime,
- PostgreSQL with vector and geospatial capabilities,
- optional malware scanning,
- local or hosted model providers,
- and file storage abstraction.

Infrastructure such as separate distributed job orchestration, dedicated search clusters, centralized object storage, managed secrets, Kubernetes, and dedicated inference servers may be deferred until justified by scale.

## 25.2 Production seams preserved from day one

The prototype must have abstractions for:

- model providers,
- embeddings,
- reranking,
- NLI,
- translation,
- ASR,
- TTS,
- vector and lexical retrieval,
- graph access,
- storage,
- job execution,
- authentication,
- malware scanning,
- geocoding,
- and connector execution.

No major component should be hard-wired such that production scaling requires rewriting core business logic.

---

# 26. Storage and Data Model Responsibilities

The prototype data layer must support the following conceptual entities:

- sources,
- connectors,
- connector runs,
- standards,
- documents,
- chunks,
- structured document content,
- product taxonomy,
- synonyms,
- QCO records,
- eligibility rules,
- fees where supported,
- scheme workflows,
- laboratories,
- AHCs,
- updates,
- users,
- conversations,
- conversation turns,
- adjudications,
- Compliance Missions,
- Compliance Dossiers,
- feedback,
- ingestion jobs,
- job events,
- document authenticity findings,
- outdated-reference reports,
- visual evidence,
- graph relationships,
- evaluation runs,
- evaluation results,
- and language capabilities.

Every knowledge record should retain sufficient provenance to answer:

- where it came from,
- when it was ingested,
- what version it represents,
- what authority level it has,
- what knowledge tier it belongs to,
- and whether it is current.

---

# 27. Frontend and Backend Contract

The backend is the source of truth for decisions.

The frontend must never infer or calculate:

- applicability,
- regulatory status,
- confidence,
- knowledge tier,
- evidence authority,
- certification eligibility,
- or compliance state.

The frontend receives structured state and renders it.

## 27.1 Streaming

The research workspace should receive structured stage events.

Possible conceptual stages include:

- understanding,
- clarification,
- taxonomy matching,
- exact lookup,
- retrieval,
- adjudication,
- regulatory analysis,
- certification analysis,
- lab analysis,
- dossier assembly,
- generation,
- validation,
- and completion.

Only executed stages are shown.

## 27.2 Error presentation

Backend failures should produce user-meaningful states such as:

- source temporarily unavailable,
- language fallback,
- degraded retrieval,
- evidence-only response,
- or retryable system issue.

Technical stack traces do not belong in the user-facing experience.

---

# 28. Security and Privacy

Security is part of the prototype architecture.

Required controls include:

- strong input validation,
- file type validation based on actual file content,
- upload size and page limits,
- malware scanning when enabled,
- EXIF stripping for uploaded images,
- rate limiting,
- authenticated administration,
- hashed credentials for prototype admin accounts,
- strict CORS and security headers,
- source allowlisting and SSRF protection for connectors,
- secret isolation,
- structured logs without raw uploads or secrets,
- PII-aware logging,
- prompt-injection defense,
- tool-execution isolation,
- and audit logging for administrative actions.

The application must not imply official BIS ownership, endorsement, or certification.

Official branding elements that could misrepresent authority must not be used.

---

# 29. Prompt Injection and Adversarial Input

The prototype must assume that user documents, labels, images, and retrieved text may contain instructions intended to manipulate the system.

The security model is:

- untrusted input is never a system instruction,
- retrieved evidence is data rather than executable policy,
- user documents are user-provided evidence rather than authoritative source policy,
- model-generated tool calls are constrained by the orchestrator,
- sensitive operations require deterministic policy checks,
- and prompt-injection indicators are logged for evaluation.

An uploaded label that says to ignore system instructions must not affect routing, evidence policy, or tool permissions.

---

# 30. Administration and Knowledge Operations

The administrative experience must make the knowledge system observable and maintainable.

It should provide:

- source registry status,
- connector health,
- connector run history,
- freshness status,
- ingestion job timelines,
- quarantined documents,
- identity mismatch findings,
- outdated-reference reports,
- taxonomy invariant status,
- review items,
- evaluation status,
- and known-quality issues.

The admin surface must reflect real backend events rather than mock progress.

---

# 31. Quality and Evaluation Framework

The prototype must ship with an evaluation framework before it is considered complete.

## 31.1 Evaluation categories

### Retrieval

Measure:

- recall,
- precision or relevance quality,
- reciprocal-rank behavior,
- exact-identifier accuracy,
- taxonomy matching accuracy,
- and refusal calibration.

### Grounding

Measure:

- evidence coverage,
- citation correctness,
- claim-to-source alignment,
- numeric consistency,
- contradiction rate,
- and unsupported-claim rate.

### Product matching

Measure:

- direct applicability precision,
- conditional applicability quality,
- false-positive rate,
- missing-standard rate,
- and clarification effectiveness.

### Multilingual

Measure:

- terminology survival,
- citation survival,
- language identification accuracy,
- translation quality on the supported test set,
- and safe fallback behavior.

### Multimodal

Measure:

- extraction accuracy,
- OCR confidence,
- ASR confidence,
- candidate identification accuracy,
- and correct uncertainty handling.

### User experience

Measure:

- task completion,
- clarification burden,
- time to useful answer,
- dossier completeness,
- evidence inspection usage,
- and accessibility.

## 31.2 Red-team suites

The prototype must include adversarial cases covering:

- prompt injection in uploaded files,
- maliciously structured documents,
- wrong standard numbers,
- superseded standards,
- unsupported numerical questions,
- gibberish,
- intentionally misleading product descriptions,
- conflicting source records,
- missing product attributes,
- translation marker corruption,
- and provider failure.

## 31.3 Quality page

The Quality page must show:

- latest evaluation run,
- test-set version,
- measured results,
- target thresholds,
- known failures,
- and limitations.

Targets and measured values must remain visibly distinct.

---

# 32. End-to-End Prototype Demonstration Set

The prototype must demonstrate at least these workflows.

## Flow A — Flagship MSME compliance research

Natural-language product question leading to a Compliance Mission and Dossier.

## Flow B — Exact standard lookup

User enters a standard identifier and receives structured passport information plus supported evidence.

## Flow C — Product-to-standard matching

Product description is mapped to taxonomy, candidates are retrieved, and applicability is explained.

## Flow D — QCO and mandatory-status analysis

User asks whether BIS is mandatory and receives a source-backed regulatory result or an explicit unresolved state.

## Flow E — Certification route

User receives a structured pathway with required information and official handoff guidance.

## Flow F — Laboratory recommendation

User receives matching laboratories with geographic and scope filters.

## Flow G — Document review

Uploaded document is analyzed for identity, cited standards, outdated references, and evidence gaps.

## Flow H — Consumer verification guidance

Image or identifier is interpreted as a candidate and linked to an official verification path.

## Flow I — Standard comparison

Two supported standard records are compared for version/status/metadata differences.

## Flow J — Update impact

A known update is related to an existing research state.

## Flow K — Multilingual answer

A supported answer is translated while preserving critical identifiers and evidence markers.

## Flow L — Voice interaction

Voice input is converted into the same structured research pipeline as text.

## Flow M — Evidence-only mode

Generation is disabled, but the user still receives a valid structured evidence result.

## Flow N — Provider failure

A model or translation provider fails and the system follows the defined fallback without losing the research state.

## Flow O — Prompt injection

A malicious uploaded artifact is ignored as an instruction, remains untrusted evidence, and is logged.

## Flow P — Out-of-boundary request

The system clearly explains the knowledge boundary and directs the user to the correct next step.

---

# 33. Prototype Scope

The prototype should include the following as first-class capabilities:

- source governance,
- Tier A and Tier B knowledge,
- product taxonomy,
- named source connectors or reproducible snapshots,
- ingestion and provenance,
- wrong-document detection,
- outdated-reference checking,
- hybrid retrieval,
- exact-first routing,
- staged intent routing,
- Evidence Adjudicator,
- bounded specialist agents,
- Compliance Mission,
- Compliance Dossier,
- generation contract,
- evidence-only mode,
- Trust Gate,
- English and Hindi primary experience,
- selected additional-language output where supported,
- image input,
- voice input,
- laboratory map and search,
- certification guidance,
- standards passport,
- standard comparison,
- document review,
- updates feed,
- admin ingestion console,
- quality page,
- evaluation harness,
- offline snapshot mode,
- and exportable dossier output.

---

# 34. Explicit Prototype Non-Goals

The following are not required for the first prototype unless they become necessary for evaluation or demonstration:

- licensed Tier C full-text Indian Standards,
- Tier C gold clause diffing when no canonical licensed corpus exists,
- full production Kubernetes deployment,
- distributed job orchestration,
- dedicated large-scale search cluster,
- enterprise identity federation,
- government-network deployment,
- WhatsApp production integration,
- SMS production integration,
- IVR production integration,
- partner API ecosystem,
- air-gapped deployment,
- full production-scale graph infrastructure,
- full local Indic model stack,
- complete all-language parity,
- and official portal submission automation.

These are production evolution paths, not reasons to weaken prototype contracts.

---

# 35. Recommended Technical Direction

The prototype technology should remain aligned with V7/V8 unless evaluation establishes a concrete reason to change it.

## Frontend

- Next.js with a component-driven experience,
- strict TypeScript,
- a reusable design system,
- responsive layouts,
- accessible interaction patterns,
- and a map layer for laboratory and AHC visualization.

## Backend

- FastAPI,
- Python,
- typed application contracts,
- deterministic policy services,
- modular domain packages,
- and a centralized orchestrator.

## Orchestration

- LangGraph or equivalent deterministic state-machine orchestration.

## Knowledge store

- PostgreSQL,
- vector search,
- full-text search,
- geospatial capabilities,
- and relational graph edges.

## Retrieval

- dense embeddings,
- lexical retrieval,
- RRF-style fusion,
- cross-encoder reranking,
- and calibrated relevance thresholds.

## Models

Use role-based model configuration rather than embedding model names throughout the codebase.

Roles should cover:

- reasoning,
- fast routing,
- vision,
- translation,
- embeddings,
- reranking,
- and NLI.

Provider choice must be configuration-driven.

## Parsing and multimodal

Use a structured document parser, PDF parsing, OCR for scanned pages, image validation, barcode/QR extraction when useful, speech services, and a model-backed vision extractor.

## Testing

Use unit, contract, integration, end-to-end, accessibility, evaluation, red-team, and failure-injection testing.

---

# 36. API and Contract Principles

The implementation must expose clear domain capabilities rather than letting the frontend directly manipulate database behavior.

The prototype should support capability groups for:

- research turns,
- clarification,
- standards discovery,
- standard passport retrieval,
- explanation,
- comparison,
- laboratory search,
- AHC search,
- consumer verification guidance,
- media upload,
- document review,
- Compliance Mission retrieval and update,
- dossier export,
- feedback,
- quality metrics,
- health,
- ingestion administration,
- connector runs,
- and review operations.

The API contract is the single source of truth between frontend and backend.

Contract drift must fail CI.

---

# 37. Observability and Operations

Every research request should have a traceable execution identity.

Record:

- route taken,
- plan shape,
- retrieval engines used,
- evidence identifiers,
- adjudication state,
- agents executed,
- model providers invoked,
- fallback events,
- latency breakdown,
- Trust Gate results,
- and final outcome class.

Logs must not expose raw sensitive uploads or secrets.

Operational dashboards should distinguish:

- system failures,
- source failures,
- model failures,
- retrieval failures,
- and quality failures.

---

# 38. Caching and Cost Control

The prototype must demonstrate cost-aware behavior even if the first deployment is small.

Use caching for:

- deterministic exact lookups,
- source snapshots,
- safe repeat queries,
- embeddings,
- expensive reranking where the evidence set is unchanged,
- and translation where appropriate.

Cache invalidation must be tied to source or knowledge version changes.

A stale cache must never silently override a current authoritative source.

The model cascade should prefer:

1. exact or cached answer,
2. deterministic template,
3. small/fast reasoning path,
4. larger reasoning path,
5. evidence-only fallback.

---

# 39. Scalability Strategy

The prototype should be able to evolve through these stages without changing the logical application contracts.

## Stage 1 — Prototype scale

Single small environment, modular application runtime, PostgreSQL, local or hosted models, reproducible snapshots.

## Stage 2 — Pilot scale

Independent workers, object storage, managed secrets, distributed job processing, dedicated inference services, stronger authentication, and scalable search infrastructure where required.

## Stage 3 — Production scale

Container orchestration, separate inference services, horizontal API scaling, durable event processing, dedicated observability, automated deployments, and stronger tenancy controls.

## Stage 4 — Government or institutional deployment

Government-network deployment options, enhanced auditability, restricted-network source acquisition, stronger identity and role controls, and deployment-specific compliance controls.

## Stage 5 — High-scale national service

Multi-region or multi-zone resilience, scalable knowledge refresh, high-throughput inference, dedicated source ingestion infrastructure, and large-scale quality monitoring.

The prototype does not implement every stage, but its interfaces and state model must not prevent them.

---

# 40. Prototype Development Phases

The implementation agent should convert this specification into a phase-wise plan. The phases below define the required dependency order and exit conditions.

## Phase 0 — Foundation and Contracts

Deliver:

- repository structure,
- environment configuration,
- database foundation,
- application contracts,
- API contract,
- frontend foundation,
- design-system foundation,
- logging and tracing foundation,
- model registry,
- provider abstractions,
- testing foundation.

Exit condition:

The system starts cleanly, contracts are testable, the web and API communicate through typed interfaces, and no core feature is directly coupled to an implementation that the production architecture intends to replace.

## Phase 1 — Knowledge Foundation

Deliver:

- source registry,
- connector framework,
- snapshots,
- Tier A catalogue data,
- priority product taxonomy,
- Tier B seed sources,
- provenance records,
- source freshness state,
- and graph relationships.

Exit condition:

The prototype has a reproducible knowledge base with provenance and verified taxonomy invariants.

## Phase 2 — Ingestion and Document Intelligence

Deliver:

- document lifecycle,
- parsing,
- OCR where needed,
- chunking,
- metadata enrichment,
- identity checks,
- wrong-document detection,
- outdated-reference detection,
- staging and publish controls,
- ingestion job events,
- and user-document quarantine.

Exit condition:

A supported source document can move through ingestion, produce traceable events, and either publish or be quarantined for a clear reason.

## Phase 3 — Retrieval and Evidence Adjudication

Deliver:

- normalization,
- staged routing,
- exact-first retrieval,
- dense retrieval,
- lexical retrieval,
- taxonomy expansion,
- fusion,
- reranking,
- relevance floor calibration,
- evidence packaging,
- Evidence Adjudicator,
- and claim policy.

Exit condition:

The system can distinguish strong evidence from weak evidence and can produce an adjudicated evidence package before generation.

## Phase 4 — Orchestration and Domain Intelligence

Deliver:

- planner,
- bounded specialist agents,
- eligibility engine,
- Compliance Mission state,
- Compliance Dossier,
- stage-event streaming,
- fallback agent,
- generation contract,
- and Trust Gate.

Exit condition:

The flagship MSME workflow completes through the backend with inspectable evidence and safe fallback behavior.

## Phase 5 — Core Experience Layer

Deliver:

- home/search,
- research workspace,
- standard passport,
- comparison,
- certification hub,
- testing and labs,
- consumer surface,
- updates,
- documents,
- Compliance Mission view,
- dossier export,
- and evidence inspection.

Exit condition:

A user can complete the primary workflows without needing internal tools or developer intervention.

## Phase 6 — Multimodal and Multilingual Experience

Deliver:

- Hindi primary path,
- supported additional-language responses,
- marker survival checks,
- image input,
- barcode or QR extraction where applicable,
- voice input/output,
- and safe multimodal fallback.

Exit condition:

The supported language and multimodal flows reach the same backend research state as text workflows.

## Phase 7 — Evaluation, Red Team, Hardening

Deliver:

- evaluation harness,
- retrieval calibration,
- grounding tests,
- multilingual survival tests,
- multimodal tests,
- prompt-injection suite,
- provider-failure suite,
- accessibility checks,
- performance tests,
- quality page,
- and complete demo validation.

Exit condition:

All required prototype flows have test evidence, failures are documented, and targets are clearly separated from measured values.

## Phase 8 — Showcase and Prototype Freeze

Deliver:

- polished flagship workflow,
- Compliance Mission demonstration,
- document gap-analysis demonstration,
- change-impact demonstration,
- evidence inspection demonstration,
- offline snapshot demonstration,
- and final prototype documentation.

Exit condition:

The prototype can be demonstrated end-to-end without hidden manual steps and without presenting simulated functionality as live functionality.

---

# 41. Prototype Acceptance Criteria

The prototype is accepted only if all of the following are true.

## Functional

- The flagship MSME workflow works end to end.
- Exact standard lookup works where supported.
- Product-to-standard matching produces explainable candidate results.
- QCO status is source-backed or explicitly unresolved.
- Certification guidance is structured and bounded.
- Laboratory recommendations are scope-aware where data permits.
- Uploaded documents can be analyzed without becoming authoritative evidence.
- Outdated references are surfaced.
- Standard status and supersession are visible.
- Multilingual output preserves critical identifiers and citation markers or falls back safely.
- Image and voice workflows rejoin the same research pipeline.
- Evidence-only mode works when generation is unavailable.

## Trust

- Every material claim has a valid source path or explicit interpretation label.
- Unsupported claims cannot bypass the Trust Gate.
- User evidence cannot silently become official evidence.
- Knowledge tiers are enforced.
- Current and superseded information are distinguished.
- Prompt injection from untrusted content does not alter system policy.

## UX

- The research workspace is understandable without training.
- Real stage events are shown accurately.
- Evidence can be inspected without leaving the research context.
- Clarification questions are minimal and purposeful.
- Compliance Mission state is persistent and understandable.
- Accessibility and responsive behavior pass the defined test suite.

## Engineering

- Core contracts are versioned.
- Provider abstractions are replaceable.
- No critical feature depends directly on a production-deferred infrastructure component.
- Tests cover core deterministic logic.
- CI fails on contract drift.
- Measured results are recorded honestly.

---

# 42. Quality Gates Before Calling the Prototype Complete

A release candidate must pass the following gates.

### Gate 1 — Data integrity

All seed data has provenance, source classification, and valid taxonomy relationships.

### Gate 2 — Retrieval quality

The calibrated relevance floor behaves correctly on supported evaluation sets.

### Gate 3 — Evidence quality

Unsupported claims are blocked or clearly qualified.

### Gate 4 — Workflow integrity

The flagship workflow completes without developer intervention.

### Gate 5 — Failure handling

Provider failures produce defined fallbacks.

### Gate 6 — Multilingual integrity

Critical markers and identifiers survive supported translation paths.

### Gate 7 — Multimodal integrity

Image and voice inputs do not bypass evidence policy.

### Gate 8 — Security

Upload, injection, authentication, rate limiting, and secret-handling tests pass.

### Gate 9 — Accessibility

Key pages meet the defined accessibility test criteria.

### Gate 10 — Honest presentation

No fake progress, fake corpus, fake measurements, fake official status, or simulated feature presented as production functionality.

---

# 43. Risk Register

## Risk: limited access to Indian Standard full text

Mitigation: design around Tier A and Tier B during the prototype; enforce claim restrictions; preserve Tier C production seams.

## Risk: unstable BIS or public endpoints

Mitigation: connector throttling, snapshots, provenance, freshness, and offline demo mode.

## Risk: model hallucination

Mitigation: pre-generation adjudication, constrained generation, Trust Gate, evidence-only fallback.

## Risk: model provider outage

Mitigation: provider chain, local optional provider, deterministic rendering, evidence-only mode.

## Risk: retrieval false positives

Mitigation: taxonomy constraints, reranking, calibration, applicability adjudication, and refusal thresholds.

## Risk: outdated regulatory information

Mitigation: effective dating, supersession resolution, freshness tracking, and outdated-reference analysis.

## Risk: multimodal misclassification

Mitigation: candidate labels, confidence, source-backed verification, and no definitive claim from vision alone.

## Risk: translation corruption

Mitigation: terminology lock, marker survival, language capability registry, safe fallback.

## Risk: prototype becomes a feature collection

Mitigation: prioritize the Compliance Mission and flagship end-to-end workflow over isolated demos.

## Risk: infrastructure overengineering

Mitigation: modular monolith first, production-shaped contracts, infrastructure upgrades only when justified by scale or reliability needs.

---

# 44. Product Differentiation Strategy

BISVEDA should differentiate through **decision quality and continuity**, not simply the number of features.

The prototype must make these experiences central:

## 44.1 Why this standard?

The system should expose the matched attributes and evidence that caused a standard to be considered applicable.

## 44.2 Why not that standard?

Where useful, the system should explain why a competing or related standard was not selected, using evidence rather than unsupported ranking language.

## 44.3 What must I do next?

The Compliance Mission should convert research into sequenced next actions.

## 44.4 What evidence supports this?

The evidence ledger must make support inspectable.

## 44.5 What changed?

The update and comparison experience should reveal the impact of standards and regulatory changes.

## 44.6 What is missing?

Document and compliance-gap analysis should identify unresolved requirements or missing evidence where the knowledge model can support it.

## 44.7 What happens if my product changes?

The Compliance Mission should preserve product attributes so that a changed attribute can trigger re-evaluation instead of forcing a fresh conversation from zero.

These seven experiences define the practical product advantage of the prototype.

---

# 45. Rules for Implementation Agents

The implementation agent must follow these rules throughout development.

1. Do not invent BIS facts that are not present in the configured corpus.
2. Do not treat a model-generated answer as authoritative evidence.
3. Do not expose Tier C behavior without valid Tier C access.
4. Do not hard-code a specific model provider into domain logic.
5. Do not allow frontend code to decide compliance state.
6. Do not allow user-provided documents to become authoritative corpus evidence automatically.
7. Do not create decorative progress stages that did not execute.
8. Do not report a target as a measured result.
9. Do not claim official BIS status, certification authority, or official submission capability.
10. Do not make the prototype dependent on production-only infrastructure when the logical interface can be implemented locally.
11. Do not remove the Evidence Adjudicator, knowledge-tier policy, evidence classes, or Trust Gate merely to simplify the demo.
12. Prefer deterministic rules for eligibility, source status, and structured decisions.
13. Use language models for interpretation and explanation inside the defined contracts, not as unbounded system controllers.
14. Preserve source provenance through every transformation.
15. Make every important uncertainty visible to the user.
16. Use real data or clearly labelled fixtures. Never silently substitute mock data for authoritative data.
17. Keep modules and interfaces small enough to be replaced independently during production scaling.
18. Do not implement a feature merely because it appears in a page list; implement it only when its backend contract and evidence model are defined.
19. Every new domain rule must have an evaluation case.
20. Every production-deferred subsystem must have a replacement seam if it affects the prototype’s core logic.

---

# 46. Final Architecture Principle

The prototype is successful when the following invariant holds from end to end:

**Understand → Route → Plan → Retrieve → Rerank → Adjudicate → Execute bounded domain work → Assemble Compliance Mission/Dossier → Generate within evidence limits → Validate → Explain with evidence**

The LLM may make the experience conversational, but it must not be the component that decides what is true.

The product may look like an assistant, but its internal behavior must resemble a governed research and compliance system.

The prototype may be smaller than production, but it must not be architecturally disposable.

The user should never have to trust BISVEDA merely because it sounds confident. The product should make it easy to inspect why an answer was produced, what supports it, what remains uncertain, and what the user should do next.

That is the canonical V8 prototype definition.

---

# 47. Prototype Definition of Done

BISVEDA V8 Prototype is complete when:

- the full flagship compliance journey works,
- the Compliance Mission is persistent,
- the Compliance Dossier is structured and exportable,
- Evidence Adjudication occurs before generation,
- knowledge tiers are enforced,
- evidence classes are preserved,
- citations are inspectable,
- outdated references are detected,
- product matching is taxonomy-aware,
- QCO and certification reasoning are deterministic where possible,
- laboratory recommendations are evidence-aware,
- uploaded documents remain untrusted unless independently verified,
- multilingual and multimodal inputs reach the same governed research pipeline,
- the Trust Gate is active,
- evidence-only mode works,
- ingestion is observable,
- quality is measured rather than claimed,
- failure modes are demonstrated,
- the system can run in a small environment,
- and production scaling seams are preserved.

The resulting system should feel like a serious BIS research and compliance product rather than a generic RAG chatbot with BIS documents attached.

---

**END OF BISVEDA V8 — CANONICAL PROTOTYPE SPECIFICATION**
