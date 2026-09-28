# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
BISVEDA is a conversational assistant for Indian Standards and BIS services (SIH26107). Its answers are cited only from the PDFs in `example docs uploaded by employees\` plus the official BIS lab (LIMS) and AHC (Manak Online) directories.

## Read first
1. `progress.md`: current state.
2. The current phase section of `TODO.md`: task detail, with the model and effort to use.

Read other files only when a task names them. Reference earlier reads instead of re-reading.

## Commands (run from `prototype/`)
- `npm run dev` · `npm run typecheck` · `npm run build`
- `npm run kb:build`: rebuilds `data/kb/*` from the PDFs. Needs Python + PyMuPDF + rapidocr for parsing. Embedding is local bge-m3 (no API key, no quota) — first run downloads and caches the model from the Hugging Face Hub.
- `npm run calibrate:floor`: recomputes `data/kb/calibration.json`'s semantic-similarity threshold from the golden set.
- `npm run dir:labs` · `npm run dir:ahc`: scrape the official directories into `data/directory/*`. Throttled and cached.
- `npm run eval:rag`: runs the golden eval (`data/eval/golden.jsonl`).

## Architecture
```
XL  "/" home · "/chat/[id]" single conversation · "/admin" dashboard · "/form-i/print"
L1  api/chat (SSE: stage | response | error)
L4a pipeline/understand.ts   intent + standalone query (Groq JSON; regex fallback)
L5  tools/: kb_search · labs · ahc · hallmark · mark_check · form_i ; lib/vision.ts (Gemini)
L4b pipeline/retrieve.ts     exact + BM25 + dense + graph → RRF(k=60) → calibrated floor → [S#] package
L5  pipeline/answer.ts       Groq, history-aware, cites [S#]; evidence-only fallback
L6  pipeline/trust.ts        strip unknown [S#], drop unsupported IS numbers or figures, refuse if unsupported
L3  lib/kb/store.ts          loads data/kb + data/directory once
L0/L2 scripts/kb, scripts/directory  (offline)
```

## Hard rules
- Facts come only from `data/kb` and `data/directory`. Never fabricate names, numbers, dates, lab scopes, licensees or distances.
- Every knowledge-base answer carries `[S#]` citations, and the trust gate is authoritative.
- Never declare a mark, licence or HUID valid or genuine. Show the format check plus the BIS Care app / Manak Online route.
- Vision and OCR output is `user_provided` evidence and is never cited as `[S#]`.
- Model ids come from env only (`GROQ_CHAT_MODEL`, `GROQ_FAST_MODEL`, `GEMINI_VISION_MODEL`, `EMBED_MODEL`). Embeddings are local bge-m3 (`Xenova/bge-m3` via transformers.js, 1024-dim) — no hosted embedding API, no hash or placeholder embeddings.
- Emit only the stage events that actually ran.
- Don't use these words in user-facing text: statutory, sovereign, NotebookLM, corpus boundary, zero-shot, provenance, "Axiom".

## Boundaries
- Don't read `C:\BISVEDA_archive` or `docs/reference/*` unless asked.
- Out of scope: the ingestion/upload UI, QCO and scheme data, voice, Postgres/MinIO, and the Python API.

## Design tokens
Primary `#0B2A4A` · accent `#E8710A` · border `#E5E7EB` · text `#0F172A` · muted `#64748B` · verified `#228f4a` · mandatory `#bd2f2f` · warning `#B45309`. No gradients or glassmorphism. Chat column 760px.

## Workflow
After every task:
1. Update `progress.md` (≤5 dense lines in Latest State).
2. Tick `TODO.md`.
3. Run `npm run typecheck`.
4. Commit `P{n}.{m}: …`.
