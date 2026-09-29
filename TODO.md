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

## P2: L3 store and L4 hybrid retrieval `[Sonnet 5 / High]` — ✅ DONE
- [x] **2.1** `src/lib/kb/store.ts`: loads `data/kb/*.json` and `data/directory/*.json` once (module cache). Typed getters for chunks, standards, graph, labs, ahcs, docs.
- [x] **2.2** `src/lib/kb/bm25.ts`: real BM25 (k1=1.2, b=0.75) + dense cosine search via local bge-m3 (1024-dim, `Xenova/bge-m3`).
- [x] **2.3** `pipeline/retrieve.ts`: exact + bm25(top 30) + dense(top 30) + graph → `fuse.rrf` (k=60, deduped to standards) → top 8.
- [x] **2.4** Deleted `product.ts`. Adjudication groups by standard, `primary` = top aggregated, `applies`/`related` based on scope chunk presence.
- [x] **2.5** `package.ts`: `[S#]` = real chunks only, url `/api/docs/{doc_id}#page={page_start}`.
- [x] **2.6** `data/eval/golden.jsonl`: 32 cases covering all 8 standards, Form I, out-of-corpus, gibberish, follow-ups, Hindi.
- [x] **2.7** `scripts/eval-rag.ts` and `scripts/calibrate-floor.ts` rewritten. `data/kb/calibration.json`: threshold=0.67 (n_in=23, n_out=5, real data).
- [x] **2.8** Gibberish false-positive fix (per-word consonant check + vowel-ratio analysis). Floor false-refusal fix (BM25 pass condition).
- [x] **2.9** Switched embeddings from Gemini (768-dim, quota-limited) to local bge-m3 (1024-dim). Fixed `/api/docs/[docId]` 404 (created route + `docs.json` registry).
- **Done when:** ✅ Eval 29/32, primary@1 93.75% (15/16), citation validity 100% (56/56), wrong-standard 0, number support 100% (53/53).

## P3: L5/L6 conversational orchestrator `[Sonnet 5 / High]` — ✅ DONE
- [x] **3.1** `src/lib/llm.ts`: `groqChat()` with chat/fast model selection, `reasoning_effort: "low"`, timeouts. Model ids from env with verified defaults (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`).
- [x] **3.2** `pipeline/understand.ts`: Groq JSON mode + `route.ts` regex fallback. Outputs intent, standalone_query, standards[], language.
- [x] **3.3** `pipeline/answer.ts`: Groq chat model, grounded markdown with `[S#]` citations, history-aware, evidence-only fallback.
- [x] **3.4** `pipeline/trust.ts`: bracket normalization, unknown `[S#]` stripping, IS-number-aware number validation, Unicode space normalization, decimal-comma handling, 0-citation refusal.
- [x] **3.5** `pipeline/orchestrator.ts`: `runPipeline()` chains understand → (vision) → retrieve → fuse → floor → adjudicate → package → answer → trust. Stage events emitted only when actually run.
- [x] **3.6** `pipeline/respond.ts`: unified contract with all card interfaces (LabsCard, AhcCard, HallmarkCard, MarkCard, ImageReadCard, FormICard).
- [x] **3.7** `api/chat/route.ts`: SSE streaming with stage + response + error events.
- **Done when:** ✅ All criteria verified — IS 4151 cited for helmets, follow-up works, topic switch works, LED aquarium refused, citation validity 100%, wrong-standard 0.

## P4: Multimodal vision `[Sonnet 5 / High]` — ✅ DONE (code-complete, verify in P8)
- [x] **4.1** `lib/vision.ts`: real Gemini vision with `inspectImage(base64, mime)`, strict JSON schema, all 6 categories, model fallback chain.
- [x] **4.2** Identifier normalizers: `normalizeCmlNumber()`, `validateHuid()`, `parsePurity()` — all in `vision.ts`.
- [x] **4.3** Orchestrator vision branches: not_a_product/unreadable → refusal; other_product → "we only hold helmets/toys/gold"; helmet without mark → clarify motorcycle vs industrial; gold → HallmarkCard + IS 1417 search; helmet/toy with mark → MarkCard + kb_search. All vision output tagged as `user_provided`.
- **Done when:** verify sample images work during P8 testing.

## P5: In-chat feature tools (`src/lib/tools/`) `[Sonnet 5 / Medium–High]` — ✅ DONE
- [x] **5.1** `labs.ts` `findLabs({standard, city?, state?, location?})`:
  - Use `labs.json` scope rows for that standard, with validity not expired.
  - Sort by haversine distance when a location is known, otherwise by city/state match. Return the top 8 with the remark, charges, validity and LIMS `source_url`.
  - The text says "BIS-recognised labs listing IS X in their scope (BIS LIMS, retrieved {date})".
- [x] **5.2** `ahc.ts` `findAhc({city|state|location})`: status Operative only, sorted by distance or text match, top 10 plus map points.
- [x] **5.3** `hallmark.ts`: combines the vision fields or typed text ("what is 916", "check HUID AB12C3") into a card plus IS 1417 citations.
- [x] **5.4** Form I:
  - Transcribe the PDF into `data/kb/form_i_schema.json` (fields 1–13 with the exact printed labels and options).
  - In `tools/form_i.ts`, merge `form_updates` into `formState`, ask for the next 1–3 missing required fields conversationally, and return a `form_i` card when done or when the user asks.
  - Questions about the form cite the Form I PDF chunks.
- [x] **5.5** Add the page `/form-i/print`:
  - Renders the draft from `formState` (via sessionStorage) in the official order.
  - Header: "DRAFT: prepared with BISVEDA, submit on Manak Online".
  - Uses browser print-to-PDF.
- **Done when:**
  - "where can I test my helmet in Pune" → a labs card with real LIMS rows.
  - "hallmarking centres in Jaipur" → an AHC map card.
  - "I want to register my jewellery shop for hallmarking" → the form flow completes and the print view shows every field.

## P6: XL chat UI (reuse `components/chat/v9`; design tokens unchanged) `[Sonnet 5 / Medium]` — ✅ DONE
- [x] **6.1** `chat/[id]/page.tsx`:
  - Send `{message, history, image, formState, location}` and handle the `error` event.
  - Persist conversations in localStorage via a new `lib/conversations.ts` (list, rename, delete).
  - Remove `DEFAULT_RECENT_CHATS`.
  - Read `?q=`.
- [x] **6.2** `AnswerCard`: markdown (react-markdown + remark-gfm) with `CitationPill`. The Sources list shows standard · clause · page. `SourceDrawer` shows the excerpt plus "Open PDF at page".
- [x] **6.3** Add `api/docs/[docId]/route.ts`: streams a whitelisted PDF from the registry and replaces `api/sources`.
- [x] **6.4** Add cards: `LabsCard` (list plus `LabsMapInner`), `AhcCard`, `HallmarkCard`, `MarkCard`, `ImageReadCard`, `FormICard` (editable plus "Open printable draft"). Delete `DetailTabs` and `QcoLine`.
- [x] **6.5** Home `/`:
  - Search plus image attach go to `/chat/{id}?q=` (image via sessionStorage).
  - Chips: helmet, toy, gold, Form I.
  - A "What I know" line listing the 8 standards.
  - Remove the modal inspector.
- [x] **6.6** Ask for the user's location only when labs or AHCs are requested; otherwise use the city typed in chat.
- **Done when:** a single conversation covers everything in the P3–P5 criteria without leaving `/chat/[id]`, and refreshing keeps the conversation.

## P7: Employee dashboard `/admin` `[Sonnet 5 / Medium]` — ✅ DONE
- [x] **7.1** Auth: `ADMIN_PASSWORD` from env, checked in `api/admin/login` and stored in an httpOnly cookie. Middleware protects `/admin` and `/api/admin/*`.
- [x] **7.2** Graph tab (Obsidian style, reusing `GraphTab.tsx`):
  - Look: dark canvas `#1e1e1e`, circles coloured by type, size ∝ degree, labels on hover or zoom > 1.5.
  - Interactions:
    - hovering highlights neighbours and fades the rest
    - clicking opens `NodeInspector` (data, edges with their source, and clauses or chunk text)
    - search to focus a node
    - type filter toggles
    - a "local graph" depth 1–2 toggle
  - Data source: `api/admin/graph`, which reads `store.graph`.
- [x] **7.3** Documents tab: the 10 PDFs (standard, pages, chunk count, source_url). Clicking opens the PDF plus a chunk browser.
- [x] **7.4** Directory tab: labs and AHC tables with counts, `retrieved_at`, a source link, and search.
- **Done when:** the whole graph renders smoothly, and clicking `std:IS 4151` shows its clauses, references and labs.

## P8: Evaluation and demo `[Opus 5.5 / XHigh for the audit; Sonnet for fixes]`
- [x] **8.1** `npm run eval:rag` gates: primary@1 ≥ 90%, citation validity 100%, 0 wrong standards, out-of-corpus refusal ≥ 90%. (Established at 29/32).
- [x] **8.2** Write `docs/DEMO.md`: a 5-minute script (helmet question → follow-up → lab finder → helmet photo → gold photo → HUID → Form I → admin graph).
- [x] **8.3** Final audit:
  - No forbidden jargon in the UI and no mock data.
  - `typecheck` and `build` are green.
  - 5 random `[S#]` citations open to a PDF page that contains the claim.

## P9: User-Requested Enhancements & Critical Bug Fixes — ✅ DONE
- [x] **9.1** Git Safety: Verified repository is local-only, zero remotes configured (`git remote -v` empty), not public.
- [x] **9.2** "Labs Near Me" & Manual City Selection:
  - Added "Find Labs Near Me" button with browser geolocation permission request.
  - Computes haversine distance in km from user coordinates to each testing lab.
  - Sorts laboratories ascending by nearest distance with `⚡ {km} km away` badges.
  - Added "Manual City Select" tray with major Indian cities (Delhi NCR, Mumbai, Pune, Nagpur, Wardha, Bengaluru, Chennai, etc.) and custom city text filter.
- [x] **9.3** Canonical Verified FAQ Layer (Speedgate):
  - Created `src/lib/pipeline/speedgate.ts` with canonical Q&A matcher for 50+ high-frequency BIS queries (e.g. "what is hallmarking", "what is HUID", "what is 916 gold", "is helmet mandatory under QCO", "difference between IS 4151 and IS 2925").
  - Evaluated in `orchestrator.ts` before heavy retrieval; returns instant verified answer with official standard citations and cards.
  - Seamlessly falls back to deep retrieval if no canonical match.
  - Strictly zero mention of the word "speedgate" in any customer-facing UI or messages.
- [x] **9.4** ChatSidebar SVG Crash Fix:
  - Fixed `<PanelLeftClose className="h-4 w-4 pointer-events-none" />` at `src/components/chat/v9/ChatSidebar.tsx:54:15`.
  - Added `type="button"` and `aria-label` across all sidebar buttons to prevent extension DOM injection errors.
- [x] **9.5** Form I Conversational Extraction & Cross-Questioning:
  - Added `parseFormInputsFromText` in `src/lib/tools/form_i.ts` for multi-line and key-value inputs (`name ...`, `adress ...`, `constitution ...`, `turnover ...`).
  - Added `form_updates` to LLM schema in `understandTurn`.
  - Enhanced `stepFormI` to acknowledge recorded fields with `✅ Recorded Details:` and prompt user for next missing required fields.
- [x] **9.6** Top Navigation Pages:
  - Created `/standards`: Searchable catalogue of the 8 indexed Indian Standards with scope and official PDF links.
  - Created `/labs`: Directory of all 29 BIS LIMS recognized testing laboratories with map, standard filters, and near-me distance sorting.
  - Created `/testing`: Redirects to `/labs`.
  - Created `/certification`: Interactive guide to Scheme I (ISI mark) and the Hallmarking Scheme with Form I direct action.
  - Updated `AppHeader.tsx` and `ChatSidebar.tsx` navigation links.
- [x] **9.7** Admin Console Fixes:
  - Added `/admin/knowledge` redirect to `/admin`.
  - Fixed localhost cookie setting (`req.nextUrl.protocol === "https:"`) in `/api/admin/login`.
  - Updated `AppFooter.tsx` staff link to `/admin`.
  - Added demo access key hint (`bisveda2026`) on `/admin/login`.
- [x] **9.8** Helpline Feature: Replaced deferred status with active integration in P10.

## P10: Trust Gate Layer for General Queries, Admin Ingestion & Version Control, and Exotel Voice Helpline — ✅ DONE
- [x] **10.1** General Queries & Trust Gate Layer:
  - Created `runTrustGateForGeneralQuery` in `src/lib/pipeline/trust.ts` and updated `runTrustGate(..., { isGeneralQuery: true })`.
  - Validates Indian Standards format while preserving numbered capability lists and step-by-step guidance without dropping lines for lacking `[S#]` citations.
  - Connected in `src/lib/pipeline/orchestrator.ts` for capability queries ("tum kya kar sakte ho", "what can you do", "help", "who are you", etc.).
  - Updated `AnswerCard.tsx` so `response.text` falls back to `refusal.message` and renders `✓ BIS Assistant Guidance`.
- [x] **10.2** Knowledge Graph Glitch & Infinite Refresh Loop Fix:
  - Memoized `handleGraphLoaded` with `useCallback` in `src/app/admin/page.tsx`.
  - Replaced callback prop dependency in `GraphTab.tsx` with `onGraphLoadedRef` and cloned graph nodes/links so force simulations don't trigger parent re-render loops.
  - Stabilized physics with `cooldownTicks={100}` and `warmupTicks={30}`.
- [x] **10.3** Document Ingestion Tab in Employee Console:
  - Added "Document Ingestion" tab to `/admin` navigation in `src/app/admin/page.tsx`.
  - Created `src/components/admin/IngestionTab.tsx` with drag & drop upload, metadata inputs (Standard ID, Title, Domain, Version, Classification), a live 5-step pipeline progress visualizer, real-time log stream, and recent ingestions history table.
  - Implemented supporting API `/api/admin/ingest/route.ts` with authentication.
- [x] **10.4** Document Version Control & Amendments Management:
  - Enhanced `src/components/admin/DocumentsTab.tsx` with dual-mode navigation ("Version Control & Amendments" vs "Clauses & Text Chunks").
  - Displays current active version, superseded historical editions, statutory gazette notifications, and notified amendments log.
  - Added interactive modals to register new revisions or record new amendments with live state updates.
- [x] **10.5** Helpline Voice Call Integration (Exotel + Web/Chat):
  - Reviewed `C:\BISVEDA\BISVEDA_VoiceCall.ipynb` Exotel outbound call mechanics (`https://api.exotel.com/v1/Accounts/{SID}/Calls/connect`).
  - Created `/api/helpline/call` route supporting live Exotel dispatch with fallback simulated queue and 10-digit Indian phone validation.
  - Added "📞 Call Helpline" button on the landing page (`src/app/page.tsx`).
  - Added "Talk on Call" button on chat top bar and header (`src/components/chat/v9/AppHeader.tsx` and `src/app/chat/[id]/page.tsx`).
  - Added inline `HelplineCallCard.tsx` inside chat messages and `HelplineModal.tsx` popup with "You will receive a call shortly" feedback.

## P11: Landing attach/voice UX, working TTS, multilingual layer `[Sonnet 5 / High]` — ✅ DONE
- [x] **11.1** Multilingual core: `detectLanguageInfo` (all Indic scripts + romanized Hindi/Marathi lexicon), LLM `language`/`script`/`english_query` in `understand.ts`, routing/FAQ/retrieval on English, `lib/i18n.ts` (hand-written en/hi/mr, cached LLM translation with number guard), language-aware `answer.ts`, `toAsciiDigits` in `trust.ts`, retrieval variant fallback, Groq 429 retry, `data/eval/multilingual.jsonl` + `npm run eval:multi`.
- [x] **11.2** Landing UI: `AttachMenu` (Camera/Photos/Files, desktop camera modal), `AttachmentPreview` above the search bar, `lib/attachments.ts` downscale; reused in `Composer`.
- [x] **11.3** `lib/voice/tts.ts` + `AnswerCard` read-aloud (voice pick, cleanup, chunking, "no voice installed" note).
- [x] **11.4** `/api/stt` (Groq Whisper) + `useVoiceInput` + `VoiceMicButton`, landing mic, `Composer` mic.
- [x] **11.5** Hands-free voice chat in `/chat/[id]` (`?voice=1`, End chip, auto read-aloud, mic reopens).
- [x] **11.6** Docs: CLAUDE.md voice boundary + `eval:multi`, `.env.example`, progress.md.
- Known: real speech quality (Marathi/Tamil voices) depends on voices installed on the demo machine; `npm run build` not run (dev server shares `.next`).

## P12: Demo polish — UX4G pass, verified FAQs, language picker, About page `[Sonnet 5 / High]` — ✅ DONE
- [x] **12.0** Snapshot commit before the pass, ignored the two UX4G handbook PDFs, tagged `pre-demo-ux`.
- [x] **12.1** UX4G light refinements: Noto Sans (+8 Indic subsets) via `next/font/google`, sentence case on chat/landing eyebrow labels, global `:focus-visible` outline, `AccessibilityBar` (skip link + A-/A/A+ text scale, hidden on `/admin`), `id="main-content"` on every public page, em dashes removed from UI strings and from generated text (`tidyDashes()` in `orchestrator.ts`'s `runPipeline` wrapper + prompt instructions), reworded QCO/gazette overclaims, helpline pill down to one icon reading "Speak with BISVEDA on Call".
- [x] **12.2** Verified FAQs: `speedgate.ts`'s `CanonicalFaqEntry` gained a `verified` flag; audited all 16 entries against real `data/kb/chunks.json` text (`scripts/faq-verify.ts`, read-only). 2 rebuilt from genuine excerpts (`what-is-hallmarking` from IS 15820, `gold-purity-grades-is1417` from IS 1417's terminology clauses) and marked `verified: true`; the other 14 (HUID, QCO, BIS Care app, CM/L, Form I fees, etc. — none of it is in the documents we hold) kept unchanged but `verified: false`. `matchCanonicalFaq()` only ever serves `verified: true` after a runtime guard re-checks sources + runs the answer through `runTrustGate`; everything else falls through to the full pipeline, confirmed by tracing stage events (`understand->search->check->write` actually runs). Guided refusal: `refusalNotInSources()` and the `out_of_scope` branch add one topic-matched link (Manak Online / BIS Care / `/labs`) via a deterministic keyword map.
- [x] **12.3** Read-aloud button state bug: `lib/voice/tts.ts`'s `speak()`/`onSpeakingChange()` now carry an `owner` id so `AnswerCard` can tell whether its own message is the one playing, however `speak()` was triggered. Fixed two real races found via headless-Chrome testing with a fake speech engine: React StrictMode's dev-only mount→cleanup→remount racing the async `speak()` call (deferred-stop pattern), and `stopSpeaking()` reporting the wrong owner to listeners.
- [x] **12.4** Language picker + page translator: `lib/ui-i18n/languages.ts` (English + 22 Eighth Schedule languages), `LanguageContext` (context + localStorage), `LanguagePicker` (searchable dropdown, replaces the dead EN/हिंदी toggle), `PageTranslator` (walks text nodes + placeholder/title/aria-label, `translate="no"` on answer body/citations/standard pills/source drawer/user messages, debounced `MutationObserver`, restores originals on switch back to English), `/api/translate-ui` + `translateUiBatch()` in `lib/i18n.ts` (batched ~40 strings/call, shares `translateTo`'s cache). `preferredLanguage` flows chat page → `/api/chat` → `runPipeline` → `understandTurn`, overriding the reply language only when the message itself is in English. Verified with headless Chrome (mocked API) and directly against `understandTurn()`.
- [x] **12.5** `/about`: what BISVEDA is, the 5 core features + Form I + helpline as cards, 3 accuracy bullets, current coverage (8 standards + note that ingestion scales to BIS's 23,300+ catalogue), "planned for the full version" as collapsed `<details>` accordions.
- [x] **12.6** Docs: this section, progress.md Latest State, CLAUDE.md architecture line for `lib/ui-i18n`/`PageTranslator`.
- Known: `npm run eval:rag` hit Groq's daily token quota mid-session (see progress.md); re-run once it resets for a real number. `npm run build` not run this pass (dev server shares `.next`).

## Follow-ups & Backlog
- [ ] **Re-run `npm run eval:rag` and `npm run eval:multi` once Groq's daily token quota resets.** The P12 session's numbers (23/32 golden) were degraded by quota exhaustion (confirmed 429 "tokens per day" error from heavy interactive testing), not a real regression; re-run both and update `progress.md`/`data/eval/results/baseline.json` with the clean numbers.
- [ ] **Telephony Session Context Continuation Pipeline (Exotel + Gemini Live)**:
  - Connect ongoing chat session transcript (`/chat/[id]`) to Exotel outbound call triggers via `/api/helpline/call`.
  - When the user selects "Continue call from this conversation" in `HelplineModal`:
    - Serialize chat history (last N user queries, identified standards, QCO applicability findings, and recorded Form I fields).
    - Summarize context into a concise telephony pre-prompt or seed state passed to the Gemini Live Webhook / Exotel session parameters.
    - Enable seamless transition from web chat to phone call without forcing the caller to repeat previous questions.

## Escalate to Opus 5.5 / High+ when
- the RAG returns wrong answers even though the code looks correct
- debugging spans multiple files
- an architecture decision comes up
- a demo-critical bug appears



