# BISVEDA — Design System & UX Reference

> **Architecture Reference:** V8 §21 (Experience Layer)
> **Framework:** Next.js (App Router), TypeScript
> **Styling:** Tailwind CSS

---

## 1. Design Principles

| # | Principle | Implication |
|---|---|---|
| 1 | Service before AI | Lead with what users need, not what the AI can do |
| 2 | Search before conversation | Start with structured search; conversation is a depth tool |
| 3 | Evidence before confidence | Show sources first, synthesis second |
| 4 | Clarify instead of hallucinating | Ask for missing info rather than guessing |
| 5 | Explain every recommendation | Every standard candidate has a "why" with coverage rationale |
| 6 | Separate fact from inference | Official sources, user-provided data, and AI interpretation are visually distinct |
| 7 | Progressive disclosure | Summary → details → source text → document |
| 8 | Every screen has a next action | Dead ends are design failures |
| 9 | Never fake progress (A16) | Stage animations only on real events |
| 10 | Never communicate meaning by colour alone | All status conveyed via text + icon + colour |

---

## 2. Visual Identity

### 2.1 Colour Palette

| Token | Value | Usage |
|---|---|---|
| `--navy-primary` | `#002147` / `#001529` | Primary brand, headers, navigation |
| `--saffron-accent` | `#FF9933` / `#E65100` | CTAs, alerts, highlights |
| `--emerald-verified` | `#10B981` | Verification states, NABL accreditation |
| `--surface-light` | `#F8FAFC` | Page backgrounds (light mode) |
| `--surface-dark` | `#0F172A` | Page backgrounds (dark mode) |
| `--text-primary` | `#1E293B` / `#E2E8F0` | Body text |
| `--border` | `#E2E8F0` / `#334155` | Thin borders, dividers |

### 2.2 Typography

- **IS Numbers:** Monospaced (`font-mono font-black`) — e.g., `IS 2347:2017`
- **Headings:** System sans-serif stack with strong hierarchy
- **Body:** Regular weight, 1.6 line-height
- **Indic scripts:** Tuned line-height, no clipped matras

### 2.3 Branding Rules

- BISVEDA's **own name, mark, and palette** only
- No BIS logo, no national emblem, no "© Bureau of Indian Standards" claims
- Official ministry/BIS identity referenced but not appropriated
- Light/dark theme support throughout

---

## 3. Information Architecture

### 3.1 Primary Navigation

`Home · Standards · Certification · Testing & Labs · Consumer · Updates · Documents · About`

### 3.2 Utility Bar

Skip link · Screen-reader access · Language selector · Mode selector (Consumer / Business / Student / Lab) · Theme toggle

### 3.3 Route Map

| Route | Surface | Key Elements |
|---|---|---|
| `/` | Search-first home | Hero input, service cards, How It Works, research history, updates rail |
| `/research/[id]` | Research workspace | 3-panel: Sources / Dossier+Research thread / Workspace |
| `/standards` | Knowledge base | Search, filters, multi-select compare |
| `/standards/[id]` | Standard Passport | Fact grid, tier badge, explain simply, actions |
| `/certification` | Certification hub | 5-step pathway, wizard, scheme explorer |
| `/testing` | Labs & AHCs | List/Map toggle, distance, scope filters |
| `/consumer` | Consumer services | Mark verifier, complaints, recalls |
| `/updates` | Updates feed | Weekly groups, category filters |
| `/documents` | Document workspace | Upload, identity, outdated-reference report |
| `/forms/form-i` | Form I preparation | Field groups, provenance, draft PDF |
| `/compare` | Comparison | Side-by-side facts, amendment diffs |
| `/admin/*` | Admin | Sources, Ingestion Console, review queues, Quality page |
| `/quality` | Public Quality page | Latest eval summary |

---

## 4. Design System Primitives

### 4.1 Implemented ✅

| Component | Purpose |
|---|---|
| `SearchHero` | Centered hero with action triggers & example queries |
| `ServiceCard` | 2×3 "What can BISVEDA do for you?" grid |
| `StandardCard` | Standard with scope & applicability rationale |
| `ApplicabilityBadge` | DIRECTLY_APPLICABLE / POTENTIALLY_APPLICABLE badges |
| `GroundingBadge` | Verified BIS Finding / Verified against BIS sources |
| `VerificationBadge` | VERIFIED / PROVISIONAL badges |
| `SourceTag` | official: solid · user: neutral · AI: outlined |
| `EvidenceCitation` | `[S1]`, `[S2]` inline statutory citations |
| `EvidenceLedger` | Sources & Evidence Panel (right rail) |
| `WhyPanel` | Statutory rationale per candidate standard |
| `ClarificationCard` | Pre-RAG ambiguity trap with options |
| `RefinementChips` | Dynamic product specifications & measurement pills |
| `StageList` | SSE real-time stream status indicator |
| `LabMap` | Interactive Leaflet/OSM with custom pins & popups |
| `Roadmap` | Scheme-I sequential roadmap & MSME checklist |

### 4.2 Planned ❌

| Component | Purpose |
|---|---|
| `PassportHeader` | Standard identity with all badges |
| `FactGrid` | Structured fact display for standards |
| `EmptyState` | Explain what happened, why, what to do next |
| `ErrorState` | Typed: API / retrieval / AI / source / validation |
| `InsufficientEvidence` | Named gap + next action |
| `FeedbackControl` | Typed reasons + honest confirmation |
| `JobTimeline` | Ingestion job event timeline |
| `ConflictPanel` | Multiple editions / superseded evidence |
| `CoveragePanel` | Query dimension coverage per candidate |
| `TierBadge` | Catalogue / Public Full Text / Licensed Full Text |
| `DossierSection` | Expandable/collapsible dossier section |

---

## 5. Key Interactions

### 5.1 Streaming Dossier

Stage list shows **only received stages** (A16). Sections slide in on `section.ready`. Prose streams into the summary slot via `answer.delta`.

### 5.2 Refinement Chips

Missing product attributes as chips: `+ Grade 304`, `+ Vacuum insulated`, `+ Domestic use`. Active parameters row with undo.

### 5.3 Clarification Card

Question, short rationale, selectable options, free text input, continue button.

### 5.4 Evidence Classes (Visual)

| Class | UI Treatment |
|---|---|
| `official_source` | Solid filled tag "Official source" (emerald) |
| `user_provided` | Neutral tag "You provided" (grey) |
| `ai_interpretation` | Outlined tag "AI interpretation" (dashed border) |

### 5.5 Applicability Classes (Visual)

| Class | Badge Style |
|---|---|
| `directly_applicable` | Solid green |
| `potentially_applicable` | Amber outline |
| `related_standard` | Grey |
| `related_material_mismatch` | Red outline |
| `scope_unclear` | Dashed grey |
| `insufficient_evidence` | Light grey |
| `not_applicable` | Crossed out |

---

## 6. Responsive Behaviour

- **Desktop (≥1200px):** 3-panel research workspace (Sources / Dossier / Workspace)
- **Tablet (768–1199px):** 2-panel with collapsible sidebar
- **Mobile (<768px):** Tabbed layout (swipe between panels)

Components designed for their **container**, not the viewport.

---

## 7. Accessibility

- WCAG 2.1 AA target
- `role="status"` live regions for stage updates
- Keyboard-complete workspace with panel focus cycling
- `prefers-reduced-motion` honoured (no decorative animations)
- axe-core checks in CI
- Focus management on route transitions
- Never colour alone for status communication

---

## 8. Motion & Animation

- **Allowed:** Stage completion ticks, section entry, panel collapse, loading states
- **Forbidden:** Decorative loops, timed fake progress, gratuitous transitions
- All motion respects `prefers-reduced-motion`
