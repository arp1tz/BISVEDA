# BISVEDA V8 — Build Prompt for an Agent Team (Antigravity)

> Paste everything below the line into Antigravity's Agent Manager as the mission brief. Attach or place in the repo root: `BISVEDA_Architecture_V8.md`, `BISVEDA_V8_Prototype.md`, `BISVEDA_V8_Research_Report.md`.
> **Do not start until the human team lead has approved the plan.**

---

## Mission

Build the **BISVEDA V8 prototype**: an AI assistant for Indian Standards and BIS services (SIH26107). It must be a practical implementation of the V8 architecture, scoped exactly as `BISVEDA_V8_Prototype.md` §1 and §17 define. It must be real: no simulated pipelines, no fake progress, no invented standards, clauses, QCOs, fees, labs, dates or metrics.

## Source of truth, in order

1. `BISVEDA_V8_Prototype.md`: scope, structure, technology, milestones, definition of done.
2. `BISVEDA_Architecture_V8.md`: contracts and behaviour, especially §5.3 (tiers), §9.8 (Evidence Adjudicator), §9.9 (Evidence Package), §10.1.2 (Stage Events), §10.1.3 (Compliance Dossier), §10.2 (Generation Contract), §10.3 (Evidence-Only), §11 (Trust Gate), §21 (Experience Layer), §23.2 (API), §28 (Evaluation).
3. `BISVEDA_V8_Research_Report.md` §6: UI/UX characteristics U1–U28. They are **ideas to implement originally**, not code or layouts to copy.

If the docs conflict, the Prototype doc wins for scope and the Architecture doc wins for behaviour. Record every conflict in `docs/DECISIONS.md` and don't guess silently.

## Team (run as parallel agents with separate workspaces)

| Agent | Owns | Must not touch without a handoff |
|---|---|---|
| **Lead / Architect** | Repo skeleton, `bisveda/contracts`, OpenAPI, CI, `docs/DECISIONS.md`, `docs/STATUS.md`, reviews every merge | — |
| **Data Engineer** | `connectors/`, `taxonomy/`, `data/seed`, `data/snapshots`, migrations for L0/L3 tables | Retrieval scoring |
| **Ingestion Engineer** | `ingestion/`, `media/` validation, job events, outdated-reference checker, Admin Ingestion Console API | Frontend |
| **Retrieval & Trust Engineer** | `language/`, `routing/`, `retrieval/`, `adjudication/`, `trust/`, calibration | Generation prompts |
| **Orchestration Engineer** | `orchestration/`, `agents/`, `generation/`, `models/` registry, stage events, dossier builder, exports | Adjudication logic |
| **Frontend Engineer** | `apps/web` (design system first, then pages), SSE reducer, i18n, accessibility | API contracts (request changes via Lead) |
| **QA & Evaluation Engineer** | `eval/`, `data/eval` suites, Playwright + axe, red-team cases, Quality page data, chaos-lite tests | Product code (files issues instead) |

## Non-negotiable rules

1. **Contracts first.** Before feature code, the Lead publishes Pydantic contracts for `EvidencePackage`, `Adjudication`, `Dossier`, `StageEvent`, `JobEvent`, `SlotSchema`, `TrustResult`, and generates OpenAPI and the TypeScript client. Nobody changes a contract without a Lead-approved PR.
2. **Adjudicate before generating.** Applicability, grounding state, confidence label, QCO status, eligibility and the citable set are computed deterministically. The generation `SlotSchema` must not contain fields for any of them; a test must assert this.
3. **Tier honesty.** Every standard, document and chunk carries `knowledge_tier`. No numeric limits, test values or clause quotes for Tier A standards. The Trust Gate enforces this and a test proves it.
4. **Evidence classes.** Only `official_source` items get `[S#]`. User context, uploads, OCR/VLM/ASR output are `user_provided`, wrapped in tags, never citable. Unresolved markers are stripped after bracket normalisation (`【S1】`, `［S1］` → `[S1]`).
5. **Real progress only.** The UI renders a stage only after receiving its `stage.started` event. No timers that fake progress.
6. **Works without an LLM.** `GENERATION=none` must produce a complete evidence-only Dossier. Provider chain: zero retries per provider, 60 s cooldown, terminal evidence-only.
7. **No fabricated data.** Fixtures are marked `verification_status='demo'` and badged **DEMO DATA** in the UI; they are excluded from evaluation. Never type a standard number, title, QCO, fee, lab or date from memory into seed data. It must come from a connector, a seed file with a source URL and checksum, or be marked demo.
8. **No copying.** Do not copy code, layouts, copy text, assets, logos or branding from any reference repository or site. BISVEDA uses its own name, mark and palette. No BIS logo, national emblem, or claims of being an official BIS service.
9. **Security.** Secrets only in `.env` (provide `.env.example`); validate every input; magic-byte MIME checks; EXIF strip; ClamAV when enabled; admin routes behind JWT with argon2 hashes; SSRF allowlist for connectors; no PII or secrets in logs; CORS locked; dependency audit and secret scan in CI.
10. **Small, modular files.** Keep files under about 400 lines with one responsibility each. Every external dependency sits behind the interfaces listed in Prototype §13.
11. **Measured, not claimed.** Numbers appear in README or UI only if they come from a stored eval run (`eval_runs`), with date and suite ID. `docs/STATUS.md` lists what works, what is partial, and what is deferred.
12. **Respect sources.** Connectors throttle to 1 req/s per host, cache to disk, send an honest User-Agent, stay on the host allowlist, and fail loudly on schema drift or taxonomy invariant violations.

## Milestones (from Prototype §16). Each ends with a demo to the Lead.

- **M0 Foundations:** skeleton, compose (Postgres 16 + pgvector + PostGIS + pg_trgm; api; web; optional clamav), Alembic migrations for Prototype §7 tables, config + `model_registry.yaml`, contracts, OpenAPI → TS client, CI (ruff, mypy, pytest, eslint, tsc, vitest, audit, secret scan). *Exit:* `make up` is healthy and contract tests pass.
- **M1 Data:** catalogue connector for priority product groups (with Hindi titles where provided), labs (Group 1/2), AHC, QCO list, What's New, official FAQs; Tier B seed list; snapshots; taxonomy invariants. *Exit:* provenance on every row, invariants pass, run reports stored.
- **M2 Ingestion:** job runner + steps + `ingestion_job_events` + SSE; identity/wrong-document; outdated-reference checker; Admin Ingestion Console API. *Exit:* a PDF upload streams every real step to publish; a mislabelled file is quarantined.
- **M3 Retrieval & Adjudication:** normaliser, Stage-1 rules (incl. gibberish), Stage-2 router, exact-first, dense+FTS+taxonomy, RRF, reranker, `make calibrate` for the relevance floor, full Adjudicator, Evidence Package v2. *Exit:* first Measured numbers for `product-match` and `refusal-calibration`.
- **M4 Orchestration & Trust:** LangGraph plan shapes, agents AG1/2/4/5/6/AGF (AG3 tier notice, AG7 minimal, AG8 simple), Dossier builder + PDF export, Generation Contract, evidence-only renderer, Trust Gate checks, translation with marker/lock survival, stage events. *Exit:* flows A, B, S, T, U, V, W pass through the API.
- **M5 Experience Layer:** design-system primitives (V8 §21.5), then Home, Research workspace, Passport, Compare, Certification, Testing & Labs map, Consumer, Updates, Documents, Admin, Quality, and the site-wide assistant. *Exit:* Playwright E2E and axe are green; responsive at 375/768/1280.
- **M6 Multimodal & Voice:** media handler, pyzbar, vision candidates, image flow, Web Speech + server ASR fallback, TTS in the answer's language. *Exit:* image and voice flows pass.
- **M7 Evaluation & Polish:** the full ≈ 360-case run, red-team, Quality page, offline demo mode from snapshots, demo script in `docs/DEMO.md`. *Exit:* pilot Targets are met or honestly reported.
- **M8 Stretch:** Form I draft (Scheme-I, two product categories) with provenance, amber confirmations, draft watermark and Manak Online crosswalk.

## Working protocol

- Each agent opens a plan artifact before coding: files it will create, contracts it depends on, tests it will add.
- Commit small. Every PR includes tests, updates `docs/STATUS.md` if behaviour changed, and has a Lead review.
- Cross-agent requests go through `docs/HANDOFFS.md`: requester, need, contract impact, owner, status.
- Browser verification: the Frontend and QA agents check each page in the browser at three widths and attach screenshots to the PR.
- Blocked for more than one attempt on an external dependency (API key, endpoint down)? Implement the null/fallback provider, mark the feature *partial* in STATUS.md, and continue.

## Definition of done (whole prototype)

- `make up && make ingest SNAPSHOT=latest && make calibrate && make eval && make e2e` all succeed on a clean machine.
- Flagship flow B works in English and Hindi, streams real stages, and exports a Dossier PDF with an evidence ledger.
- Honesty flows work: out-of-corpus refusal names the boundary; a Tier A numeric question yields a tier notice; gibberish skips retrieval; an injected instruction in an upload is ignored and logged; a translation that loses a marker falls back to English.
- `GENERATION=none` produces full evidence-only answers.
- The Admin Ingestion Console shows a real upload through to publish.
- The Quality page shows a stored eval run.
- No DEMO DATA appears unbadged, and no BIS branding appears anywhere.
- `docs/STATUS.md` is accurate.

## First action

Lead / Architect: read all three documents, write `docs/DECISIONS.md` covering open choices (concrete hosted model names verified as currently served, local model tag, Tesseract vs Docling OCR for scanned pages, PIN-centroid dataset source), publish the M0 plan, and wait for the human lead's go-ahead before any agent writes feature code.