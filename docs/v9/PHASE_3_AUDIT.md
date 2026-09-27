# BISVEDA V9 — Phase 3 Audit: Minimal UI (Chat Workspace + Landing Page)

**Date**: September 27, 2026  
**Auditor**: Antigravity Build Agent  
**Target**: Transform the UI into a clean, authoritative single-column chat workspace and 1-screen landing page conforming to the PPT specification, design tokens, and V9 response contract.

---

## 1. What Exists Today vs. Required State

| Component / File | Current State | Required State in Phase 3 |
|---|---|---|
| `prototype/src/app/globals.css` | 157 lines with legacy V8 palette (`#063b73`, `--color-gold`, etc.) and non-token names | Replace with strict V9 tokens: `--bg: #FFFFFF`, `--bg-subtle: #F7F8FA`, `--border: #E5E7EB`, `--text: #0F172A`, `--text-muted: #64748B`, `--primary: #0B2A4A`, `--accent: #E8710A`, `--ok: #15803D`, `--warn: #B45309`, `--danger: #B91C1C`. Zero gradients, zero background images. |
| `prototype/src/app/page.tsx` | 713 lines loading 14 heavy panels simultaneously (`WorkspaceContextPanel`, `SourcesEvidencePanel`, `SchemeWizard`, `LabLocator`, `MarkVerifier`, `EmployeePipeline`, etc.) | Clean, 1-screen landing page fitting in 1280×800 without scrolling. Single input, 4 example chips, 3 action tiles, clean header & footer. Submitting query navigates to `/chat/[id]?q=...`. |
| `prototype/src/components/layout/Navbar.tsx` | 53KB file with Government headers, 9-item mega menu, fake officer identity, "Saved" counter, etc. | Replace with clean `AppHeader` (~70 lines): logo mark (`◆ BISVEDA`), 3 navigation links (`Standards · Labs · Certification`), and Hindi/English language toggle. |
| `prototype/src/components/layout/Footer.tsx` | 179 lines with 3 link columns, "Connect with BIS", fake help desk | Replace with clean `AppFooter` (~50 lines): "Prototype for Smart India Hackathon 2026 · PS 26107", "About", and "Staff login". |
| `prototype/src/components/home/LandingPageView.tsx` | 595 lines with blueprint background, complex action row, 6-card grid, 4-step diagram, update lists | Replace with minimal landing view: centered hero, single search input with attachment/mic icons, 4 product pills (`Helmet for bikes`, `Pressure cooker`, `Toys for kids`, `Gold 22K`), and 3 quick action tiles. |
| `prototype/src/app/chat/` | Route does not exist! Chat was awkwardly embedded in `page.tsx` with dual state machines | Create dedicated `/chat/[id]/page.tsx` (and `/chat/page.tsx`) with 240px collapsible sidebar and 760px centered chat column. |
| `prototype/src/app/api/chat/route.ts` | 20 lines calling legacy `executeQueryPipeline` from V7/V8 | Update to invoke V9 `runPipeline` from `@/lib/pipeline/orchestrator` with live SSE event streaming (`understand`, `search`, `check`, `write`) and unified `BisvedaResponse`. |
| Chat Experience Components (`MainResearchExperience`, `ChatPanel`, etc.) | Over 1,500 lines across 7 files with complex Perplexity accordions, spec sliders, persona tabs, and hardcoded confidence badges | Build clean, single-responsibility components under ~200 lines each reading `BisvedaResponse`: `AppHeader`, `AppFooter`, `ChatSidebar`, `Composer`, `UserMessage`, `WorkingSteps`, `AnswerCard`, `QcoLine`, `CitationPill`, `DetailTabs` (`StandardsList`, `CertificationSteps`, `LabsList`, `LabsMap`), `SourceDrawer`, `ClarifyMessage`, `RefusalMessage`, `FollowUps`. |

---

## 2. Actual Bugs & Anti-Patterns Identified

1. **Stale V8 Pipeline in Chat API** (`prototype/src/app/api/chat/route.ts` Line 13):
   - `api/chat` was importing `executeQueryPipeline` from `lib/llm-provider.ts` instead of the V9 pipeline in `lib/pipeline/orchestrator.ts`.
   - Result: `/api/chat` completely bypassed the 12-stage V9 architecture, speed-gate, and grounding safeguards.
2. **Page State Leakage & Bloat** (`prototype/src/app/page.tsx` Lines 95–130):
   - `page.tsx` was maintaining 25+ useState hooks for dozens of sub-modals, causing re-render storms and cross-session state leaks.
3. **Cluttered Multi-Column Layout Violating PPT Design**:
   - `MainResearchExperience.tsx` used a three-column layout with persistent left context panel and right evidence panel, leaving the actual chat message cramped and obscured.
   - The PPT design mandates **ONE clean chat column (max-width 760px centered)**.
4. **Forbidden Words in Code and UI**:
   - Files contain words forbidden by Part 0 §0.5: `statutory`, `sovereign`, `NotebookLM`, `corpus boundary`, `zero-shot`, `provenance`, etc.
   - All forbidden words must be purged from user-facing strings and DOM elements.
5. **Modal vs. Drawer Conflict for Sources**:
   - Existing code opens `PdfSourceViewerModal` as a blocking full-screen modal.
   - PPT specification explicitly requires a **right-side slide-over drawer** (`SourceDrawer`) that preserves the chat context and allows side-by-side reading.
6. **Hardcoded Metrics & Confidence Badges**:
   - Legacy cards showed "95% OCR Clarity", "100% Extraction", and synthetic distance estimates without real user geocoordinates.
   - Must show only real data from `BisvedaResponse`.

---

## 3. Removals Inventory (Per Spec §3.2)

### Global / Header Removals
- [x] Government strip ("Government of India | Ministry of Consumer Affairs...", skip links, screen reader text, font controls)
- [x] Ministry / BIS logo lock-ups and "© Bureau of Indian Standards"
- [x] 9-item mega menu dropdowns (Standards, Certification, Testing, Resources, e-Services, etc.)
- [x] "Officer Dashboard" button from header (already moved to footer "Staff login" in Phase 2)
- [x] Fake signed-in identity "Dr. A. K. Verma, BIS Officer"
- [x] "Saved" button with counter badge
- [x] "AI" superscript badge on the logo

### Landing Page Removals
- [x] Blueprint background image and gradients
- [x] Long subtitle "AI-powered regulatory intelligence..."
- [x] "EN" pill inside search input
- [x] "Actions:" row (Upload Image / Camera / Upload Document)
- [x] "Check Certification Route · Wizard" button
- [x] 6-card "COMPREHENSIVE STATUTORY INTELLIGENCE" grid
- [x] 4-step "How BISVEDA Works" diagram
- [x] "Recent Regulatory Research" list from landing view
- [x] "Latest BIS Updates" list from landing view
- [x] Large 3-column footer and social links

### Chat Workspace Removals
- [x] Left "Workspace Context" panel
- [x] Right permanent "Evidence" column
- [x] Header bar with "RESEARCH SESSION" label and repeated title
- [x] "Viewing as: MSME/Startup · Consumer · Researcher/Lab" persona tabs
- [x] "Natural conversational search enabled" caption
- [x] "USER QUESTION" and "VERIFIED BIS FINDING" uppercase headers
- [x] Internal prose subheadings ("Standard Applicability Rationale", "Licensing & Certification Roadmap")
- [x] "Recommended specifications for your product" chip blocks after the answer
- [x] 5-accordion "STATUTORY COMPLIANCE DOSSIER"
- [x] `DIRECTLY_APPLICABLE` / `SCOPE_UNCLEAR` / `NOT_APPLICABLE` enum chips
- [x] Default visible map
- [x] Out-of-corpus refusal text with "Axiom A1 / §11.4" and "Corpus Boundary Notice"

---

## 4. Components to Build (Under ~200 Lines Each)

All components read `BisvedaResponse` or `StageEvent` directly and compute zero facts:
1. `AppHeader.tsx`: Minimal navbar with BISVEDA wordmark, 3 links (`Standards`, `Labs`, `Certification`), and Hindi/English language toggle.
2. `AppFooter.tsx`: Clean footer with PS disclaimer, About link, and Staff login.
3. `ChatSidebar.tsx`: 240px collapsible drawer with "+ New chat", recent user chats, links, and guest profile.
4. `Composer.tsx`: Clean bottom input with attachment trigger, placeholder, and send icon.
5. `UserMessage.tsx`: Right-aligned clean bubble with optional photo thumbnail.
6. `WorkingSteps.tsx`: Live 4-stage event stepper (`understand`, `search`, `check`, `write`) that collapses to "Answered in X.Xs · N sources".
7. `AnswerCard.tsx`: Formatted answer with 16px bold headline, QCO line, bulleted points, soft callout next steps, sources summary, and overflow menu (`Copy`, `Export`, `Explain simply`).
8. `QcoLine.tsx`: Distinct visual indicator for QCO status (red left border for `mandatory`, amber for `notified_not_in_force`, muted for `unknown`).
9. `CitationPill.tsx`: Clickable `[S#]` superscript pill opening `SourceDrawer`.
10. `DetailTabs.tsx`: 4 inline toggleable tab buttons (`Standards`, `Certification`, `Labs`, `Sources`) expanding one at a time.
    - `StandardsList.tsx`: List of `applies`, `may_apply` (with `why`), and collapsed `related`.
    - `CertificationSteps.tsx`: Scheme name and numbered steps with citations.
    - `LabsList.tsx`: Recognised labs with city, state, distance (if location permitted), and "Show map" toggle.
    - `LabsMap.tsx`: Lazy-loaded OpenStreetMap/Leaflet view.
11. `SourceDrawer.tsx`: Right slide-over drawer with source title, clause, page, excerpt with highlighted citation, official URL link, and stored PDF viewer.
12. `ClarifyMessage.tsx`: Question with clickable option chips for disambiguation (e.g. Motorcycle IS 4151 vs Industrial IS 2925).
13. `RefusalMessage.tsx`: Polite plain message with official next steps links.
14. `FollowUps.tsx`: 1–3 suggestion chips above the composer.

---

## 5. Files to Create, Modify, or Retire

### Files to Create
- `prototype/src/app/chat/page.tsx`: Redirect or wrapper to `/chat/[id]`.
- `prototype/src/app/chat/[id]/page.tsx`: Dedicated PPT-layout chat workspace.
- `prototype/src/components/chat/v9/`: Modular V9 chat components (`AppHeader.tsx`, `AppFooter.tsx`, `ChatSidebar.tsx`, `Composer.tsx`, `UserMessage.tsx`, `WorkingSteps.tsx`, `AnswerCard.tsx`, `QcoLine.tsx`, `CitationPill.tsx`, `DetailTabs.tsx`, `StandardsList.tsx`, `CertificationSteps.tsx`, `LabsList.tsx`, `LabsMap.tsx`, `SourceDrawer.tsx`, `ClarifyMessage.tsx`, `RefusalMessage.tsx`, `FollowUps.tsx`).

### Files to Modify
- `prototype/src/app/globals.css`: Replace tokens with strict V9 palette; eliminate all gradients, glow, and heavy drop shadows.
- `prototype/src/app/page.tsx`: Rebuild as 1-screen landing page fitting in 1280×800.
- `prototype/src/app/api/chat/route.ts`: Wire to V9 `runPipeline` with SSE stage event streaming.

### Legacy Files to Retire / Delete
- `prototype/src/components/chat/ChatPanel.tsx` (54KB)
- `prototype/src/components/chat/MainResearchExperience.tsx` (28KB)
- `prototype/src/components/chat/PerplexityDossierAccordions.tsx` (20KB)
- `prototype/src/components/chat/LandingConversationalFlow.tsx` (32KB)
- `prototype/src/components/chat/EvidenceLedger.tsx` (8KB)
- `prototype/src/components/home/LandingPageView.tsx` (24KB)

---

## 6. Acceptance Verification Plan

1. **Landing Page**:
   - Verify single search bar, 4 product pills (`Helmet for bikes`, `Pressure cooker`, `Toys for kids`, `Gold 22K`), 3 role cards, and "Try an example" button.
   - Verify fits in one screen at 1280×800 without scrolling.
2. **Search Navigation**:
   - Submitting search navigates to `/chat/[id]?q=...` with question pre-loaded and streaming.
3. **Chat Workspace**:
   - Single column (max-width 760px centered), clean message bubbles, primary standard pill above answer with status dot and QCO badge.
4. **Answer Presentation**:
   - Headline bold, bulleted points, next steps in soft callout box.
5. **Inline Details & Sources Drawer**:
   - Detail tabs expand inline under answer (`Standards`, `Certification`, `Labs`, `Sources`).
   - Clicking `[S#]` pill opens the right slide-over `SourceDrawer` with highlighted excerpt and PDF viewer.
6. **Disambiguation**:
   - Query "helmet" renders `kind: "clarify"` options (Motorcycle IS 4151 vs Industrial IS 2925).
7. **Outdated Reference Badge**:
   - Query "IS 14543:2004" displays inline notification "Superseded by IS 14543:2024".
8. **Forbidden Words Crawl**:
   - Script crawls rendered DOM of `/` and `/chat/[id]` ensuring zero occurrences of forbidden terms.
9. **Zero Regression (`eval:rag`)**:
   - `npm run eval:rag` passes 25/25 golden tests.
