# BISVEDA V9 — Phase 3 & Phase 4 Roadmap & Implementation Plan

**Date**: September 27, 2026  
**Status**: Phase 3 Refinements & Fixes in Progress; Phase 4 Architecture Planned  

---

## 1. Feature Priority Mapping (Per User Request)

The user has identified 6 critical functional requirements and reiterated the 5 core problem statement capabilities:
1. 🧠 **Natural-Language BIS Q&A**: Plain-language comprehension, technical standard queries.
2. 🎯 **Applicable Standard Recommendation**: Product description → Indian Standard specification.
3. 📜 **BIS Certification & Licensing Guidance**: Scheme I (ISI), Scheme IV (CRS), FMCS, hallmarking processes.
4. 🔬 **Testing, Hallmarking & BIS Service Discovery**: Lab locator with interactive map, "Near me" sorting, AHC hallmarking discovery.
5. 🌐 **Multilingual, Source-Backed Assistance**: Hindi & English, exact clause citations (`[S#]`), grounding verification.

---

## 2. Phase-Wise Priority Roadmap

### Phase 3 — Minimal UI Refinements & Conversational Foundations (CURRENT)

| Priority | Feature / Fix | Description | Status |
|---|---|---|---|
| **P1** | **Conversational Context Retention** | Keep conversation turn history (`history: ConversationTurn[]`). Prevent losing context on follow-ups (e.g. "Explain this simply...", "which labs can test this?"). Resolve product and active standards from previous assistant turns. | **In Progress** |
| **P2** | **Guided Recommendation Path on Failure** | When a query cannot be answered, return an intelligent recommended path ("Did you mean...", catalogue links, QCO directory, testing directory, Helpline 1915). | **In Progress** |
| **P3** | **Interactive Labs Map Preview with Pins & "Near Me"** | Leaflet interactive map rendering pins for accredited labs with coordinates, popups, and geolocation-based "Near me" proximity sorting. | **In Progress** |
| **P4** | **Attachment Input & Image Preview in Chat** | Clean file/photo attachment in `Composer.tsx`, visible thumbnail in `UserMessage.tsx`, and stripping `[Attachment: ...]` from query text to eliminate false gibberish triggers. | **In Progress** |
| **P5** | **Read Aloud Feature (Text-to-Speech)** | Audio icon (`Volume2` / `VolumeX`) on `AnswerCard` using browser Web Speech Synthesis (`window.speechSynthesis`) for Hindi & English; pluggable for studio neural TTS (`ELEVENLABS_API_KEY` / `OPENAI_API_KEY`). | **In Progress** |
| **P6** | **Voice Input Feature (Speech-to-Text)** | Microphone button in `Composer.tsx` using Web Speech Recognition (`webkitSpeechRecognition`) for immediate voice queries; pluggable for Whisper (`OPENAI_API_KEY`) / Gemini Audio. | **In Progress** |

---

### Phase 4 — Photo Inspector Honesty & Conversational Multimodal Vision (NEXT)

| Priority | Feature | Description | Target |
|---|---|---|---|
| **P1** | **Multi-Turn Conversational Vision** | Uploading product/material images within the chat stream. Extract standard, product type, and markings. Cross-examine the user with clarifying questions (e.g. "Is this helmet for two-wheeler riding or industrial use?"). | Phase 4 |
| **P2** | **Photo Inspector Honesty Fixes** | Remove fake mock licensees (e.g. "Sovereign Protective Gear Pvt Ltd"), eliminate fake hardcoded 99% confidence scores, and establish genuine verification states (`VERIFIED_STANDARDS_MATCH`, `PROVISIONAL_CANDIDATE`, `UNABLE_TO_VERIFY`). | Phase 4 |
| **P3** | **Random Image Rejection** | When user uploads an irrelevant/non-product photo (e.g., scenery, pets, food), gracefully respond: *"I cannot identify a product or BIS mark in this image. Please provide a clear photo of the product, label, or ISI/Hallmark mark."* | Phase 4 |
| **P4** | **Authentic Mark & HUID Verification** | Real verification of CM/L 7–8 digit format and 6-character alphanumeric HUID against BIS registry formats with official portal verification links. | Phase 4 |

---

## 3. Technology & API Key Reference

| Capability | Default Zero-Key Implementation | Recommended External API | Environment Variable |
|---|---|---|---|
| **Vision / Image OCR** | Sovereign baseline heuristic rules in `lib/vision-inspector.ts` | Google Gemini 2.0 / 1.5 Flash Vision | `GEMINI_API_KEY` |
| **Read Aloud (TTS)** | Native browser `window.speechSynthesis` (Hindi + English) | ElevenLabs / OpenAI TTS | `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` |
| **Voice Input (STT)** | Native browser `webkitSpeechRecognition` (Hindi + English) | OpenAI Whisper / Google Cloud Speech | `OPENAI_API_KEY` or `GOOGLE_STT_KEY` |
| **LLM Slot Filling** | Deterministic frozen evidence generation (`lib/pipeline/generate.ts`) | Gemini Flash / Groq Llama 3.3 | `GEMINI_API_KEY` or `GROQ_API_KEY` |
