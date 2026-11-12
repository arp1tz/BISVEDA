# BIS VEDA — Target Architecture (end-to-end prototype)

> Status: **APPROVED DIRECTION (2026-11-12), design detail open to review.** Decisions Q1–Q7 from IMPLEMENTATION_ROADMAP.md were approved as recommended. One environment item is still open: this machine has **no Docker and no PostgreSQL** (§16, H1).
> This is the build reference for R1–R5. When the implementation deviates from it, update this file in the same change.
> Notation: **[keep]** existing code reused as is · **[change]** existing code modified · **[new]** new code.

---

## 1. Goals, non-goals, constraints

**Goals**
1. **Real ingestion.** Staff upload a PDF, it is validated, parsed (with OCR where needed), structured into clauses, chunked, embedded and linked; an officer approves it; it becomes searchable without a restart.
2. **Real document management.** Every document, edition, amendment, clause, chunk and job lives in a database. Metadata is editable and audited, and failed jobs can be reprocessed.
3. **Better retrieval.** Structure-aware hybrid retrieval (exact + BM25 + dense + graph → RRF → clause aggregation → cross-encoder rerank → floor), full-clause evidence, edition awareness.
4. **Grounded answers.** Answers use only numbered evidence, and the deterministic trust gate keeps the final say.

**Non-goals for this prototype:** multi-tenant SaaS, Kubernetes, Temporal, Redis, MinIO, Keycloak, Apache AGE, WhatsApp, LiteLLM gateway, GPU anything, STAIR-style model training (see RESEARCH.md).

**Constraints**
- Windows 11 dev machine, 8 cores, 16 GB RAM, no GPU.
- Groq free tier (~200k tokens/day/model).
- Local bge-m3 embeddings only.
- Paid API calls need owner approval.
- Preserve every working feature: chat, tools, voice, vision, Form I, admin graph.

## 2. System context

```
                         ┌──────────────────────────────── Next.js app (prototype/) ────────────────────────────────┐
 Citizen browser ──SSE──►│ /api/chat ─► pipeline/* (understand → retrieve → rerank → adjudicate → answer → trust)    │
 Staff browser ─────────►│ /admin, /api/admin/* (upload, jobs, documents, versions, approve, metadata, audit)          │
                         │ lib/db (pg pool) · lib/kb/store (cached read model, refreshed on index_version change)     │
                         └───────────────┬────────────────────────────────────────────────┬──────────────────────────┘
                                         │ SQL                                            │ writes files
                                         ▼                                                ▼
                         ┌───────────────────────────────┐                ┌────────────────────────────────┐
                         │ PostgreSQL 16                 │                │ prototype/storage/ (gitignored) │
                         │ pgvector · pg_trgm · FTS      │                │ originals/{sha256}.pdf          │
                         │ documents, versions, clauses, │                │ parsed/{version_id}.json        │
                         │ chunks, edges, jobs, audit…   │                └────────────────────────────────┘
                         └───────────────▲───────────────┘                                ▲
                                         │ SQL (SKIP LOCKED job claim)                     │ reads/writes
                         ┌───────────────┴────────────────────────────────────────────────┴──────────────┐
                         │ Ingestion worker (prototype/worker/, Node + tsx, separate process)              │
                         │ parse step ─► spawns python scripts/parse_pdf_json.py (PyMuPDF + RapidOCR)      │
                         │ structure ─► chunk ─► embed (bge-m3, same module as runtime) ─► link ─► stage   │
                         └────────────────────────────────────────────────────────────────────────────────┘
 Model providers: Groq (chat, intent, STT) · Gemini (vision) · local bge-m3 + bge-reranker-v2-m3 (ONNX, CPU)
```

**Processes**: `npm run dev` (web), `npm run worker` (ingestion worker), Postgres. `boot.ps1` starts all three.

**Why a separate worker process**: embedding a 250-chunk standard on CPU takes minutes, and an OCR page takes seconds. Running that inside a Next.js request handler would block the server and die on dev-server reloads. The worker shares the TypeScript code (`src/lib/ingest/*`, `src/lib/embeddings.ts`), so ingestion and query vectors come from **the same embedding code path**.

## 3. Repository layout changes

```
prototype/
├─ db/migrations/0001_init.sql, 0002_….sql      [new] plain SQL, applied in order by scripts/db/migrate.ts
├─ docker-compose.yml                            [new] postgres (pgvector/pgvector:pg16 image)
├─ storage/                                      [new, gitignored] originals/, parsed/
├─ worker/index.ts                               [new] job loop
├─ scripts/db/{migrate,import-json,reset}.ts     [new]
├─ scripts/kb/*                                  [change] become thin CLIs over src/lib/ingest/*
├─ src/lib/db/{client,tx,types}.ts               [new] pg Pool, transaction helper, row types
├─ src/lib/ingest/{validate,parse,structure,chunk,metadata,embed,link,publish,jobs}.ts   [new] (logic moved from scripts/kb)
├─ src/lib/kb/store.ts                           [change] same exports, DB-backed read model
├─ src/lib/kb/bm25.ts                            [change] index built from DB, rebuilt on index_version change
├─ src/lib/retrieval/{clauseResolver,graphExpand,aggregate,rerank,assemble}.ts           [new]
├─ src/lib/pipeline/{retrieve,fuse,floor,package}.ts                                     [change]
├─ src/lib/auth/{session,roles}.ts                                                       [new]
├─ src/app/api/admin/{upload,jobs,documents,versions,metadata,audit}/…                   [new]
└─ requirements.txt                                                                      [new] PyMuPDF, rapidocr-onnxruntime
```

## 4. Data model (PostgreSQL 16)

Extensions: `vector`, `pg_trgm`, `pgcrypto` (for `gen_random_uuid()`). Tables are listed by topic. The migration creates `users` first, because `document_versions` references it.

```sql
-- ── Identity of a standard / form across editions ─────────────────────────────
CREATE TABLE documents (
  id              text PRIMARY KEY,               -- canonical id: 'IS 4151', 'IS 9873 (Part 1)', 'FORM-I'
  doc_type        text NOT NULL CHECK (doc_type IN ('standard','form','guideline')),
  base_number     text,                           -- '9873'  (for exact lookup / trigram)
  part            text,                           -- '1'
  title           text NOT NULL,
  domain          text NOT NULL,                  -- helmets | toys | gold | forms | …  (free text, admin-editable)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_number_trgm ON documents USING gin (id gin_trgm_ops);

-- ── One uploaded file = one version (an edition, or an amendment to an edition) ─
CREATE TABLE document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     text NOT NULL REFERENCES documents(id),
  kind            text NOT NULL CHECK (kind IN ('edition','amendment')),
  base_version_id uuid REFERENCES document_versions(id),   -- amendment → the edition it amends
  edition_label   text,                           -- 'Third Revision'
  edition_year    int,
  amendment_no    int,                            -- for kind='amendment'
  status          text NOT NULL CHECK (status IN
                    ('uploaded','processing','failed','staged','published','superseded','rejected')),
  file_sha256     text NOT NULL,
  file_path       text NOT NULL,                  -- storage/originals/{sha256}.pdf
  file_name       text NOT NULL,
  file_bytes      bigint NOT NULL,
  page_count      int,
  ocr_page_count  int,
  parse_quality   real,                           -- mean page quality 0..1
  source_url      text,
  extracted_meta  jsonb,                          -- what the parser detected (number, title, year…) — suggestions
  uploaded_by     uuid REFERENCES users(id),
  approved_by     uuid REFERENCES users(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  superseded_at   timestamptz,
  embed_model     text,                           -- 'Xenova/bge-m3@fp32' — vectors never mix models
  UNIQUE (file_sha256)                            -- the same file can't be ingested twice
);
-- at most one published edition per document
CREATE UNIQUE INDEX one_published_edition ON document_versions(document_id)
  WHERE status = 'published' AND kind = 'edition';

-- ── Clause tree (STAIR-inspired structure, induced from numbering) ─────────────
CREATE TABLE clauses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES clauses(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('root','front_matter','clause','annex','table','figure','note')),
  number          text,                           -- '7.3.1', 'A-2', 'Table 2', NULL for root/front_matter
  title           text,
  path            text NOT NULL,                  -- 'IS 4151 › 7 Tests › 7.3 Impact absorption'
  ord             int NOT NULL,                   -- document order
  depth           int NOT NULL,
  page_start      int NOT NULL,
  page_end        int NOT NULL,
  text            text NOT NULL,                  -- full clause body (own text only, not children)
  amended_by      uuid[] DEFAULT '{}',            -- amendment version ids touching this clause
  UNIQUE (version_id, ord)
);
CREATE INDEX clauses_version_number ON clauses(version_id, number);

-- ── Retrieval units ────────────────────────────────────────────────────────────
CREATE TABLE chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       text UNIQUE,                    -- old chunk_id from chunks.json (import only)
  version_id      uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  clause_id       uuid NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
  seq             int NOT NULL,                   -- order within clause (long clauses split)
  text            text NOT NULL,
  embed_text      text NOT NULL,                  -- exactly what was embedded (path + text)
  tokens          int NOT NULL,                   -- bge-m3 tokenizer count
  sha256          text NOT NULL,
  embedding       vector(1024) NOT NULL,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('simple', embed_text)) STORED
);
CREATE INDEX chunks_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX chunks_tsv  ON chunks USING gin (tsv);
CREATE INDEX chunks_version ON chunks(version_id);

-- ── Graph ──────────────────────────────────────────────────────────────────────
CREATE TABLE edges (
  id              bigserial PRIMARY KEY,
  src_kind        text NOT NULL,  src_id text NOT NULL,   -- ('clause', uuid) | ('document', 'IS 4151') | ('lab', id) …
  dst_kind        text NOT NULL,  dst_id text NOT NULL,
  type            text NOT NULL CHECK (type IN
                    ('CROSS_REF','CITES_TABLE','REFERENCES_STANDARD','AMENDS','TESTS','HALLMARKS','IN_DOMAIN','FORM_FOR')),
  version_id      uuid REFERENCES document_versions(id) ON DELETE CASCADE,  -- edges extracted from a version die with it
  evidence        text                            -- the matched text, e.g. 'see 5.2'
);
CREATE INDEX edges_src ON edges(src_kind, src_id);
CREATE INDEX edges_dst ON edges(dst_kind, dst_id);

-- ── Directories (from scrapers) ───────────────────────────────────────────────
CREATE TABLE labs (id text PRIMARY KEY, name text NOT NULL, city text, state text, lat double precision,
                   lng double precision, status text, valid_upto text, scope jsonb NOT NULL,
                   source_url text NOT NULL, retrieved_at timestamptz NOT NULL);
CREATE TABLE lab_standards (lab_id text REFERENCES labs(id) ON DELETE CASCADE, document_id text,
                   PRIMARY KEY (lab_id, document_id));
CREATE TABLE ahcs (recognition_no text PRIMARY KEY, name text NOT NULL, address text, district text, state text,
                   pin text, metals text, contact text, status text NOT NULL, validity text,
                   lat double precision, lng double precision, source_url text NOT NULL, retrieved_at timestamptz NOT NULL);

-- ── Jobs ──────────────────────────────────────────────────────────────────────
CREATE TABLE ingestion_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('ingest','reprocess','reembed')),
  state           text NOT NULL CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
  step            text,                           -- validate|parse|structure|chunk|embed|link|stage
  progress        jsonb NOT NULL DEFAULT '{}',    -- {"done":120,"total":249}
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  error           text,
  lease_until     timestamptz,                    -- worker heartbeat; expired lease → re-queued
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz, finished_at timestamptz
);
CREATE INDEX jobs_claim ON ingestion_jobs(state, created_at) WHERE state = 'queued';
CREATE TABLE job_logs (id bigserial PRIMARY KEY, job_id uuid REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
                       at timestamptz NOT NULL DEFAULT now(), level text NOT NULL, step text, message text NOT NULL,
                       data jsonb);

-- ── People, audit, index freshness ────────────────────────────────────────────
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text UNIQUE NOT NULL,
                    password_hash text NOT NULL,          -- scrypt
                    role text NOT NULL CHECK (role IN ('staff','officer','admin')),
                    created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_log (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
                        user_id uuid REFERENCES users(id), action text NOT NULL,   -- upload|approve|reject|edit_meta|reprocess|login…
                        target_kind text, target_id text, before jsonb, after jsonb);
CREATE TABLE index_state (id int PRIMARY KEY CHECK (id = 1), version bigint NOT NULL, changed_at timestamptz NOT NULL);
INSERT INTO index_state VALUES (1, 1, now());
CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
```

**Searchable set** = chunks whose `version_id` belongs to a `published` edition, plus `published` amendments of that edition. One SQL view `searchable_chunks` encodes this, and every retrieval query goes through it. Staged versions are searchable only through the officer's preview endpoint (§9).

**Why amendments are separate versions**: BIS amendments are separate documents that change specific clauses. The prototype stores them as their own clause trees, links them to the clauses they name (`AMENDS` edges, `clauses.amended_by`), and retrieves both. Answers show "amended by Amendment No. N" on affected clauses. Merging the amendment text into the base clause text automatically is out of scope because it is error-prone and needs human review.

## 5. Lifecycles

**Version status**
```
uploaded ─► processing ─► staged ─► published ─► superseded
               │            │
               ▼            ▼
             failed ──(reprocess)──► processing        rejected (terminal, kept for audit)
```
- `publish` is one transaction:
  1. check the version is `staged`;
  2. mark the previously published edition of the same document `superseded`;
  3. mark this version `published`;
  4. update `documents.title/domain` from the version metadata;
  5. bump `index_state.version`;
  6. write an `audit_log` row.
- Publishing an amendment requires its base edition to be published.

**Job state**: `queued → running → succeeded | failed`. A running job holds a lease that it renews every 30 s. A lease that expires (the worker crashed) puts the job back in the queue if `attempts < max_attempts`, otherwise it fails. Every step first deletes its own previous outputs for that version, inside the same transaction as its writes, so retries and reprocessing are idempotent.

## 6. Ingestion pipeline (worker)

| Step | Input → output | Rules | Failure behaviour |
|---|---|---|---|
| **validate** (in the upload API, before any job) | multipart file + form → `document_versions(uploaded)` + file on disk | ≤ 50 MB; `%PDF-` magic bytes; PyMuPDF opens it; not encrypted; SHA-256 not already present (duplicate → 409 with the existing version id); required fields: document id (normalised `IS 4151`, `IS 9873 (Part 1)`), doc type, kind; amendment requires a base edition | Rejected synchronously with a field-level message; nothing stored |
| **parse** | PDF → `storage/parsed/{version}.json` (`RawDoc`, existing contract) | Spawn `python -I scripts/parse_pdf_json.py`, timeout 10 min. Existing logic: native text, `find_tables` → markdown, OCR when a page has < 60 chars or alphanumeric ratio < 0.35. **[change]**: report `ocr_unavailable` per page instead of silently skipping when RapidOCR isn't installed; record per-page quality; strip boilerplate pages (existing patterns in `scripts/kb/parse.ts`) | Python missing / crash → job failed with stderr tail. Doc with > 30% pages unreadable after OCR → fails with "scanned quality too low", which an officer can override with "ingest anyway" |
| **structure** | pages → `clauses` | §6.1 | Zero numbered clauses found → whole doc becomes one `front_matter` + page-level clauses, flagged `structure_quality=low` in the job log and shown to the officer |
| **chunk** | clauses → `chunks` (no vectors yet) | §6.2 | n/a |
| **metadata** | parsed text → `document_versions.extracted_meta` | §6.3 | Never fails the job; mismatches are warnings |
| **embed** | chunks → `chunks.embedding` | §6.4; batches of 16, progress saved after every batch, resumable | Model load failure → job failed (retryable) |
| **link** | clauses → `edges` | §6.5 | Never fails; unresolved references logged |
| **stage** | → `status='staged'` | sanity checks: every chunk has a vector of dim 1024; every clause has a page; counts logged | Check failure → failed |

### 6.1 Clause tree induction (deterministic)
1. Join the page lines in reading order. **[change]** Use PyMuPDF `blocks` sorted by column when the page is detected as two-column (x-gap clustering), which fixes the IS 1417 p.10 interleaving.
2. **Heading candidates** (from the existing regexes in `scripts/kb/chunk.ts`):
   - `^\d{1,2}(\.\d{1,2}){0,4}\s+[A-Z]` (top level ≤ 40);
   - `^ANNEX [A-Z]`;
   - `^[A-Z]-\d+(\.\d+)*` (annex clauses);
   - `^Table \d+`;
   - `^Fig(ure)? \d+`;
   - `^FOREWORD`.
3. **Sequence validation** **[new]**: a numeric candidate is accepted only if it is a plausible successor of the last accepted heading: the next sibling (`7.2 → 7.3`), the first child (`7.3 → 7.3.1`), or the next sibling of an ancestor (`7.3.1 → 7.4`, `7.3.1 → 8`). Small skips (≤ 2) are allowed for clauses the parser lost. Everything else is body text. This removes false headings such as "5 kg mass is dropped…" or table rows.
4. **Parent** = nearest accepted ancestor by numbering. Annex clauses go under their annex. Tables and figures become children of the clause in which their caption appears, and `CITES_TABLE` edges are added from every clause that mentions them.
5. **Title** = heading text up to the first sentence break or 120 chars. If the "title" is a sentence fragment (ends without punctuation and the next line continues lowercase), the clause gets no title and the fragment stays as body text, which fixes "1.2 The helmets covered by this standard are".
6. Text before clause 1 becomes `front_matter` (foreword, committee), replacing the clause "0" bucket. Pages whose clause numbers are garbled (corrupted font, IS 15644) and were not recovered by OCR are attached to the previous accepted clause and flagged in the job log.

### 6.2 Chunking
- One chunk per clause body. A clause body > 450 tokens is split on paragraph boundaries, then sentence boundaries, with no overlap (clause-bounded chunks don't need it). A body < 40 tokens with children is not embedded alone; its text goes into each child's `embed_text` path context.
- A table is never split; one > 1,000 tokens is split by row groups with the header row repeated.
- Token counts come from the bge-m3 tokenizer (transformers.js `AutoTokenizer`), not chars/4.
- `embed_text = "{document_id} ({edition_label} {edition_year}) › {ancestor titles} › {number} {title}\n{chunk text}"`.

### 6.3 Metadata extraction (suggestions, never silently applied)
Taken from the first 3 content pages and the parser's `detectedStandardNumber` / `detectedTitle` / `editionYear`:
- IS number + part;
- title;
- revision label (`(Third Revision)`);
- year;
- amendment number (`AMENDMENT NO. 2`);
- the scope clause (clause 1);
- referenced standards (the clause titled REFERENCES / NORMATIVE REFERENCES).

The upload screen and staging view show these next to the uploader's values; a mismatch on number/part/kind is a blocking warning that the officer must acknowledge.

### 6.4 Embeddings
- Model: `EMBED_MODEL` (default `Xenova/bge-m3`), **dtype pinned explicitly** (`EMBED_DTYPE`, default `fp32`) in `src/lib/embeddings.ts`. The pinned id+dtype string is stored in `document_versions.embed_model`.
- At start-up the web app compares it with the configured model and refuses dense search for versions embedded with a different model (logs an error, BM25 still works), so vectors from two models never mix.
- Mean pooling + L2 normalise (existing). Cosine distance in pgvector.

### 6.5 Graph linking
- `CROSS_REF`: `see|given in|specified in|according to|as per|in accordance with` followed by a clause number, `Annex X` or `Table N`, resolved within the same version.
- `REFERENCES_STANDARD`: `IS\s*\d+(\s*\(Part\s*\d+\))?` → `documents` (it may point to a document we don't hold; the edge is kept, and the target is shown as "not in our documents").
- `AMENDS`: amendment version → the clauses it names ("Substitute the following for 7.3…").
- `TESTS` / `HALLMARKS`: built from the labs and AHC tables (existing logic in `scripts/kb/graph.ts`).

## 7. Query-time retrieval

```
understand.ts [keep]  → English working query, intent, language, history-resolved standards
refs.ts       [new]   → explicit references: {document_id?, clause_number?, table?, annex?}
                         ("IS 4151 clause 7.3", "7.3 of IS 4151", "Table 1 of IS 1417", "annex B")
candidates (parallel, all restricted to searchable_chunks):
  C1 exact-clause  refs with a clause/table → that clause's chunks (+ its children), score pinned
  C2 exact-doc     IS number only → BM25 within that document (existing behaviour)
  C3 BM25          in-process BM25 over embed_text, top 40
  C4 dense         pgvector: ORDER BY embedding <=> $q LIMIT 40  (hnsw.ef_search = 80)
  C5 graph         seeds = top 5 of C1–C4 → add parent clause, CROSS_REF / CITES_TABLE targets (1 hop),
                   plus the conversation-active standard's scope clause (existing carry-over)
RRF (k=60) over the chunk lists [keep fuse.ts maths]
aggregate         chunk → clause: clause score = max(chunk RRF) + 0.25·Σ(other chunk RRF in the same clause)
rerank            bge-reranker-v2-m3 (onnx-community/bge-reranker-v2-m3-ONNX) on top 30 clauses:
                  pair = (English working query, clause path + clause text truncated to 512 tokens)
floor             top rerank score < calibrated τ_rerank AND no C1 hit → not_in_sources refusal
                  (replaces the "any exact/graph hit passes" rule; TD-05)
adjudicate.ts     [keep logic] standard "applies" iff its scope clause is in the reranked top set
assemble          §7.1 → EvidencePackage ([S#] per clause)
answer.ts         [keep] ; trust.ts [keep rules, now on full source text]
```

- **Why BM25 stays in-process** rather than Postgres full-text: `ts_rank` is not BM25, the current BM25 is measured, and at prototype scale (≤ 50k chunks) a rebuild takes well under a second. The index is rebuilt when `index_state.version` changes (checked at most every 5 s and cached). Postgres `tsv` is kept for the admin search box and as a fallback.
- **Why the floor moves to the reranker:** cosine similarity is badly calibrated across query lengths, while cross-encoder scores separate relevant from irrelevant pairs much better. `τ_rerank` is calibrated with `calibrate:floor` against the retrieval eval's in-scope and out-of-scope questions.
- **Latency budget (target, to be measured in R4):**

  | Stage | Target |
  |---|---|
  | understand | ~1 s (Groq) |
  | candidates | < 300 ms |
  | rerank 30 on CPU | ≤ 1.5 s, else rerank 15 or use a quantized model |
  | answer | ~2–4 s (Groq) |

### 7.1 Context assembly (fixes TD-03)
- One `[S#]` source per selected clause, not per chunk: the full clause text (all its chunks in `seq` order) with the clause path as the header.
- If the clause cites a table that is also relevant (it's in the candidates, or the query mentions a number or grade), the table is appended to the same source.
- Budgets: ≤ 1,200 tokens per source, ≤ 6,000 tokens of evidence in total, at most 8 sources. Per standard, the primary standard gets up to 5 sources and other `applies` standards up to 2 each (existing proportions).
- The source carries `{label, document_id, edition_label, edition_year, clause_number, clause_path, page_start, page_end, url (/api/docs/{version}#page=N), text, amended_by[]}`. `Source` in `package.ts` gains the new fields; the existing fields keep their names, so the UI keeps working.
- The trust gate checks figures against exactly the text that the model saw.

## 8. Read model and caching (`lib/kb/store.ts`)

- The existing exported functions (`getAllChunks`, `getStandardById`, `getChunksByStandard`, `getAllLabs`, `getAllAhcs`, `getAllDocs`, `getGraph`, …) keep their signatures and return the **searchable set**.
- They read from Postgres into an in-process cache keyed by `index_state.version`.
- Synchronous getters become `async`; this ripples through roughly 10 call sites, and typecheck finds every one.
- `getGraph()` for the admin explorer is built from `edges` + `clauses` + `documents`.
- Dense search no longer loads vectors into memory; it calls pgvector.

## 9. APIs (new or changed)

All `/api/admin/*` routes require a session. Roles: **S** = staff, **O** = officer, **A** = admin.

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/admin/login`, `POST /api/admin/logout` | – | scrypt check → HMAC-signed session cookie `{uid, role, exp}` |
| `POST /api/admin/upload` (multipart) | S | validate + store + create version + job → `{version_id, job_id}` |
| `GET /api/admin/jobs?state=` · `GET /api/admin/jobs/{id}` | S | job list / detail incl. logs and progress (UI polls every 2 s while running) |
| `POST /api/admin/jobs/{id}/retry` · `POST /api/admin/versions/{id}/reprocess` | S | re-queue |
| `GET /api/admin/documents` · `GET /api/admin/documents/{id}` | S | documents with versions and counts |
| `GET /api/admin/versions/{id}` · `/clauses` · `/chunks?clause=` | S | inspector (clause tree, chunks, edges, extracted metadata, warnings) |
| `PATCH /api/admin/versions/{id}/metadata` | S (draft/staged), O (published) | edit; audited; if a field used in `embed_text` changes → `reembed` job |
| `POST /api/admin/versions/{id}/preview-search` | O | run a query against this staged version only (dry run before approval) |
| `POST /api/admin/versions/{id}/approve` · `/reject` | O | publish transaction / reject with reason |
| `GET /api/admin/audit?target=` | O | audit trail |
| `GET /api/docs/{id}` | public | **[change]** id may be a version uuid → serves `storage/originals`, plus the legacy doc ids |
| `POST /api/chat` | public | **unchanged contract** (SSE `stage` / `response` / `error`) |

## 10. Admin UI

- **Ingestion**: replaces the simulated tab. Upload form with parser suggestions, a job table (state, step, progress, error), and a log drawer.
- **Documents**: document list → versions → inspector (clause tree on the left; on the right the clause text, page link, chunks, edges and amendment notices). Metadata edit form. Approve/Reject with a preview search for officers.
- **Revisions & amendments register**: read from the DB; "Register amendment" means uploading the amendment PDF, so the register no longer has a form-only path.
- **Graph / Directories**: unchanged UI, now fed from the DB.
- Every number shown comes from the DB. No timers fake progress.

## 11. Auth, roles, audit (fixes TD-09)

- `users` table seeded by `scripts/db/create-user.ts` (no default password; the first-run CLI prompts for one).
- Session cookie = base64(payload) + HMAC-SHA256 with `SESSION_SECRET` (env, required ≥ 32 bytes). Middleware verifies the signature and expiry with Web Crypto (Edge-compatible), and route handlers check the role.
- `SameSite=Lax`, `HttpOnly`, `Secure` in production. State-changing admin routes also require an `Origin` header matching the host (CSRF).
- Every state change writes `audit_log`.

## 12. Configuration (env)

| Group | Variables |
|---|---|
| Existing | `GROQ_API_KEY`, `GROQ_CHAT_MODEL`, `GROQ_FAST_MODEL`, `GROQ_STT_MODEL`, `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `EMBED_MODEL` |
| New | `DATABASE_URL`, `EMBED_DTYPE`, `RERANK_MODEL` (default `onnx-community/bge-reranker-v2-m3-ONNX`), `RERANK_TOP_N`, `STORAGE_DIR`, `SESSION_SECRET`, `PYTHON_BIN`, `MAX_UPLOAD_MB` |
| Telephony (existing, env-only after R6) | `EXOTEL_*`, `TWILIO_*` |

## 13. Errors and observability

- Each pipeline stage logs `{conversation_id, stage, ms, counts}` as one JSON line.
- The chat response gains `meta: {degraded?: 'no_llm'|'rate_limited', index_version, timings}`; it's additive, so the UI ignores it until R5.
- Ingestion errors are stored on the job (and visible in the UI), never only in the console.
- Worker crash recovery is lease based (§5).

## 14. Evaluation (approved, Q5)

- `data/eval/retrieval.jsonl`: `{id, query, lang, expect: {standard, clauses: [numbers], kind: 'answer'|'not_in_sources'}}`, 60–100 cases. Gold clause numbers are checked against the PDFs by a person (the owner or me reading the page), and the cases cover:
  - every standard;
  - explicit clause references;
  - layman questions;
  - Hindi / Hinglish;
  - follow-ups;
  - out-of-scope questions.
- `scripts/eval-retrieval.ts`: runs `understand` in **regex-fallback mode only** (no LLM) or takes a pre-written English working query from the case, then retrieval → rerank. It reports Recall@1/5 at clause level, MRR, wrong-standard rate, and the out-of-scope refusal rate. It makes zero paid calls.
- The golden `eval:rag` (paid) runs only at phase gates, with owner approval.

## 15. Migration from the JSON knowledge base (R1.3)

`scripts/db/import-json.ts` reads `data/kb/{docs,standards,chunks,graph}.json` + `data/directory/*` and writes:
- `documents`;
- one `published` edition per doc (sha256 of the PDF in `example docs uploaded by employees/`, file copied to `storage/originals`);
- clauses (one per distinct `(doc, clause)`, parent from numbering, best effort);
- chunks with their **existing vectors** (no re-embedding, so retrieval stays the same);
- edges, labs, AHCs.

Acceptance: the retrieval eval and a manual chat spot check produce the same results as the JSON store. The JSON files stay in git as the import source until R2 re-ingests the 9 PDFs through the real pipeline.

## 16. Risks and open items

| ID | Item | Plan |
|---|---|---|
| H1 | **No Docker or PostgreSQL on the dev machine** | **Decided 2026-11-12: (a) Docker Desktop**; the owner installs it and puts the Docker disk image on D:. Options that were considered: (a) install Docker Desktop (WSL2), recommended for production parity; (b) native PostgreSQL 16 Windows installer + a pgvector build (needs the Visual Studio C++ build tools); (c) PGlite (Postgres compiled to WASM, in-process, supports pgvector + pg_trgm), zero install, but single-process: the worker would have to run inside the web process or through `pglite-socket`. The schema and SQL are identical in all three; `lib/db/client.ts` hides the difference. |
| H2 | Reranker CPU latency unknown | Measure in R4 on 30 pairs; fallbacks: top 15, a quantized ONNX model, or rerank only when the top-2 RRF margin is small |
| H3 | Clause induction errors on badly typeset PDFs | Sequence validation + officer review of the clause tree before approval |
| H4 | `store.ts` going async ripples through the orchestrator | Mechanical; typecheck finds all sites |
| H5 | Embedding drift between runtimes | Same module and pinned dtype; R0 checks that re-embedding a stored chunk gives cosine ≥ 0.999 |
| H6 | Groq quota during development | Retrieval work is measured with the zero-cost eval; paid runs only at gates |
