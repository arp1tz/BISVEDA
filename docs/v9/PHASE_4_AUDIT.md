# BISVEDA V9 — Phase 4 Audit: Photo Inspector, Vision Pipeline & Multimodal Chat
**Date:** September 27, 2026  
**Auditor:** Antigravity Build Agent  
**Status:** Audit Completed — Awaiting Human Lead Sign-Off before Implementation  

---

## 1. Executive Summary

This audit examines the visual intelligence and image verification subsystems across the BISVEDA repository in accordance with **BISVEDA V9 Build Spec (Part 0 & Phase 4)**.

### Target Subsystems Audited:
1. **Vision Inspector Core:** `prototype/src/lib/vision-inspector.ts`
2. **Verification API Endpoint:** `prototype/src/app/api/verify/route.ts`
3. **Vision Inspection API Route:** `prototype/src/app/api/v8/vision/inspect/route.ts`
4. **Visual Inspector Modal Component:** `prototype/src/components/features/VisualProductInspectorModal.tsx`
5. **Chat Attachment & Pipeline Integration:** `prototype/src/components/chat/v9/Composer.tsx`, `prototype/src/app/chat/[id]/page.tsx`, `prototype/src/app/api/chat/route.ts`, and `prototype/src/lib/pipeline/orchestrator.ts`
6. **Landing Page Attachment Flow:** `prototype/src/app/page.tsx`

---

## 2. Progress Assessment Against V9 Build Spec & TODO.md

| Spec Milestone | Goal | Current Status | Findings & Health |
|---|---|---|---|
| **Phase 1: RAG Pipeline & Knowledge Layer** | 12 pure stages, Facts DB, zero invented facts, 25/25 golden tests | ✅ **100% Complete** | Passed all 25 golden tests in `eval:rag`. 0 wrong standards, 100% primary accuracy, 100% citation validity, 100% number support. |
| **Phase 2: Knowledge Console** | Obsidian-style graph, PDF chunk viewer, version control diff, fact approval queue, audit log | ✅ **100% Complete** | Route `/admin/knowledge` operational. All 8 acceptance checks passed. |
| **Phase 3: Minimal UI** | 1-screen landing page (1280×800), 760px chat workspace, Leaflet map with near-me, voice STT, read aloud TTS | ✅ **100% Complete** | Design tokens enforced. Leaflet maps with Haversine distance, browser STT/TTS, guided pathways on unverified queries. 0 forbidden words. |
| **Phase 4: Photo Inspector Honesty & Conversational Vision** | Eliminate fake licensees/percentages, state reset, random image rejection, chat vision flow | 🔧 **Audited & Planned** (Current Phase) | Existing vision pipeline audited. Root causes identified for all 4 spec bugs. Sub-phased plan drafted below. |
| **Phase 5: Later** | External lab detail links, NLI claim verification, Indic translation with marker survival | ❌ **Deferred** | Scheduled after Phase 4 sign-off. |

---

## 3. Root Cause Analysis of Observed Bugs (§4.0)

### Bug 1: Coffee photo shows fake license, mandatory QCO, 6 testing clauses & "KB 100%"
- **Locations:**
  - `prototype/src/components/features/VisualProductInspectorModal.tsx` (Lines 57–59, 401–407, 509–512, 528)
  - `prototype/src/lib/vision-inspector.ts` (Lines 314–352, 435–459)
- **Root Cause:**
  1. In `VisualProductInspectorModal.tsx`, on mount `useEffect` runs:
     `runInspection(initialProductType || "helmet", undefined, "example_helmet.jpeg")`.
     The modal unconditionally initialises with helmet data.
  2. When an unrelated image (e.g. coffee) is uploaded, if Gemini model call fails or returns no standard code, `runRealVisionOcr` returns null.
  3. `vision-inspector.ts` falls back to hardcoded example objects when `exampleType` is present, or defaults to `"IS 4151:2020"` when `normStandard` is null (line 430: `normStandard || "IS 4151:2020"`).
  4. In `VisualProductInspectorModal.tsx` line 528:
     `mark?.cmlOrHuidNumber ? ... : "CM/L-3112329"`. It falls back to a hardcoded CM/L license!
  5. Line 509 renders `<CheckCircle2 /> <span>KB 100%</span>` unconditionally on standard title block.

### Bug 2: Helmet result shows "CM/L-CM/L-3112329" (Double Prefix)
- **Locations:**
  - `prototype/src/components/features/VisualProductInspectorModal.tsx` (Line 528)
  - `prototype/src/lib/vision-inspector.ts` (Line 151)
- **Root Cause:**
  - In `vision-inspector.ts`, `normalizeCmlNumber` formats the string as `CM/L-${digits}` (e.g. `"CM/L-3112329"`).
  - In `VisualProductInspectorModal.tsx` line 528:
    `Extracted License: {mark?.cmlOrHuidNumber ? "CM/L-" + mark.cmlOrHuidNumber : "CM/L-3112329"}`.
    It prepends `"CM/L-"` to a string that already has `"CM/L-"`, resulting in `"CM/L-CM/L-3112329"`.

### Bug 3: "Confidence & Verification Ledger" shows fake 95% / 100% scores
- **Locations:**
  - `prototype/src/components/features/VisualProductInspectorModal.tsx` (Lines 423–453)
  - `prototype/src/lib/vision-inspector.ts` (Lines 347–349, 571, 611–613)
- **Root Cause:**
  - In `VisualProductInspectorModal.tsx`, a 3-card grid displays "OCR Clarity: 95%", "Extraction: 95%", "KB Match: 100%".
  - These values are hardcoded in `vision-inspector.ts` fallback mocks (`ocr_confidence: 0.95`, `kbMatchConfidence: 1.0`).
  - Violates Phase 4 Rule 4: *"Remove the confidence percentages ledger entirely (and the "KB 100%" chip). Replace with a small "What we read on the label" box showing label_text verbatim."*
  - Also displays forbidden internal word: `"Axiom A1 Grounding"` (violates Part 0 §0.5).

### Bug 4: Labs "ranked by proximity" with "~12 km" without a user location
- **Locations:**
  - `prototype/src/components/features/VisualProductInspectorModal.tsx` (Lines 169–229)
  - `prototype/src/lib/vision-inspector.ts` (Lines 159–206)
- **Root Cause:**
  - In `VisualProductInspectorModal.tsx`, synthetic lab list calculates:
    `distance_km: l.distance_km || Math.round(12 + idx * 8.5)`.
  - It fabricates distances (~12 km, ~20.5 km) even when no browser geolocation or user location was provided.
  - Violates Hard Rule 1 & Phase 4 Rule 7: *"Never fake numbers... distance only with user location"*.

### Bug 5: Fake Licensee Companies in Verification API
- **Location:**
  - `prototype/src/app/api/verify/route.ts` (Lines 42–43)
- **Code:**
  `licensee: isHelmetCml ? "Sovereign Protective Gear Manufacturing Pvt. Ltd." : "Apex Cookware Ltd."`
  `validTill: "31-Dec-2027"`
- **Root Cause:**
  - Hand-crafted mock licensee names and expiry dates hardcoded in the API response.
  - Violates Hard Rule 1: *"No standard number, title, clause, QCO, fee, percentage, lab, address, licence number, distance, or confidence score may be typed from memory or hardcoded."*

### Bug 6: Disconnected Chat Vision Pipeline
- **Locations:**
  - `prototype/src/app/api/chat/route.ts` (Lines 7–27)
  - `prototype/src/lib/pipeline/orchestrator.ts` (Lines 43–50)
  - `prototype/src/app/page.tsx` (Lines 91–133)
- **Root Cause:**
  - `Composer.tsx` in Phase 3 added photo attachment and base64 encoding.
  - `chat/[id]/page.tsx` transmits `attachment: { name, base64 }` in POST `/api/chat`.
  - However, `/api/chat/route.ts` accepts `attachment` in `body` but never forwards it to `runPipeline(options)`.
  - `PipelineOptions` in `orchestrator.ts` has no field for attachments.
  - Therefore, multimodal conversational chat is currently disconnected.

---

## 4. Exact Files to be Changed in Phase 4

1. `prototype/src/lib/vision-inspector.ts`:
   - Update Gemini model calling to use active `gemini-3.8-flash` / `gemini-3.6-flash`.
   - Remove fake mock companies and fallback mock objects.
   - Enforce strict JSON output contract:
     `{ product_guess, label_text, isi_mark_seen: true | false | "unclear", is_numbers: [], licence_numbers: [], huid: [], notes }`.
   - Normalise CM/L strings strictly once.
   - Route product mapping through Phase 1 Facts DB & `adjudicateCandidates()`.
2. `prototype/src/app/api/verify/route.ts`:
   - Remove hardcoded licensee names (`Sovereign Protective Gear`, `Apex Cookware`).
   - Validate format only and link to official BIS Manak Online search portal:
     *"Licence number read from the label: CM/L-XXXXXXX. Check it on the BIS Care app or Manak Online."*
3. `prototype/src/app/api/v8/vision/inspect/route.ts`:
   - Enforce state reset and remove exampleType defaults that inject helmet data on failed uploads.
4. `prototype/src/components/features/VisualProductInspectorModal.tsx`:
   - Remove ministry header bar; apply V9 minimal styling (Title: "Check a product photo").
   - Eliminate confidence ledger and "KB 100%" badge; add verbatim "What we read on the label" box.
   - Eliminate synthetic "~12 km" distance calculation.
   - Reset all state on new image upload or modal open.
   - Add primary action: *"Ask about this product in chat"* opening `/chat/[id]` with question and attached image.
5. `prototype/src/app/api/chat/route.ts` & `prototype/src/lib/pipeline/orchestrator.ts`:
   - Add `attachment?: { name: string; base64: string; type?: string }` to `PipelineOptions`.
   - In Stage 1/2 (`normalize.ts` / `route.ts`), run visual extraction when an image attachment is provided.
   - If image is unidentifiable or non-product (e.g. coffee, scenery): return honest refusal `kind: "refusal"`.
   - If image is ambiguous (e.g. helmet without label): trigger `kind: "clarify"` with disambiguation chips.
   - If standard is identified: output grounded `AnswerCard` with "What we read on the label" box.
6. `prototype/src/app/page.tsx`:
   - When an image is attached in the landing page search bar, route with the attachment to `/chat/[id]`.
7. `data/eval/images/` & `scripts/eval-photo.ts`:
   - Create 5 image fixtures (`helmet_isi.jpg`, `helmet_nomark.jpg`, `cooker.jpg`, `coffee.jpg`, `blurry.jpg`).
   - Build automated evaluation script verifying honesty constraints.
