# BISVEDA Handoff — Antigravity Execution Prompt

> **Read `CLAUDE.md` first, then `progress.md`, then this file.** Read `TODO.md` only for the "Done when" criteria of whichever task you're working on. Read other files only when a task names them.

## Role
You are the implementation engineer on the BISVEDA prototype (SIH26107). You will build **P5 (in-chat tools), P6 (UI integration), P7 (admin dashboard), and P8 (eval + demo)** in order. P0–P3 are done. P4 (vision) is code-complete — verify it works during P8 testing.

## What is already done (don't redo)
- **P0**: Git init, archive, cleanup. Clean.
- **P1**: KB build from 9 PDFs + BIS directories. `npm run kb:build` → 760 chunks, 8 standards, 320 graph nodes. `dir:labs` = 29 labs, `dir:ahc` = 1651 AHCs.
- **P2**: Hybrid retrieval (exact + BM25 + dense + graph → RRF k=60 → calibrated floor). **Local bge-m3 embeddings** (1024-dim, `Xenova/bge-m3` via `@huggingface/transformers`) — no Gemini embedding API, no quota. Calibration threshold = 0.67 (real data, n_in=23, n_out=5). Eval: **29/32**, citation validity 100%, wrong-standard 0.
- **P3**: Conversational orchestrator (`pipeline/orchestrator.ts` → `runPipeline()`), intent classifier (`understand.ts`), answer gen (`answer.ts` via Groq), trust gate (`trust.ts`). Multi-turn, SSE streaming, follow-ups all working.
- **P4**: `lib/vision.ts` rewritten — real Gemini vision, strict JSON schema, `normalizeCmlNumber()`, `validateHuid()`, `parsePurity()`. Orchestrator handles all vision branches (not_a_product, unreadable, other_product, helmet-without-mark clarify, gold hallmark card, helmet/toy with mark card). **Code-complete.**
- **P6.3**: `/api/docs/[docId]/route.ts` already exists and serves whitelisted PDFs from the employee-uploaded folder. `data/kb/docs.json` is the registry.

## Current state
- **Dev server**: `npm run dev` at `http://localhost:3000`. Working.
- **Git**: clean working tree, latest commit `74bd682` (7 commits total).
- **Typecheck**: clean (0 errors).
- **Eval**: 29/32. Three known boundary failures documented in `progress.md` — not code bugs, calibration-boundary cases from the small golden set.
- **No `src/lib/tools/` directory** — P5 tools not built yet.
- **`DEFAULT_RECENT_CHATS`** hardcoded in `chat/[id]/page.tsx` line 32 — must be removed.
- **Home page** still has "Pressure Cooker" and "Packaged Water" pills — products we don't hold.
- **No conversation persistence** — messages lost on refresh.
- **No admin dashboard** — `/admin` route doesn't exist.
- **No Form I schema** at `data/kb/form_i_schema.json`.
- **No `/form-i/print` page**.
- **New UI cards** (LabsCard, AhcCard, HallmarkCard, MarkCard, ImageReadCard, FormICard) — TypeScript interfaces defined in `respond.ts` but no React renderers.

## Environment
- **Working directory**: `C:\BISVEDA`, commands run from `prototype/`.
- **PowerShell PATH**: refresh every call — `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`
- **API keys** in `prototype/.env`: `GROQ_API_KEY` and `GEMINI_API_KEY` set.
- **LLM defaults** in `src/lib/llm.ts`: `openai/gpt-oss-120b` (chat), `openai/gpt-oss-20b` (fast). Both are Groq reasoning models — require `reasoning_effort: "low"` (already handled).
- **Embeddings**: local bge-m3 — no API key, no quota. Runtime: `src/lib/embeddings.ts`. Build-time: `scripts/kb/embed.ts` (delegates to same runtime module).
- **Vision**: `src/lib/vision.ts` uses `GEMINI_VISION_MODEL` env var if set, otherwise tries fallback list: `gemini-2.5-flash`, `gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3.6-flash`.

## Design tokens
Primary `#0B2A4A` · accent `#E8710A` · border `#E5E7EB` · text `#0F172A` · muted `#64748B` · verified `#228f4a` · mandatory `#bd2f2f` · warning `#B45309`. No gradients or glassmorphism. Chat column max-width 760px.

## Forbidden words in user-facing text
statutory, sovereign, NotebookLM, corpus boundary, zero-shot, provenance, "Axiom".

## Hard rules (non-negotiable)
1. Facts come only from `data/kb` and `data/directory`. **Never fabricate** names, numbers, dates, lab scopes, licensees or distances.
2. Every KB answer carries `[S#]` citations, and the trust gate is authoritative.
3. **Never declare a mark, licence or HUID valid or genuine.** Show the format check plus the BIS Care app / Manak Online route.
4. Vision and OCR output is `user_provided` evidence — never cited as `[S#]`.
5. Model ids come from env only. Embeddings are local bge-m3 — no hosted embedding API, no hash/placeholder embeddings.
6. Emit only the stage events that actually ran.

---

## Phase-by-phase execution

### P5: In-chat tools (`src/lib/tools/`)

Create directory `prototype/src/lib/tools/`.

**P5.1** `tools/labs.ts` — `findLabs({standard, city?, state?, location?})`:
- Files: new `src/lib/tools/labs.ts`, modify `src/lib/pipeline/orchestrator.ts`
- Data source: `store.getLabsForStandard(standardId)` already exists (filters `labs.json` by `standards_in_scope`). Also use `store.getAllLabs()` for broader queries.
- Filter: labs with `validity` date not yet expired.
- Sort: haversine distance if `location` provided, otherwise city/state text match against user query.
- Return top 8 with: lab name, city, state, standards_in_scope, validity, remark, `source_url`.
- Answer text prefix: "BIS-recognised labs listing {standard} in their scope (BIS LIMS, retrieved {date})."
- **Wire into orchestrator**: when `understood.intent === "find_labs"`, call `findLabs()`, run a KB search for the relevant standard alongside it, return response with `cards.labs` as a `LabsCard` (interface already defined in `respond.ts`) plus any answer text from the KB search.
- The `LabRecord` type is in `src/lib/kb/types.ts`.
- Done when: "where can I test my helmet in Pune" → response with a LabsCard containing real LIMS lab rows.

**P5.2** `tools/ahc.ts` — `findAhc({city?, state?, location?})`:
- Files: new `src/lib/tools/ahc.ts`, modify orchestrator
- Data source: `store.getAllAhcs()`
- Filter: status `"Operative"` only.
- Sort: haversine distance if location known, otherwise district/state text match. Return top 10 with coordinates for map display.
- Wire into orchestrator for `find_ahc` intent. Return `cards.ahc` as `AhcCard`.
- The `AhcRecord` type is in `src/lib/kb/types.ts`.
- Done when: "hallmarking centres in Jaipur" → AhcCard with real AHC rows + coordinates.

**P5.3** `tools/hallmark.ts` — hallmark/mark checking:
- Files: new `src/lib/tools/hallmark.ts`, modify orchestrator
- Combines vision fields OR typed text into cards:
  - "what is 916" → `parsePurity("916")` → HallmarkCard + KB search citing IS 1417 Table 1
  - "check HUID AB12C3" → `validateHuid("AB12C3")` → HallmarkCard with format result + "Verify this HUID in the BIS Care app" (NEVER say valid/genuine)
  - CM/L number query → `normalizeCmlNumber()` → MarkCard + "Verify on BIS Care app or Manak Online"
- These functions already exist in `src/lib/vision.ts` — import them.
- Wire into orchestrator for `hallmark` and `mark_check` intents.
- Done when: "check HUID AB12C3" → HallmarkCard; "what is 916" → IS 1417 citation about 22K fineness.

**P5.4** `tools/form_i.ts` — Form I conversational draft:
- Files: new `src/lib/tools/form_i.ts`, new `data/kb/form_i_schema.json`, modify orchestrator
- Create `form_i_schema.json` by reading the Form I PDF's chunks (`data/kb/chunks.json`, filter `doc_id === "form-i-jeweller"`, there are 3 chunks). Transcribe the 13 fields with exact printed labels:
  ```json
  [
    {"field": 1, "label": "Name of Jeweller", "required": true, "type": "text"},
    {"field": 2, "label": "Address of outlet(s) with PIN code, district, state, telephone, fax, email", "required": true, "type": "text"},
    {"field": 3, "label": "Near Landmark", "required": false, "type": "text"},
    {"field": 4, "label": "Whether Proprietorship / Partnership / Pvt. Ltd. Company / PSU", "required": true, "type": "select", "options": ["Proprietorship", "Partnership", "Private Limited Company", "PSU"]},
    {"field": 5, "label": "Names of persons responsible for management", "required": true, "type": "text"},
    {"field": 6, "label": "Name and designation of contact person", "required": true, "type": "text"},
    {"field": 7, "label": "BIS Hallmarking Certificate applied for", "required": true, "type": "select", "options": ["Gold Jewellery (IS 1417)", "Silver Jewellery (IS 2112)", "Both"]},
    {"field": 8, "label": "Whether already holds any other BIS Certificate", "required": false, "type": "text"},
    {"field": 9, "label": "Approximate annual turnover", "required": true, "type": "text"},
    {"field": 10, "label": "Corporate-level details and outlet list", "required": false, "type": "text"},
    {"field": 11, "label": "Whether any previous cancellation / conviction", "required": true, "type": "text"},
    {"field": 12, "label": "Payment details", "required": false, "type": "text"},
    {"field": 13, "label": "Identification mark used on articles", "required": true, "type": "text"}
  ]
  ```
- Tool function `stepFormI(formState, formUpdates)`: merge updates into state, find next 1–3 missing required fields, return `{ formState, nextQuestions: string[], isComplete: boolean, card: FormICard }`.
- Wire into orchestrator for `form_i` intent. When user sends `formState` + updates, merge and ask for next fields. When complete, return FormICard with all fields + a `print_url` pointing to `/form-i/print`.
- Questions about Form I should also cite the Form I PDF chunks.
- Done when: "I want to register my jewellery shop for hallmarking" starts the form flow → asking fields one by one → FormICard shows filled fields.

**P5.5** `/form-i/print` page:
- Files: new `src/app/form-i/print/page.tsx`
- Reads `formState` from `sessionStorage` (key: `bisveda_form_i_state`).
- Renders fields 1–13 in official order with the header: "DRAFT: prepared with BISVEDA, submit on Manak Online".
- `@media print` CSS for clean print-to-PDF.
- Done when: navigating to `/form-i/print` with populated sessionStorage renders a printable form draft.

### P6: Chat UI integration

**P6.1** `chat/[id]/page.tsx` fixes:
- Files: `src/app/chat/[id]/page.tsx`, new `src/lib/conversations.ts`
- **Remove `DEFAULT_RECENT_CHATS`** (line 32–36). Replace with `[]`.
- **Handle SSE `error` events properly**: the SSE handler currently has a basic error branch (added in P3 fix #10) — verify it stops the spinner and shows a user-friendly message. If it doesn't, fix it.
- **Conversation persistence**: create `src/lib/conversations.ts` with `{ listConversations(), getConversation(id), saveConversation(id, messages), deleteConversation(id), renameConversation(id, title) }` backed by localStorage. Save messages after each assistant response. Load on mount. Populate sidebar from localStorage.
- **Read `?q=` search param**: if present on mount, auto-submit it as the first message.
- **Send full body to API**: `{ message, history, image, formState, location }`. `history` = last 6 turns. Image from sessionStorage (the home page already writes it there). `formState` from conversation state.
- Done when: refresh preserves messages, `DEFAULT_RECENT_CHATS` gone, errors shown to user, `?q=` auto-submits.

**P6.2** AnswerCard / SourceDrawer verification:
- Files: `src/components/chat/v9/AnswerCard.tsx`, `SourceDrawer.tsx`
- Verify markdown rendering uses `react-markdown` + `remark-gfm`. `CitationPill` click opens `SourceDrawer` with excerpt + "Open PDF at page" link → `/api/docs/{docId}#page=N`.
- This is largely done — verify and fix any rendering issues.

**P6.4** New card components:
- Files: new components in `src/components/chat/v9/`
- Create these React components:
  - `LabsCard.tsx` — table of labs (name, city, state, scope, validity) + the existing `LabsMapInner` component for map display. Import `LabsCard` interface from `respond.ts`.
  - `AhcCard.tsx` — AHC list (name, address, metals, status, validity) + map. Import `AhcCard` interface.
  - `HallmarkCard.tsx` — purity/HUID display with format check result + "Verify on BIS Care app" CTA. Import `HallmarkCard` interface.
  - `MarkCard.tsx` — CM/L number display + verification route. Import `MarkCard` interface.
  - `ImageReadCard.tsx` — "What we read from your photo" box showing vision results (category, product guess, label text, marks seen). Import `ImageReadCard` interface.
  - `FormICard.tsx` — form fields display (editable) + "Open printable draft" button (links to `/form-i/print`, saves formState to sessionStorage first). Import `FormICard` interface.
- Wire into chat page message rendering: when `response.cards.labs` exists → render `<LabsCard>`, etc.
- **Delete `DetailTabs.tsx` and `QcoLine.tsx`** — no QCO data in this prototype, both are dead code.
- Done when: each card type renders correctly in chat when present.

**P6.5** Home page rework:
- Files: `src/app/page.tsx`
- Change product pills to: **Helmets**, **Toys**, **Gold Jewellery & Hallmarking**, **Form I**. Update queries to match our KB. Remove pressure cooker and packaged water.
- Update action cards to reflect actual capabilities.
- Add a "What I know" line listing the 8 standards: IS 4151, IS 2925, IS 9873 (Part 1), IS 9873 (Part 3), IS 15644, IS 1417, IS 1418, IS 15820.
- Image attach → sessionStorage → redirect to `/chat/{id}?q=` (this logic already exists, verify it works).
- Done when: home page accurately shows what the prototype covers, no fabricated product pills.

**P6.6** Location handling:
- Files: modify chat page and/or orchestrator
- Request browser geolocation **only** when labs or AHCs are asked for. Don't prompt for location on regular KB questions.
- Fall back to city typed in chat text.
- Done when: "labs near me" triggers geolocation; "labs in Pune" uses text match without prompting.

### P7: Employee dashboard `/admin`

**P7.1** Auth:
- Files: new `src/app/api/admin/login/route.ts`, new `src/middleware.ts` (or modify existing)
- Read `ADMIN_PASSWORD` from env. POST `/api/admin/login` with `{ password }` → set httpOnly cookie on match.
- Middleware: protect `/admin` and `/api/admin/*` — redirect to login page if no valid cookie.
- Login UI: simple password field at `/admin` (or `/admin/login`).
- Done when: `/admin` without auth cookie → login form; valid password → dashboard.

**P7.2** Graph tab (Obsidian style):
- Files: reuse `src/components/admin/GraphTab.tsx` + `NodeInspector.tsx`, new `src/app/admin/page.tsx`, new `src/app/api/admin/graph/route.ts`
- API: `GET /api/admin/graph` returns `store.getGraph()` (already exported).
- GraphTab already uses `react-force-graph-2d`. Update it for:
  - Dark canvas `#1e1e1e`, circles coloured by node type (standard=blue, clause=gray, lab=green, ahc=gold, domain=accent, ref=muted), size proportional to degree.
  - Labels on hover or zoom > 1.5.
  - Hovering highlights neighbours and fades the rest.
  - Clicking opens `NodeInspector` with: node data, edges with source, chunk text or clause list for standard nodes.
  - Search box to focus a node.
  - Type filter toggles.
  - Local graph (depth 1–2) toggle.
- Done when: graph renders all 320 nodes smoothly; clicking `std:IS 4151` shows its clauses, references and connected labs.

**P7.3** Documents tab:
- Files: new admin component + API route
- Shows the 9 PDFs (use `store.docs`): doc_id, standard_id, title, domain, chunk count, source_url.
- Clicking opens the PDF via `/api/docs/{docId}`.
- A chunk browser: for each doc, list its chunks with clause, clause_title, page_start, page_end, text snippet.
- Done when: all 9 documents listed with correct counts; clicking opens the real PDF.

**P7.4** Directory tab:
- Files: new admin component + API route
- Labs table: lab name, city, state, standards_in_scope (comma-joined), validity. With search box.
- AHC table: recognition_no, name, district, state, metals, status, validity. With search box.
- Show total counts and `retrieved_at` timestamps.
- Done when: labs (29) and AHCs (1651) displayed with working text search.

### P8: Eval + demo

**P8.1** Run eval:
- `cd prototype && npm run eval:rag`
- Gates: primary@1 >= 90%, citation validity 100%, wrong-standard 0, out-of-corpus refusal >= 90%.
- Save results to `data/eval/results/`.
- If any gate fails after your P5/P6 changes, investigate and fix. Don't lower the bar.

**P8.2** Write `docs/DEMO.md`:
- A 5-minute demo walkthrough:
  1. Open `http://localhost:3000`. Show the home page (8 standards listed).
  2. Click "Helmets" chip → helmet query → cited answer with IS 4151.
  3. Follow-up: "what impact test does it need?" → IS 4151 impact clause cited.
  4. "where can I test my helmet in Mumbai?" → LabsCard with real LIMS labs.
  5. Upload a helmet photo → vision analysis → ImageReadCard + mark check.
  6. New conversation → "hallmarking centres in Jaipur" → AhcCard with map.
  7. Upload gold jewellery photo → HallmarkCard with purity + HUID format check.
  8. "I want to register my shop for hallmarking" → Form I flow → print view.
  9. Open `/admin` → graph tab → click IS 4151 → see clauses and labs.

**P8.3** Final audit:
- Grep all user-facing text for forbidden words (statutory, sovereign, NotebookLM, corpus boundary, zero-shot, provenance, "Axiom").
- Verify no mock/fabricated data anywhere.
- `npm run typecheck` and `npm run build` both green.
- Spot-check 5 `[S#]` citations: open each PDF at the cited page and confirm the page contains the cited claim.

---

## Workflow (after every task)
1. Update `progress.md` (≤5 dense lines in Latest State).
2. Tick `TODO.md`.
3. Run `npm run typecheck` from `prototype/`.
4. Commit with message `P{n}.{m}: …` and add:
   ```
   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

## Stop and ask the human if:
- A model ID is unavailable (API returns 404).
- The eval drops below its gates after a code change.
- A task would require fabricated data.
- A design decision isn't covered by this prompt or TODO.md.

## Key file locations
```
prototype/src/lib/embeddings.ts          — runtime bge-m3 embedding (singleton, 1024-dim)
prototype/src/lib/llm.ts                 — Groq chat/fast model clients
prototype/src/lib/vision.ts              — Gemini multimodal vision + normalizeCmlNumber/validateHuid/parsePurity
prototype/src/lib/kb/store.ts            — KB store (chunks, standards, graph, labs, ahcs, docs)
prototype/src/lib/kb/types.ts            — TypeScript interfaces: KbChunk, KbStandard, KbDoc, LabRecord, AhcRecord, etc.
prototype/src/lib/kb/bm25.ts             — BM25 index + dense cosine search
prototype/src/lib/pipeline/orchestrator.ts — main pipeline: runPipeline()
prototype/src/lib/pipeline/understand.ts — intent classification (Groq JSON + route.ts regex fallback)
prototype/src/lib/pipeline/retrieve.ts   — 4-way hybrid retrieval
prototype/src/lib/pipeline/fuse.ts       — RRF fusion (k=60)
prototype/src/lib/pipeline/floor.ts      — calibrated relevance floor (threshold=0.67)
prototype/src/lib/pipeline/adjudicate.ts — standard adjudication (primary, applies/related, grounding)
prototype/src/lib/pipeline/package.ts    — evidence package builder ([S#] sources with real chunk data)
prototype/src/lib/pipeline/answer.ts     — Groq answer generation (markdown + [S#] citations)
prototype/src/lib/pipeline/trust.ts      — trust gate (strip unknown citations, drop unsupported numbers)
prototype/src/lib/pipeline/respond.ts    — response contract + all card interfaces (LabsCard, AhcCard, etc.)
prototype/src/lib/pipeline/route.ts      — regex routing: gibberish, smalltalk, OOS, identifier, clarify
prototype/src/lib/pipeline/normalize.ts  — query normalization + IS number canonicalization
prototype/src/lib/pipeline/context.ts    — conversation context resolution
prototype/src/app/api/chat/route.ts      — SSE streaming endpoint → runPipeline()
prototype/src/app/api/docs/[docId]/route.ts — PDF serving (whitelisted via docs.json)
prototype/src/app/chat/[id]/page.tsx     — chat workspace UI
prototype/src/app/page.tsx               — home page
prototype/src/components/chat/v9/*.tsx   — chat UI components (AnswerCard, SourceDrawer, Composer, etc.)
prototype/src/components/admin/*.tsx      — admin components (GraphTab, NodeInspector)
prototype/data/kb/chunks.json            — 760 chunks with 1024-dim bge-m3 embeddings
prototype/data/kb/standards.json         — 8 standards registry
prototype/data/kb/graph.json             — 320 nodes, 343 edges
prototype/data/kb/docs.json              — 9 doc entries (doc_id → filename mapping)
prototype/data/kb/calibration.json       — floor threshold: 0.67
prototype/data/directory/labs.json       — 29 BIS LIMS labs
prototype/data/directory/ahc.json        — 1651 Manak Online AHCs
prototype/data/eval/golden.jsonl         — 32 eval cases
```

## Start command
Begin with P5.1 (labs tool). Work through P5 → P6 → P7 → P8 in order.
