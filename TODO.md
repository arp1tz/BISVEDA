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

All are archive.org scans with an OCR layer. IS 1417 has 10 of 12 pages with no text, so it needs RapidOCR.

**Reusable code:**
- `scripts/parse_pdf.py` and `parse_pdf_json.py` (PyMuPDF + tables + RapidOCR)
- `lib/pipeline/{normalize,fuse,floor,trust,respond,context}.ts`
- `components/chat/v9/*`
- `components/admin/{GraphTab,NodeInspector}.tsx` (react-force-graph-2d)
- `api/chat/route.ts` (SSE)
- `tsc` is currently clean.

**Broken or fabricated (replace):**
- the `local-db.ts` store (36 MB, re-parsed on every call; test docs; fake persona; about half the embeddings are hash vectors)
- the silent hash fallback in `embeddings.ts`
- `CLAUSE_RE` in `ingestion/pipeline.ts`
- `product.ts` and the hard-coded maps in `adjudicate.ts` / `route.ts`
- the templated S1/S2 sources in `package.ts`
- all seed JSON, and the lab scopes invented by `seed-facts.ts`
- `calibration.json`
- the vision model ids `gemini-3.8/3.6-flash`
- the `"IS "` substring bug (orchestrator ~L171)
- HUID and purity never being surfaced
- the client ignoring SSE `error` events
- `DEFAULT_RECENT_CHATS`
- MarkVerifier's fake "OPERATIVE" result
- the Form I mock
- hard-coded admin passwords

**Official directories (server-rendered HTML):**
- Lab scope: `https://lims.bis.gov.in/home_lab_scope/{labId}/?page=N`. Columns: IS No. (year) · Product · Grade/Type · Testing charges · Validity · Remark.
- AHCs: `https://www.manakonline.in/MANAK/AHCListForWebsite`. It has Region/State/District filters. Columns: Recognition No · Validity · Name · Address · Metals · Contact · Status.
- The archived `laboratories.json` has 430 rows (OSL code, name, city, state, validity, lat/lng city centroids). Use it only for the join.

---

## P0: Safety and cleanup `[Sonnet 5 / Low–Medium]`
- [ ] **0.1** Snapshot:
  - `git init` in `C:\BISVEDA`.
  - `.gitignore`: node_modules, .next, .env*, `prototype/data/kb/.embcache.json`, `prototype/data/directory/.cache/`.
  - Commit "snapshot before restructure".
- [ ] **0.2** Move the following to `C:\BISVEDA_archive\`, preserving relative paths:
  - **Root:** `repos\`, `_archive\`, `V8\`, `services\`, `infra\`, `docker-compose.yml`, `lib\`, `tests\`, `storage\`, `.agents\`, `.pytest_cache`, `pytest.ini`, `BISVEDA_V8_*.md`, `CONTEXT.md`, `TODO.old.md`, the old `docs\*` (including `docs\v9\`). Move `data\` too, but first move `data\eval\golden.jsonl` into `prototype\data\eval\`.
  - **Move instead of archiving:** `BISVEDA_Architecture_Unified.md` → `docs\reference\`.
  - **Prototype pages (V8):** `about, certification, compare, consumer, contact, documents, quality, research, standards, testing, updates, forms`, plus the old `admin/page.tsx` and `admin/knowledge` (the new `/admin` gets built in P7).
  - **Prototype APIs:** `app/api/v8/*`, `api/verify`, `api/admin/*`.
  - **Prototype components:** `employee/*`, `auth/*`, `layout/*`, `workspace/*`, `features/*`, `evidence/*`, `trust/*`, `standards/*`.
  - **Prototype libs:** `llm-provider, retrieval, speed-gate, adjudicator, conversational-router, orchestrator.ts (old, in lib root), context-resolver, guardrails, dossier-builder, language-gateway, evidence-only, disambiguation, applicability, taxonomy, form-generator, source-registry, db, storage, local-db, chat-storage, standards-helper, ingestion/connectors`.
  - **Prototype data:** `data/*.json` (all seed and fabricated files) and `bisveda_local_db.json`.
  - **Prototype misc:** scratch, test and competitor files, `bis pdfs\`, `src/test_*.ts`, `tsconfig.tsbuildinfo`, `scratch\`.
  - **Keep:** `lib/pipeline/*`, `lib/knowledge/types.ts`, `vision-inspector.ts`, `pdf-parser.ts`, `embeddings.ts`, `ingestion/pipeline.ts` (chunker only), `outdated-checker.ts`, `components/chat/v9/*`, `components/admin/{GraphTab,NodeInspector}.tsx`, `app/{page,layout,globals.css}`, `app/chat/*`, `app/api/chat`, `app/api/sources`, `public/`.
- [ ] **0.3** Move the root `scripts\{parse_pdf.py,parse_pdf_json.py,eval-rag.ts,calibrate-floor.ts}` into `prototype\scripts\`, archive the rest of the root `scripts\`, and fix the `eval:rag` path in package.json.
- [ ] **0.4** Prune deps: remove `pg, @types/pg, @aws-sdk/client-s3, react-pdf, clsx, tailwind-merge`. Keep `react-markdown`, `remark-gfm` and `zod`.
- [ ] **0.5** Fix imports broken by the archive:
  - Create `src/lib/kb/store.ts` with typed stub getters.
  - Point `knowledge/graph-repository.ts` and the pipeline at the stubs (they return empty arrays until P2).
- **Done when:** `npm run typecheck` shows 0 errors; `npm run dev` starts and `/` renders; the root contains only `CLAUDE.md, progress.md, TODO.md, docs/, example docs uploaded by employees/, prototype/, .env*, .gitignore`; changes are committed.

## P1: L0/L2 knowledge base and directories (offline scripts in `prototype/scripts/`)
- [ ] **1.1** `[Sonnet/Medium]` Write `scripts/kb/sources.ts`, building a registry from `download_manifest.json`:
  - Fields: `doc_id, file, standard_id` (e.g. `IS 9873 (Part 1)`), `title, year, domain (helmets|toys|gold|forms), source_url, sha256`.
  - Add the Form I PDF as `doc_id: form-i-jeweller`, `domain: forms`.
  - Exclude the duplicate IS 4151 file, keeping the one with more extracted text. Record the exclusion.
- [ ] **1.2** `[Sonnet/High]` Parse:
  - Call `parse_pdf_json.py` per PDF (reuse the `spawnSync` logic from `pdf-parser.ts`). **No fabricated fallback: throw on failure.**
  - Save to `data/kb/raw/{doc_id}.json`.
  - Strip the "Disclosure to Promote the Right To Information" cover pages and repeated headers/footers (lines that repeat on ≥50% of pages).
- [ ] **1.3** `[Sonnet/High]` Chunk clause-aware, reusing `buildClauseSegments` / `chunkDocument` from `ingestion/pipeline.ts`:
  - New heading regex: `^(\d{1,2}(\.\d{1,2}){0,4})\s+[A-Z][A-Za-z]` or `^ANNEX\s+[A-Z]`. Reject top-level numbers above 40, and years.
  - Target 250–450 tokens, with overlap only inside a clause. Never split tables. Merge chunks under 80 characters into the next one.
  - Schema: `chunk_id, doc_id, standard_id, clause, clause_title, breadcrumb, page_start, page_end, text, tokens, sha256`.
- [ ] **1.4** `[Sonnet/High]` Embed with `GEMINI_EMBED_MODEL` (768-d) via `embeddings.ts`:
  - **Delete the hash fallback.** Retry 3× with backoff, then throw.
  - Cache by text sha256 in `data/kb/.embcache.json`.
  - Embed the string `"{standard_id} {clause_title}\n{text}"`.
- [ ] **1.5** `[Sonnet/Medium]` Build `data/kb/standards.json`: one record per standard, derived only from its PDF (id, title, year, domain, `scope_text` taken verbatim from clause 1, `doc_id`, `chunk_count`).
- [ ] **1.6** `[Sonnet/High]` Build `data/kb/graph.json`:
  - Nodes: `domain:*`, `std:*`, `clause:*` (levels 1–2), `ref:IS xxxx` (IS numbers cited in the text), `form:form-i`, `lab:*` (only labs whose scope includes a KB standard), `ahc-region:{state}`.
  - Edges: `IN_DOMAIN, HAS_CLAUSE, REFERENCES (weight = count), TESTS (lab→std), FORM_FOR (form→IS 1417), HALLMARKS (ahc-region→domain:gold)`.
  - Every edge carries `source` (doc+page, or a directory url).
- [ ] **1.7** `[Sonnet/Medium]` Add `"kb:build": "tsx scripts/kb/build.ts"` to package.json:
  - Runs 1.1–1.6, is idempotent, and prints counts.
  - Commit `data/kb/*.json` (excluding the cache and `raw/`, if they're too big).
- [ ] **1.8** `[Sonnet/High]` Write the labs connector `scripts/directory/labs.ts` (`dir:labs`):
  - First inspect `https://lims.bis.gov.in/` for a listing page that links `home_lab_scope/{id}`. If there isn't one, iterate ids from 1 until 25 consecutive ids are empty (cap 2000).
  - Fetch every `?page=N`, and parse the scope rows plus the lab header.
  - Crawl rules: 1 request/second; HTML cache in `data/directory/.cache/`; `source_url` + `retrieved_at` on every record; fail loudly on schema drift.
  - Join the archived `laboratories.json` by OSL code or name, for city/state/lat/lng only, and mark `geocode:"city-centroid"`.
  - Output `data/directory/labs.json`.
  - **STOP and ask the human** on a CAPTCHA, a login wall, or an unexpected structure.
- [ ] **1.9** `[Sonnet/High]` Write the AHC connector `scripts/directory/ahc.ts` (`dir:ahc`):
  - Parse `{recognition_no, validity, name, address, district, state, pin, metals, contact, status}`.
  - Geocode by PIN or district via OSM Nominatim: 1 request/second, cached, with a `geocode` quality field. Entries that can't be geocoded get `lat/lng: null`; they're listed but not plotted.
  - Output `data/directory/ahc.json`.
- **Done when:**
  - Numbers: 8 standards plus the Form I doc; about 600–1200 chunks; 0 chunks without an embedding.
  - A spot-check of 10 random chunks shows readable text and correct clauses.
  - `labs.json` has labs with IS 4151 or IS 1417 in scope.
  - `ahc.json` has 100 or more centres.
  - All counts are recorded in progress.md.

## P2: L3 store and L4 hybrid retrieval `[Sonnet 5 / High]`
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
