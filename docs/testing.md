# BISVEDA — Testing Strategy & TDD Reference

> **Architecture Reference:** V8 §28
> **Convention:** All metrics are **Targets** until a recorded run makes them **Measured**

---

## 1. Testing Philosophy

```
Unit tests → Integration tests → E2E tests → Eval suites → Quality page
                                                              ↑
                                                   Published measurements
```

Every metric published on the Quality page must be a **measurement**, not a claim.

---

## 2. Evaluation Suites (13 suites, ~360 pilot cases)

| Suite ID | Content | Pilot Size | Production Size |
|---|---|---|---|
| `golden-standards` | Exact lookups, clause Q&A (Tier B/C), tier-policy cases | 60 | 2,000 |
| `product-match` | Colloquial/trade names → standards (incl. Hindi/Hinglish) | 60 | 500 |
| `qco` | Mandatory/voluntary, dates | 25 | 300 |
| `certification` | Scheme routes, eligibility | 25 | 300 |
| `labs` | Scope + distance | 15 | 300 |
| `consumer` | CM/L/HUID shapes, complaints, recalls | 15 | 200 |
| `refusal-calibration` | In-corpus vs out-of-corpus pairs for floor calibration | 40 | 400 |
| `red-team` | Gibberish, fictional products/standards, prompt injection (text/upload/image), topic switch, rewrite corruption, fake QCO bait | 40 | 500 |
| `multilingual-survival` | Answers translated to each language; marker/lock/number survival | 30 | 1,000 |
| `multi-turn` | Anaphora and topic switches | 15 | 100 |
| `document-review` | Outdated-reference detection | 10 | 150 |
| `multimodal` | Packaging photos, marks, HUID images | 10 | 200 |
| `voice` | Clean/noisy Hindi/English/Hinglish | 10 | 200 |
| `form-i` | Field extraction/validation | 5 | 150 |
| **Total** | | **≈ 360** | **≈ 6,300** |

---

## 3. Gated Metrics

No model, threshold, or index change is promoted without passing these:

| Metric | Target (Pilot) | Target (Production) |
|---|---|---|
| False-standard rate (IS not in evidence) | **0** on golden set | **0** |
| Citation marker validity after Trust Gate | **100%** | **100%** |
| Candidate recall@5 (product → standard) | ≥ 0.85 | ≥ 0.92 |
| Out-of-corpus refusal precision / recall | ≥ 0.90 / ≥ 0.90 | ≥ 0.95 / ≥ 0.95 |
| Grounding-state agreement with human labels | ≥ 0.85 | ≥ 0.92 |
| QCO status accuracy | ≥ 0.98 | ≥ 0.99 |
| Faithfulness (NLI + judge) | ≥ 0.90 | ≥ 0.95 |
| Marker & lock survival per supported language | ≥ 0.98 | ≥ 0.99 |
| Intent accuracy (Stage 1+2) | ≥ 0.90 | ≥ 0.95 |
| Fast-path share | ≥ 25% | ≥ 40% |
| p95 latency (exact-ID / FAQ) | < 300ms | < 200ms |
| p95 latency (first stage event) | < 500ms | < 300ms |
| p95 latency (full dossier) | < 15s | < 10s |
| WCAG 2.1 AA automated violations (axe) | 0 serious/critical | 0 |

---

## 4. Test Categories

### 4.1 Unit Tests

| Area | What to Test | Framework |
|---|---|---|
| Adjudicator | 9-step pipeline (coverage, applicability, grounding, claim policy) | Vitest/Jest |
| Speed Gate | Exact-ID matching, FAQ matching, cache hits/misses | Vitest/Jest |
| Language Gateway | LID detection, Hinglish normalization, Terminology Lock | Vitest/Jest |
| Context Resolver | Anaphora resolution, entity tracking, topic switches | Vitest/Jest |
| Guardrails | Marker resolution, candidate-set check, tier enforcement | Vitest/Jest |
| Evidence-Only Mode | Template rendering from adjudicated package | Vitest/Jest |
| Taxonomy | Synonym resolution, product group matching | Vitest/Jest |
| Outdated Checker | IS citation extraction, freshness determination | Vitest/Jest |

### 4.2 Integration Tests

| Area | What to Test | Dependencies |
|---|---|---|
| Retrieval Pipeline | Query → embed → pgvector → FTS → exact-first → results | PostgreSQL |
| Ingestion Pipeline | Upload → parse → chunk → embed → store | PostgreSQL + MinIO |
| Agent Dispatch | Intent → agent selection → structured output | LLM provider |
| Dossier Builder | Agent outputs → assembled dossier | All agents |
| Full Pipeline | Query → response (end-to-end) | All services |

### 4.3 End-to-End Tests (Playwright)

| Flow | Scenario | Coverage |
|---|---|---|
| Flow A | Simple lookup: "IS 456 kya hai?" | Speed Gate → Passport |
| Flow B | MSME flagship: "Steel bottle ka standard…" | Full pipeline → Dossier |
| Flow S | Out-of-corpus: "LED strip for aquarium" | Refusal with boundary |
| Flow U | Metadata-only numeric: "Hydrostatic pressure in IS X" | Tier notice |
| Flow X | Document review: upload test report | Outdated-reference report |
| Flow Y | Admin ingestion: upload scheme PDF | Ingestion Console timeline |

### 4.4 Accessibility Tests

- axe-core automated audits in CI
- Keyboard navigation verification
- Screen reader compatibility (NVDA/VoiceOver)
- Focus management on route transitions
- Visual regression on design-system primitives

---

## 5. Current Test Matrix

The prototype has a test matrix (`test_matrix.ts`) with 15 cases:

| Test Case | Category | Status |
|---|---|---|
| IS 456 lookup | `golden-standards` | ✅ Pass |
| IS 2062 lookup | `golden-standards` | ✅ Pass |
| Steel bottle standard | `product-match` | ✅ Pass |
| Helmet ISI mark | `product-match` | ✅ Pass |
| PVC pipe standard | `product-match` | ✅ Pass |
| CM/L verification | `consumer` | ✅ Pass |
| HUID verification | `consumer` | ✅ Pass |
| Labs near Pune | `labs` | ✅ Pass |
| Scheme-I certification | `certification` | ✅ Pass |
| QCO mandatory check | `qco` | ✅ Pass |
| Hinglish query | `multilingual-survival` | ✅ Pass |
| Hindi query | `multilingual-survival` | ✅ Pass |
| Out-of-scope | `red-team` | ✅ Pass |
| Multi-turn follow-up | `multi-turn` | ✅ Pass |
| Complex MSME query | `product-match` | 🔧 Environment |

---

## 6. TDD Workflow

### 6.1 For New Features

```
1. Write eval case(s) for the feature (add to appropriate suite)
2. Run eval suite → verify case(s) fail (RED)
3. Implement the feature
4. Run eval suite → verify case(s) pass (GREEN)
5. Refactor if needed
6. Run full regression → verify no metric drops > 5%
7. Commit with eval results attached
```

### 6.2 For Bug Fixes

```
1. Identify the failing scenario
2. Add it as a test case in the appropriate suite
3. Run → verify it fails (confirms the bug)
4. Fix the bug
5. Run → verify it passes
6. Run full regression
```

### 6.3 For Model Changes

```
1. Run full eval suite on current model → record baseline
2. Switch to candidate model
3. Run full eval suite → record results
4. Compare: any gated metric regressed?
   - YES → reject candidate
   - NO → promote candidate (after human review)
5. Update Quality page with new measurements
```

---

## 7. Regression Gates

**Auto-rollback trigger:** Any gated metric drops > 5% relative from the last measured baseline.

This applies to:
- Model changes (reasoning, vision, embedding, reranker)
- Index changes (embedding model, chunking strategy)
- Threshold changes (relevance floor, cache thresholds)
- Taxonomy changes (product groups, synonym dictionary)
- Prompt changes (system prompts, slot schemas)

---

## 8. Quality Page

Public page (`/quality`) listing:
- Latest run date
- Engine version
- Model configuration
- Each gated metric with Measured value and pass/fail
- Known limitations

Admin view adds: links to failing cases, drill-down by suite.

---

## 9. Continuous Integration

```
PR opened →
  1. Unit tests (Vitest)
  2. Integration tests (with local PostgreSQL)
  3. Accessibility audit (axe-core)
  4. Visual regression (design-system primitives)
  5. Eval suite (subset: golden + red-team)
  → All pass? → Merge allowed

Main branch merge →
  1. Full eval suite (all 13 suites)
  2. Results written to eval_runs / eval_results
  3. Quality page updated
  → Any regression? → Auto-rollback + alert
```
