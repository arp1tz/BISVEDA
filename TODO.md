# BISVEDA Prototype TODO (phased and layer-wise)

Each task lists **Files**, **Do**, **Reuse** and **Done when**. After every task: tick it here, update `progress.md`, run `npm run typecheck` (in `prototype/`), and commit `P{n}.{m}: …`.
The `[model/effort]` tag says which model and effort to run the task with; switch using `/model`.

## Facts already established (don't re-derive)
**Source PDFs** live in `example docs uploaded by employees\` (see `download_manifest.json` for each file's `source_url`):
- IS 1417 (gold fineness and marking, 1999)
- IS 1418 (gold fire assay, 2009)
- IS 15820 (AHC competence, 2009)
- IS 2925 (industrial helmets, 1984)
- IS 4151 (motorcycle helmets, 1993). There are 2 files: the same edition in 2 scans. Keep 1.
- IS 15644 (electric toys, 2006)
- IS 9873 Part 1 (toys, mechanical, 2012)
- IS 9873 Part 3 (toys, element migration, 1999)
- Form I (jeweller registration for hallmarking): 2 pages, 13 fields

All are archive.org scans. **Measured in P1, corrected from an earlier audit's guess: all 9 PDFs are real digital text — 0 pages needed OCR.** Two real content-quality caveats found instead (not OCR): IS 1417 p.10 has genuine 2-column interleaving, and IS 15644 (+ a few IS 9873 Pt.1 pages) have a corrupted embedded font that garbles some clause numbers. See TODO.md P1's done-when block for detail.

**P1 output (the actual knowledge base — read before touching retrieval):**
- `prototype/data/kb/{chunks,standards,graph}.json`: 760 chunks / 8 standards / 320 graph nodes, all with real 768-d Gemini embeddings.
- `prototype/data/directory/{labs,ahc}.json`: 29 labs (BIS LIMS), 1651 AHCs (Manak Online, 1490 geocoded).
- `prototype/scripts/kb/*.ts` and `prototype/scripts/directory/*.ts`: the build/scrape code, rerunnable via `npm run kb:build` / `dir:labs` / `dir:ahc`.

**Reusable code:**
- `lib/pipeline/{normalize,fuse,floor,trust,respond,context}.ts`
- `components/chat/v9/*`
- `components/admin/{GraphTab,NodeInspector}.tsx` (react-force-graph-2d)
- `api/chat/route.ts` (SSE)
- `scripts/kb/embed.ts`'s Gemini-call pattern (retry + no fallback) — the runtime `src/lib/embeddings.ts` still has the old silent hash fallback and needs the same fix, used at query time by retrieval (P2.2).
- `tsc` is currently clean.

**Still broken or fabricated (replace in P2/P3):**
- the silent hash fallback in `src/lib/embeddings.ts` (the *runtime* one — `scripts/kb/embed.ts` is the separate, already-fixed offline-build version)
- `product.ts` and the hard-coded maps in `adjudicate.ts` / `route.ts`
- the templated S1/S2 sources in `package.ts`
- `calibration.json` (stale, from the old local-db corpus — floor 0.5 rejected almost nothing)
- the vision model ids `gemini-3.8/3.6-flash`
- the `"IS "` substring bug (orchestrator ~L171)
- HUID and purity never being surfaced
- the client ignoring SSE `error` events
- `DEFAULT_RECENT_CHATS`
- MarkVerifier's fake "OPERATIVE" result
- the Form I mock
- hard-coded admin passwords

---

## P0: Safety and cleanup `[Sonnet 5 / Low–Medium]` — ✅ DONE
- [x] **0.1** Snapshot:
  - `git init` in `C:\BISVEDA`.
  - `.gitignore`: node_modules, .next, .env*, `prototype/data/kb/.embcache.json`, `prototype/data/directory/.cache/`.
  - Commit "snapshot before restructure".
- [x] **0.2** Move the following to `C:\BISVEDA_archive\`, preserving relative paths:
  - **Root:** `repos\`, `_archive\`, `V8\`, `services\`, `infra\`, `docker-compose.yml`, `lib\`, `tests\`, `storage\`, `.agents\`, `.pytest_cache`, `pytest.ini`, `BISVEDA_V8_*.md`, `CONTEXT.md`, `TODO.old.md`, the old `docs\*` (including `docs\v9\`). Move `data\` too, but first move `data\eval\golden.jsonl` into `prototype\data\eval\`.
  - **Move instead of archiving:** `BISVEDA_Architecture_Unified.md` → `docs\reference\`.
  - **Prototype pages (V8):** `about, certification, compare, consumer, contact, documents, quality, research, standards, testing, updates, forms`, plus the old `admin/page.tsx` and `admin/knowledge` (the new `/admin` gets built in P7).
  - **Prototype APIs:** `app/api/v8/*`, `api/verify`, `api/admin/*`.
  - **Prototype components:** `employee/*`, `auth/*`, `layout/*`, `workspace/*`, `features/*`, `evidence/*`, `trust/*`, `standards/*`.
  - **Prototype libs:** `llm-provider, retrieval, speed-gate, adjudicator, conversational-router, orchestrator.ts (old, in lib root), context-resolver, guardrails, dossier-builder, language-gateway, evidence-only, disambiguation, applicability, taxonomy, form-generator, source-registry, db, storage, local-db, chat-storage, standards-helper, ingestion/connectors`.
  - **Prototype data:** `data/*.json` (all seed and fabricated files) and `bisveda_local_db.json`.
  - **Prototype misc:** scratch, test and competitor files, `bis pdfs\`, `src/test_*.ts`, `tsconfig.tsbuildinfo`, `scratch\`.
  - **Keep:** `lib/pipeline/*`, `lib/knowledge/types.ts`, `vision-inspector.ts`, `pdf-parser.ts`, `embeddings.ts`, `ingestion/pipeline.ts` (chunker only), `outdated-checker.ts`, `components/chat/v9/*`, `components/admin/{GraphTab,NodeInspector}.tsx`, `app/{page,layout,globals.css}`, `app/chat/*`, `app/api/chat`, `app/api/sources`, `public/`.
- [x] **0.3** Move the root `scripts\{parse_pdf.py,parse_pdf_json.py,eval-rag.ts,calibrate-floor.ts}` into `prototype\scripts\`, archive the rest of the root `scripts\`, and fix the `eval:rag` path in package.json.
- [x] **0.4** Prune deps: remove `pg, @types/pg, @aws-sdk/client-s3, react-pdf, clsx, tailwind-merge`. Keep `react-markdown`, `remark-gfm` and `zod`.
- [x] **0.5** Fix imports broken by the archive:
  - Created `src/lib/kb/store.ts` with typed stub getters (empty results, honest — no fabricated data).
  - Repointed `knowledge/graph-repository.ts`, `pipeline/{fuse,package,retrieve}.ts` at the stubs.
  - Also archived whole `lib/ingestion/` (job-runner depended on archived db/storage/local-db); removed the dead `VisualProductInspectorModal` entry point from `/`; stubbed the fabricated `standardsData` import in `vision-inspector.ts` to `[]`; excluded `scripts/` from tsconfig (tsx-run, not part of Next's type graph — `eval-rag.ts`/`calibrate-floor.ts` are non-functional until P1.7/P2.7 rewrite them).
- **Done when:** `npm run typecheck` shows 0 errors; `npm run dev` starts and `/` renders; the root contains only `CLAUDE.md, progress.md, TODO.md, docs/, example docs uploaded by employees/, prototype/, .env*, .gitignore`; changes are committed.
  **✅ Verified:** typecheck 0 errors; `/` and `/chat/[id]` both 200 in dev; root matches exactly. Committed as `638dd9f` (snapshot) + `6cc9441` (P0 cleanup).

## P1: L0/L2 knowledge base and directories (offline scripts in `prototype/scripts/`)
- [x] **1.1** `[Sonnet/Medium]` `scripts/kb/sources.ts`: 9-doc registry (8 IS standards + Form I) with exact filenames/source_urls from `download_manifest.json`. Duplicate IS 4151 scan excluded with a measured reason (46,824 chars/1 table vs. 44,988 chars/0 tables).
- [x] **1.2** `[Sonnet/High]` `scripts/kb/parse.ts`: calls `parse_pdf_json.py` per PDF, no fallback (throws on failure), caches raw parse to `data/kb/raw/{doc_id}.json`. Strips boilerplate pages (RTI disclosure, "BLANK PAGE" copyright stamp, BIS back-cover text, near-empty pages) via `isBoilerplatePage()`. **Measured: all 9 PDFs are real digital text (0 OCR pages needed) — the earlier audit's OCR concern for IS 1417 didn't hold up under direct verification.**
- [x] **1.3** `[Sonnet/High]` `scripts/kb/chunk.ts`: fresh clause-aware chunker (referenced the archived `ingestion/pipeline.ts` for approach only). `CLAUSE_RE` requires a top-level number 1–40 followed by a real word; Annex/Table/Figure handled separately; tiny (<80 char) segments merge into the next chunk; tables never split (tracks `|`-prefixed markdown rows).
- [x] **1.4** `[Sonnet/High]` `scripts/kb/embed.ts`: Gemini `gemini-embedding-001`, 768-d, cached by sha256 in `data/kb/.embcache.json`, no hash fallback — throws after 6 attempts. **Hit the free-tier per-minute quota (HTTP 429) at ~100 calls with concurrency 5**; fixed by embedding sequentially with a 700ms pace in `build.ts` and a 20s backoff specifically on 429 in `embed.ts`.
- [x] **1.5** `[Sonnet/Medium]` `scripts/kb/standards.ts`: scope text from the chunk whose clause is literally "1" (falls back to a title match, then the first chunk — never invented).
- [x] **1.6** `[Sonnet/High]` `scripts/kb/graph.ts`: domain/standard/clause/reference/form nodes built from the chunks themselves; `ref:IS xxxx` extracted via regex over chunk text (self-citations skipped, cross-refs to other KB standards become `std:`→`std:` edges); labs/AHC nodes added automatically if `data/directory/{labs,ahc}.json` already exist on disk.
- [x] **1.7** `[Sonnet/Medium]` `scripts/kb/build.ts` orchestrator + `"kb:build"` script. Fails loudly if any file in the PDFs folder isn't registered in `SOURCES` or `EXCLUDED` (`assertRegistryCoversFolder`).
- [x] **1.8** `[Sonnet/High]` `scripts/directory/labs.ts` (`dir:labs`) — **design changed from the original plan.** Instead of crawling `/home_lab_scope/{id}/` for every lab id, found and verified (via raw HTTP fetch, not guesswork) that `https://lims.bis.gov.in/home/search_is_number/?is_number__doc_no={num}` returns every lab system-wide whose scope includes that exact IS document number, with Lab Name + OSL Code — a global reverse-index lookup instead of a per-lab crawl. Queried once per KB base number (7 requests total), joined to the kept `prototype/data/laboratories.json` by OSL code for city/state/lat/lng. HTML is malformed (some cells close `</th>` instead of `</td>`, and a huge legacy testing-charges modal is embedded inside each row); parsed by stripping HTML comments first, then taking the last two real `<td>` cells in each row as Validity/Remark (verified against raw HTML by hand before writing the parser). **Verified working, real output.**
- [x] **1.9** `[Sonnet/High]` `scripts/directory/ahc.ts` (`dir:ahc`) — **design changed:** the Manak Online list has no pagination; one request returns the entire national list (~1,650 rows) as one table. Geocodes by unique (district, state) pair via OSM Nominatim (not one lookup per centre), 1 req/s, cached to disk — far fewer Nominatim calls than one-per-AHC. Address parsing (district/state/pin) is regex + a hardcoded canonical 36-state/UT list from the site's own dropdown; never guesses a state that isn't literally present in the address text.
- **Done when:**
  - Numbers: 8 standards plus the Form I doc; about 600–1200 chunks; 0 chunks without an embedding.
  - A spot-check of 10 random chunks shows readable text and correct clauses.
  - `labs.json` has labs with IS 4151 or IS 1417 in scope.
  - `ahc.json` has 100 or more centres.
  - All counts are recorded in progress.md.
  **✅ DONE — measured, 2026-09-27:**
  - `kb:build`: **8 standards, 760 chunks, 0 without an embedding** (real Gemini 768-d vectors, verified — not the hash fallback). IS 4151:76, IS 2925:63, IS 15644:58, IS 9873(Pt1):249, IS 9873(Pt3):80, IS 1417:26, IS 1418:54, IS 15820:151, Form I:3.
  - `dir:labs`: **29 labs** (real BIS LIMS data). IS 4151:7, IS 2925:9, IS 15644:16, IS 9873(Pt1):9, IS 9873(Pt3):4, IS 1417:1. Honestly 0 for IS 1418/IS 15820 — those are a test-method standard and an AHC-competence standard, not something a lab gets "recognised" against.
  - `dir:ahc`: **1651 AHCs**, 1512 operative, 1490 geocoded (district/state centroid via Nominatim), 161 listed with no coordinates.
  - Graph: **320 nodes, 343 edges** (4 domain, 8 standard, 214 clause, 38 reference, 1 form, 29 lab, 26 ahc_region).
  - 10-chunk random spot-check: readable text, correct clause/page attribution for 9/10 (Annex D, Table 5, Figure 11, IS 15820 clauses, IS 4151 cl.3, IS 1418 cl.3.3, IS 15820 Annex E all correct).
  - **Two real, honestly-documented limitations found and left as-is (not fixable without a layout-aware PDF parser like `pymupdf_layout`, which the parser's own console warning flags):**
    1. **IS 1417 (gold fineness), page 10:** the source scan has a genuine 2-column layout that PyMuPDF's simple text mode interleaves line-by-line (clause 1.x and clause 3.x text alternate mid-page in the raw extracted text itself — confirmed by reading the raw page text directly, not a chunker bug). Some IS 1417 chunks on that page mix content from two different clauses.
    2. **IS 15644 (electric toys) and, to a lesser extent, IS 9873 Part 1:** several pages have a corrupted/subset font where PyMuPDF extracts the wrong character for clause numbers (observed: "1" extracted as the letter "t"). Those pages fall back to clause "0" (undifferentiated) rather than a fabricated clause number — honest, but citation precision is degraded for that portion of the two documents.
  - `standards.json`'s `scope_text` (descriptive only, not used for RAG citations) is fixed for 7/8 via a raw-page text search that's independent of clause detection; IS 1417 still shows interleaved text for the reason above.
  - Fixed 2 real bugs found during build: (a) the chunk-merge direction was backward instead of forward (fixed in `chunk.ts`, see `mergeTinyForward`); (b) Gemini's free-tier embedding quota (~100 req/min) needed sequential pacing instead of concurrency-5 (fixed in `embed.ts`/`build.ts`).

## P2: L3 store and L4 hybrid retrieval `[Sonnet 5 / High]`
**>>> See `C:\BISVEDA\HANDOFF.md` for exact current state, the next command to run, and every bug found/fixed. This section's checkboxes are stale until that doc's "immediate next step" is done and folded back in here. <<<**
- [ ] **2.1** Write `src/lib/kb/store.ts`: load `data/kb/*.json` and `data/directory/*.json` **once** (module-level cache, paths from `process.cwd()`). Export typed getters.
- [ ] **2.2** Write `src/lib/kb/bm25.ts`:
  - A real BM25 (k1=1.2, b=0.75), with IS tokens like `is4151` kept intact.
  - Dense search: cosine similarity in memory, with the query embedded via Gemini (`RETRIEVAL_QUERY` task type).
- [ ] **2.3** Rewrite `pipeline/retrieve.ts` to run these retrievers in parallel:
  - **exact:** an IS id via `canonicalizeIsNumber` → chunks of that standard, ranked by BM25 within it, and pinned.
  - **bm25:** top 30.
  - **dense:** top 30.
  - **graph:** the standards in the conversation context → their scope chunks.
  - Then `fuse.rrf` (k=60), keeping the max score per source (fix the overwrite bug). Return the top 8.
- [ ] **2.4** Delete `product.ts` and the hard-coded maps in `adjudicate.ts` and `route.ts`. Adjudication becomes:
  - Group the fused chunks by standard. `primary` = the top aggregated standard.
  - `applies` only if that standard's scope chunk is in the top-k; otherwise `related`.
  - `verified` grounding only if a cited chunk has a dense score ≥ floor **and** a BM25 hit.
- [ ] **2.5** Rewrite `package.ts`:
  - `[S#]` = real chunks only (`doc_id, standard_id, clause, page_start, excerpt`, url `/api/docs/{doc_id}#page={page_start}`).
  - Remove the templated sources.
- [ ] **2.6** Rewrite `data/eval/golden.jsonl` with about 30 cases, KB only:
  - 2–3 per standard
  - Form I fields
  - out-of-corpus (LED aquarium strip; pressure cooker, which isn't in the KB)
  - gibberish
  - multi-turn follow-ups
  - Hindi/Hinglish
- [ ] **2.7** Adapt `scripts/eval-rag.ts`. Rewrite `calibrate-floor.ts` against the new store and write `data/kb/calibration.json`, with a threshold between the in-KB and out-of-KB distributions.
- **Done when:** eval retrieval shows primary@1 ≥ 90% on in-KB cases and out-of-corpus refused ≥ 90%. The baseline is recorded in progress.md.

## P3: L5/L6 conversational orchestrator `[Sonnet 5 / High]`
- [ ] **3.1** Write `src/lib/llm.ts` with `groqChat()` and `geminiGenerate()` (with timeouts):
  - Model ids come from env only: `GROQ_CHAT_MODEL`, `GROQ_FAST_MODEL`, `GEMINI_VISION_MODEL`, `GEMINI_EMBED_MODEL`.
  - **Verify the ids via the list-models endpoints** (`GET https://api.groq.com/openai/v1/models`, `GET https://generativelanguage.googleapis.com/v1beta/models`). Never guess.
- [ ] **3.2** Write `pipeline/understand.ts`:
  - Inputs: the Groq fast model in JSON mode, the last 6 turns, the image summary, and `formState`.
  - Output `{intent: kb_question|find_labs|find_ahc|hallmark|mark_check|form_i|smalltalk|out_of_scope|clarify, standalone_query, standards[], product, city, form_updates{}}`.
  - Fallback: the existing regexes in `route.ts`.
- [ ] **3.3** Write `pipeline/answer.ts` to replace `generate.ts`, using the Groq chat model. System prompt:
  - Answer ONLY from the `<evidence sid=…>` blocks, citing `[S#]` after each factual sentence.
  - Say plainly when the documents don't cover something.
  - Reply in the user's language, in markdown, at most about 180 words.
  - Include the history. Wrap user and image text as `<user_provided>`.
  - If there's no key or the call fails, use the evidence-only template.
- [ ] **3.4** Rewrite `pipeline/trust.ts`:
  - Normalise bracket variants and strip any unknown `[S#]`.
  - Drop sentences with an IS number or a number with a unit that isn't present in the cited chunks.
  - If a `kb_question` answer is left with 0 citations, return a `refusal` that lists the standards we hold.
- [ ] **3.5** Rewrite `pipeline/orchestrator.ts` as `runTurn({message, history, image?, formState?, location?}, emit)`:
  - Stages: understand → (vision) → tools → retrieve → answer → trust → respond.
  - Emit only the stages that actually run.
- [ ] **3.6** Update the `respond.ts` contract: `{kind: answer|clarify|refusal|smalltalk|form_question, text, sources[], cards:{labs?,ahc?,hallmark?,mark?,image?,form_i?}, followups[]}`.
- [ ] **3.7** Update `api/chat/route.ts`: accept the new body, stream `stage` and `response` events, and **always** emit `error` with a safe message on failure.
- **Done when:**
  - "tell me about helmets for bikers" cites IS 4151.
  - The follow-up "what impact test does it need?" cites the IS 4151 impact clause.
  - A switch to toys drops the helmet context.
  - "LED aquarium strip" gets a refusal.
  - Eval shows citation validity 100% and 0 wrong standards.

## P4: Multimodal vision `[Sonnet 5 / High]`
- [ ] **4.1** Rename `vision-inspector.ts` to `lib/vision.ts`:
  - Keep only `inspectImage(base64, mime)`: real MIME type, temperature 0, strict JSON output `{category: helmet|toy|gold_jewellery|other_product|not_a_product|unreadable, product_guess, description, label_text, is_numbers[], isi_mark_seen, cml_number, bis_hallmark_seen, purity_mark, huid, confidence_note}`.
  - Delete all mock outputs, `inspectWithSovereignRules`, fake confidences and invented clauses.
- [ ] **4.2** Normalise identifiers:
  - Fix `normalizeCmlNumber` (strip the prefix; 7–10 digits).
  - Add `validateHuid` (`/^[A-Z0-9]{6}$/`).
  - Add `parsePurity` (`22K916` → 22K / 916).
- [ ] **4.3** Orchestrator rules:
  - `not_a_product|unreadable` → a polite refusal that says what the image appears to be.
  - `other_product` → "we only hold documents for helmets, toys, gold hallmarking".
  - helmet/toy → build the query from the vision fields (use regex `\bIS\s?\d`, which fixes the `"IS "` bug), then kb_search. If a mark or CM/L is present, attach a `mark` card ("Licence number read: … Verify on the BIS Care app or Manak Online"). **Never say "valid".**
  - helmet without a mark or IS number → clarify: motorcycle or industrial.
  - gold → a `hallmark` card (BIS logo, purity, HUID format check, and the "verify HUID in BIS Care app" route), plus a kb_search citing IS 1417 on fineness and marking.
  - All vision output is `user_provided`, shown in a "What we read from your photo" box.
- **Done when:** real sample photos in `public/samples/` behave correctly: helmet with ISI, helmet without a mark, hallmarked gold, coffee cup, toy. Delete the SVG mocks.

## P5: In-chat feature tools (`src/lib/tools/`) `[Sonnet 5 / Medium–High]`
- [ ] **5.1** `labs.ts` `findLabs({standard, city?, state?, location?})`:
  - Use `labs.json` scope rows for that standard, with validity not expired.
  - Sort by haversine distance when a location is known, otherwise by city/state match. Return the top 8 with the remark, charges, validity and LIMS `source_url`.
  - The text says "BIS-recognised labs listing IS X in their scope (BIS LIMS, retrieved {date})".
- [ ] **5.2** `ahc.ts` `findAhc({city|state|location})`: status Operative only, sorted by distance or text match, top 10 plus map points.
- [ ] **5.3** `hallmark.ts`: combines the vision fields or typed text ("what is 916", "check HUID AB12C3") into a card plus IS 1417 citations.
- [ ] **5.4** Form I:
  - Transcribe the PDF into `data/kb/form_i_schema.json` (fields 1–13 with the exact printed labels and options).
  - In `tools/form_i.ts`, merge `form_updates` into `formState`, ask for the next 1–3 missing required fields conversationally, and return a `form_i` card when done or when the user asks.
  - Questions about the form cite the Form I PDF chunks.
- [ ] **5.5** Add the page `/form-i/print`:
  - Renders the draft from `formState` (via sessionStorage) in the official order.
  - Header: "DRAFT: prepared with BISVEDA, submit on Manak Online".
  - Uses browser print-to-PDF.
- **Done when:**
  - "where can I test my helmet in Pune" → a labs card with real LIMS rows.
  - "hallmarking centres in Jaipur" → an AHC map card.
  - "I want to register my jewellery shop for hallmarking" → the form flow completes and the print view shows every field.

## P6: XL chat UI (reuse `components/chat/v9`; design tokens unchanged) `[Sonnet 5 / Medium]`
- [ ] **6.1** `chat/[id]/page.tsx`:
  - Send `{message, history, image, formState, location}` and handle the `error` event.
  - Persist conversations in localStorage via a new `lib/conversations.ts` (list, rename, delete).
  - Remove `DEFAULT_RECENT_CHATS`.
  - Read `?q=`.
- [ ] **6.2** `AnswerCard`: markdown (react-markdown + remark-gfm) with `CitationPill`. The Sources list shows standard · clause · page. `SourceDrawer` shows the excerpt plus "Open PDF at page".
- [ ] **6.3** Add `api/docs/[docId]/route.ts`: streams a whitelisted PDF from the registry and replaces `api/sources`.
- [ ] **6.4** Add cards: `LabsCard` (list plus `LabsMapInner`), `AhcCard`, `HallmarkCard`, `MarkCard`, `ImageReadCard`, `FormICard` (editable plus "Open printable draft"). Delete `DetailTabs` and `QcoLine`.
- [ ] **6.5** Home `/`:
  - Search plus image attach go to `/chat/{id}?q=` (image via sessionStorage).
  - Chips: helmet, toy, gold, Form I.
  - A "What I know" line listing the 8 standards.
  - Remove the modal inspector.
- [ ] **6.6** Ask for the user's location only when labs or AHCs are requested; otherwise use the city typed in chat.
- **Done when:** a single conversation covers everything in the P3–P5 criteria without leaving `/chat/[id]`, and refreshing keeps the conversation.

## P7: Employee dashboard `/admin` `[Sonnet 5 / Medium]`
- [ ] **7.1** Auth: `ADMIN_PASSWORD` from env, checked in `api/admin/login` and stored in an httpOnly cookie. Middleware protects `/admin` and `/api/admin/*`.
- [ ] **7.2** Graph tab (Obsidian style, reusing `GraphTab.tsx`):
  - Look: dark canvas `#1e1e1e`, circles coloured by type, size ∝ degree, labels on hover or zoom > 1.5.
  - Interactions:
    - hovering highlights neighbours and fades the rest
    - clicking opens `NodeInspector` (data, edges with their source, and clauses or chunk text)
    - search to focus a node
    - type filter toggles
    - a "local graph" depth 1–2 toggle
  - Data source: `api/admin/graph`, which reads `store.graph`.
- [ ] **7.3** Documents tab: the 10 PDFs (standard, pages, chunk count, source_url). Clicking opens the PDF plus a chunk browser.
- [ ] **7.4** Directory tab: labs and AHC tables with counts, `retrieved_at`, a source link, and search.
- **Done when:** the whole graph renders smoothly, and clicking `std:IS 4151` shows its clauses, references and labs.

## P8: Evaluation and demo `[Opus 5.5 / XHigh for the audit; Sonnet for fixes]`
- [ ] **8.1** `npm run eval:rag` gates: primary@1 ≥ 90%, citation validity 100%, 0 wrong standards, out-of-corpus refusal ≥ 90%. Save results to `data/eval/results/`.
- [ ] **8.2** Write `docs/DEMO.md`: a 5-minute script (helmet question → follow-up → lab finder → helmet photo → gold photo → HUID → Form I → admin graph).
- [ ] **8.3** Final audit:
  - No forbidden jargon in the UI and no mock data.
  - `typecheck` and `build` are green.
  - 5 random `[S#]` citations open to a PDF page that contains the claim.

## Escalate to Opus 5.5 / High+ when
- the RAG returns wrong answers even though the code looks correct
- debugging spans multiple files
- an architecture decision comes up
- a demo-critical bug appears
