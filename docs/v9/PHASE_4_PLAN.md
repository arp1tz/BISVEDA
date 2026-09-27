# BISVEDA V9 — Phase 4 Implementation Plan: Photo Inspector Honesty & Conversational Vision
**Date:** September 27, 2026  
**Status:** Plan Proposed — Awaiting Human Lead Sign-Off before Implementation  
**Auditor & Planner:** Antigravity Build Agent  

---

## 1. Executive Objectives

Phase 4 bridges the **visual inspection engine** into the **grounded conversational pipeline** while strictly enforcing the honesty rules established in Part 0 and Phase 4 of the V9 Build Spec:
1. **Multimodal Conversational Flow:** Users can attach or snap a photo of a product, packaging, or ISI mark directly in the chat composer (`/chat/[id]`) or from the landing page (`/`). The assistant inspects the image, extracts product features and labels, engages in multi-turn conversation, and cross-questions when ambiguous.
2. **Honesty & Data Sanitization:**
   - Eliminate all fake mock licensee companies (e.g., *"Sovereign Protective Gear Manufacturing Pvt. Ltd."*, *"Apex Cookware Ltd."*).
   - Eliminate all fake confidence percentage ledgers (OCR 95%, Extraction 95%, KB 100%).
   - Replace with a verbatim *"What we read on the label"* box showing `label_text` exactly as captured.
   - Fix CM/L normalization to prevent double prefix (`CM/L-CM/L-3112329` $\to$ `CM/L-3112329`).
   - Eliminate synthetic distances ("~12 km") without user location.
3. **State Isolation & Zero State Leaks:**
   - Selecting a new photo or opening the inspector resets all previous state. No leftover helmet data when inspecting coffee or unreadable photos.
4. **Conversational Cross-Questioning & Graceful Rejection:**
   - Ambiguous product images (e.g. unmarked helmet) trigger `kind: "clarify"` asking clarifying questions with option chips ("Two-Wheeler Motorcycle (IS 4151)" vs. "Industrial Safety (IS 2925)").
   - Non-product or unreadable images (e.g. coffee, scenery) return an honest refusal: *"This looks like <product_guess>. We couldn't find an Indian Standard or ISI mark for it in our sources."* Hide QCO, testing clauses, labs, and scheme tabs.
5. **Deterministic Pipeline Bridge:**
   - Product and standard candidates from vision (`product_guess`, `is_numbers`) flow directly through the Phase 1 adjudicator (`adjudicateCandidates()`).
   - QCO status comes strictly from the Facts DB (`qcosForStandard()`).
   - Labs come strictly from `labsForStandard()`.

---

## 2. Sub-Phased Implementation Sequence

The implementation is broken into 5 discrete, verifiable sub-phases. In accordance with §0.3, code is compiled (`npm run build` or `tsc --noEmit`) and tested after each sub-phase.

```
Sub-Phase 4.1          Sub-Phase 4.2          Sub-Phase 4.3          Sub-Phase 4.4          Sub-Phase 4.5
[Honesty & Reset]  ->  [Vision Schema]    ->  [Chat Multimodal]  ->  [Modal Alignment]  ->  [Eval Runner]
Sanitize fake data     Strict JSON contract   Connect /api/chat      V9 minimal redesign    5 image fixtures
Fix CM/L prefix        gemini-3.8-flash       Orchestrator hook      "Ask in chat" action   eval:photo script
Reset modal state      Adjudicator bridge     Cross-questioning      Auto-fit map bounds    Zero regressions
```

---

### Sub-Phase 4.1: Photo Inspector Honesty, Data Sanitization & State Reset
- [ ] **Item 4.1.1 — Sanitize Verification API (`prototype/src/app/api/verify/route.ts`):**
  - Remove hardcoded licensee names (`"Sovereign Protective Gear Manufacturing Pvt. Ltd."`, `"Apex Cookware Ltd."`).
  - Remove hardcoded expiry dates (`"31-Dec-2027"`).
  - Wording for valid CM/L format:
    *"Licence number read from the label: CM/L-XXXXXXX. Check it on the BIS Care app or Manak Online."* — never claim "Valid" or "Operative".
  - If no licence is detected: return *"No licence number found in the photo."*
- [ ] **Item 4.1.2 — Fix CM/L Normalization (`prototype/src/lib/vision-inspector.ts`):**
  - In `normalizeCmlNumber()`, strip any existing `CM/L`, `CML`, or punctuation prefix before formatting strictly as `CM/L-${digits}`.
  - Fix `VisualProductInspectorModal.tsx` so it does not prepend `"CM/L-"` to an already formatted string.
- [ ] **Item 4.1.3 — Remove Fake Confidence Ledgers:**
  - Remove the 3-card grid (OCR Clarity 95% / Extraction 95% / KB Match 100%) and "KB 100%" badge from `VisualProductInspectorModal.tsx` and `vision-inspector.ts`.
  - Remove forbidden word `"Axiom A1 Grounding"`.
  - Replace with a clean, honest box: *"What we read on the label"* displaying `label_text` verbatim.
- [ ] **Item 4.1.4 — Implement Unconditional State Reset:**
  - Ensure `VisualProductInspectorModal.tsx` clears `inspectionResult` and resets all fields whenever a new file is uploaded or the modal opens.
  - Remove the initial mount hook that forced `"example_helmet.jpeg"` on opening.

---

### Sub-Phase 4.2: Strict Vision Schema & Deterministic Pipeline Bridge
- [ ] **Item 4.2.1 — Upgrade Gemini Multimodal Model Call:**
  - Update `runRealVisionOcr()` in `prototype/src/lib/vision-inspector.ts` to call active `gemini-3.8-flash` (with fallback to `gemini-3.6-flash` / `gemini-flash-latest`).
  - Pass `temperature: 0.0`.
- [ ] **Item 4.2.2 — Enforce Strict Vision Output JSON Schema:**
  - Structure prompt to return strictly:
    ```json
    {
      "product_guess": "string",
      "label_text": "string (verbatim OCR)",
      "isi_mark_seen": true | false | "unclear",
      "is_numbers": ["IS 4151"],
      "licence_numbers": ["3112329"],
      "huid": [],
      "is_product_image": true | false,
      "notes": "string"
    }
    ```
  - Mark all extracted fields as *user-provided evidence* — never as an official source `[S#]`.
- [ ] **Item 4.2.3 — Connect to Phase 1 Adjudicator & Facts DB:**
  - Pass `product_guess` and `is_numbers` into `resolveProduct()` and `adjudicateCandidates()` from `prototype/src/lib/pipeline/`.
  - QCO box rendered only if `qco.status` is `mandatory` or `notified_not_in_force` from Facts DB.
  - Testing clauses and labs retrieved strictly from `labsForStandard()`.
  - If no standard applies:
    - Title: *"No matching BIS standard found"*.
    - Subtitle: *"This looks like <product_guess>. We couldn't find an Indian Standard or ISI mark for it in our sources."*
    - Hide QCO box, testing clauses, labs, and scheme tabs.

---

### Sub-Phase 4.3: Multimodal Conversational Vision in Chat (`/chat/[id]`)
- [ ] **Item 4.3.1 — Extend Chat API & Orchestrator for Attachments:**
  - Add `attachment?: { name: string; base64: string; type?: string }` to `PipelineOptions` in `prototype/src/lib/pipeline/orchestrator.ts`.
  - In `prototype/src/app/api/chat/route.ts`, extract `attachment` from `req.json()` and forward to `runPipeline(options)`.
- [ ] **Item 4.3.2 — Conversational Flow Handling in Pipeline:**
  - When `attachment` is present:
    - Invoke vision extractor to obtain `product_guess`, `label_text`, `is_numbers`, `licence_numbers`.
    - **Random Image Case (e.g. coffee, landscape):** Return `kind: "refusal"`, `reason: "not_in_sources"`:
      *"I cannot identify an Indian Standard or BIS mark in this image. This appears to be <product_guess>. Please provide a clear photo of the product rating plate, label, or ISI mark."*
    - **Ambiguous Product Case (e.g. helmet with no visible standard code):**
      Return `kind: "clarify"` asking cross-questioning options:
      *"I see a helmet in the photo, but no standard number or ISI mark is clearly legible. Which type of helmet is this?"*
      Options: `["Two-Wheeler Motorcycle Riding (IS 4151)", "Industrial & Construction Safety (IS 2925)"]`.
    - **Identified Standard Case:**
      Run full retrieval & adjudication for the identified standard.
      Answer includes a dedicated *"What we read on the label"* callout showing extracted text and licence check instructions.
- [ ] **Item 4.3.3 — UI Chat Message Presentation:**
  - Update `UserMessage.tsx` to render the attached image thumbnail if present.
  - Update `AnswerCard.tsx` to render the label read notice when visual extractions are present.
- [ ] **Item 4.3.4 — Landing Page Paperclip Routing:**
  - Update `prototype/src/app/page.tsx` so attaching an image in the landing search bar passes the image into `/chat/[id]` via session storage or dynamic state.

---

### Sub-Phase 4.4: Visual Inspector Modal Overhaul
- [ ] **Item 4.4.1 — V9 Design Token Redesign:**
  - Modal title: *"Check a product photo"*.
  - Remove government ministry header strip and logo lock-ups.
  - Apply V9 token styling (navy `#0B2A4A`, saffron accent `#E8710A`, white card `#FFFFFF`, slate border `#E5E7EB`).
- [ ] **Item 4.4.2 — Realistic Lab Geolocation & Map Bounds:**
  - Remove synthetic distances (`12 + idx * 8.5 km`). Display distance only when user shares browser geolocation.
  - Auto-fit Leaflet map bounds to the returned laboratories.
- [ ] **Item 4.4.3 — Primary Action Alignment:**
  - Set primary modal CTA to: *"Ask about this product in chat"* $\to$ redirects to `/chat/<new-id>` with the image and starter query:
    *"Which standard applies to this product, and is BIS certification mandatory?"*.

---

### Sub-Phase 4.5: Image Test Fixtures, Automated Evaluator & Regression Verification
- [ ] **Item 4.5.1 — Create Image Test Fixtures in `data/eval/images/`:**
  - `helmet_isi.jpg`: Motorcycle helmet showing clear IS 4151 mark & CM/L.
  - `helmet_nomark.jpg`: Helmet without visible markings.
  - `cooker.jpg`: Pressure cooker with IS 2347 mark.
  - `coffee.jpg`: Cup of coffee (negative test).
  - `blurry.jpg`: Unreadable/defocused photo (negative test).
- [ ] **Item 4.5.2 — Create Photo Eval Runner (`scripts/eval-photo.ts`):**
  - Create npm script `npm run eval:photo`.
  - Assert that `coffee.jpg` and `blurry.jpg`:
    - Show 0 fake licences.
    - Show 0 QCO alerts.
    - Show 0 labs.
    - Show 0 fake confidence percentages.
  - Assert that `helmet_isi.jpg`:
    - Identifies `IS 4151`.
    - Normalises CM/L with single prefix.
    - Contains 0 fake licensee names.
- [ ] **Item 4.5.3 — RAG Golden Regression Check:**
  - Run `npm run eval:rag` to verify that all 25 golden tests continue to pass with 100% metrics.

---

## 3. Acceptance Verification Criteria

| Check # | Requirement | Pass Condition |
|---|---|---|
| **A1** | **State Reset Verification** | Opening modal with helmet, then uploading coffee $\to$ all helmet data is cleared. Zero leftover state. |
| **A2** | **Random Image Rejection** | `coffee.jpg` and `blurry.jpg` return `UNABLE_TO_VERIFY` / refusal. Zero QCOs, zero labs, zero fake licenses, zero fake percentages. |
| **A3** | **Zero Fake Licensees** | Grep search for `"Sovereign Protective Gear"` or `"Apex Cookware"` yields 0 matches across the repository. |
| **A4** | **Zero Fake Confidence Numbers** | Grep search confirms removal of "OCR Clarity 95%", "KB Match 100%", "~12 km" synthetic distance. |
| **A5** | **Double Prefix Fix** | Helmet license outputs strictly as `CM/L-3112329` (never `CM/L-CM/L-3112329`). |
| **A6** | **Chat Multimodal Flow** | Attaching a photo in chat composer transmits image $\to$ vision pipeline $\to$ grounded answer with label excerpt. |
| **A7** | **Conversational Cross-Questioning** | Unmarked product photo triggers `kind: "clarify"` with actionable disambiguation chips. |
| **A8** | **Zero Forbidden Words** | Zero occurrences of `Axiom`, `statutory`, `NotebookLM`, etc. in rendered UI. |
| **A9** | **Photo Eval Suite** | `npm run eval:photo` executes and passes all 5 test image fixtures. |
| **A10** | **Golden RAG Suite** | `npm run eval:rag` maintains 25 / 25 passed (100% metrics). |

---

## 4. Human Lead Review & Next Step

Per Part 0 rules, planning pauses here. No code changes have been executed.  
Please review the audit ([`docs/v9/PHASE_4_AUDIT.md`](file:///c:/BISVEDA/docs/v9/PHASE_4_AUDIT.md)) and this plan ([`docs/v9/PHASE_4_PLAN.md`](file:///c:/BISVEDA/docs/v9/PHASE_4_PLAN.md)). Once approved, implementation will proceed systematically through Sub-Phases 4.1 to 4.5.
