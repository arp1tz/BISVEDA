# BISVEDA V9 — Phase 2 Audit: Knowledge Console (Graph, Version Control & Fact Control)

**Date:** 2026-09-27  
**Status:** Audit Complete — Read-Only Inspection (Awaiting Human Lead Review)  
**Lead:** Antigravity (Pair Programming Agent)  

---

## 1. Executive Summary

Phase 2 builds the **Knowledge Console** (`/admin/knowledge`) for BIS staff to govern and audit the Knowledge Layer established in Phase 1. Through this console, staff can:
1. Explore and inspect the interactive Obsidian-style Knowledge Graph (`react-force-graph-2d`), examining connections between Standards, Clauses, QCOs, Schemes, Labs, Product Groups, Products, Documents, Versions, and Chunks.
2. Manage Document Version Control ("Git for PDFs") including draft versioning, chunk inspection, word-level chunk diffs (`diff`), impact preview, single-transaction publish/archive/rollback, and PDF page viewing (`react-pdf`).
3. Oversee Atomic Fact Control with an approval/rejection queue that dynamically controls `kg_edges` (e.g., rejecting a QCO `MANDATES` fact immediately transitions the assistant's answer from `mandatory` to `unknown`).
4. Review the full Audit Log (`audit_log`) tracking all state-altering administrative actions.

This audit inspects the existing administrative routes, client/server authentication, ingestion pipelines, database health and record counts, and specifies every change required to satisfy Phase 2 acceptance criteria.

---

## 2. Existing Administrative Routes & Components

### 2.1 Route: `/admin` (`prototype/src/app/admin/page.tsx`, 147 lines)
- **Current Behavior:** Renders the "Officer Ingestion Console".
- **Access Guard:** Checks `user?.role === "employee"` from client-side `loadStoredUser()` (`localStorage`). If not authenticated, renders a lock screen with a button opening `LoginModal` with `initialTab="employee"`. If authenticated, renders the monolithic `EmployeePipeline` component.
- **Deficiencies:**
  - Route `/admin/knowledge` does **not exist**.
  - No tabs for Graph View, Version Control, Fact Queue, or Audit History.
  - The UI uses heavy colored gradients and saturated orange accents, inconsistent with Phase 2/3 design tokens (white surface, slate text, single navy accent `#0B2A4A`, no gradients).

### 2.2 Component: `EmployeePipeline` (`prototype/src/components/employee/EmployeePipeline.tsx`, 2,609 lines)
- **Current Behavior:** A monolithic, 2600+ line component managing batch uploads, queue state, stage events, a staged chunk editor modal (`StagedChunkEditorModal.tsx`), and Gazette QCO air-gapped staging.
- **Deficiencies:**
  - Directly couples upload UI to immediate database staging.
  - Does not link uploads to `document_versions` with explicit draft status.
  - Exceeds the 400-line modularity rule (Rule 0.4.9). Phase 2 requires clean, modular components (`GraphTab`, `DocumentTab`, `FactsTab`, `HistoryTab`, `NodeInspector`, each under ~400 lines).

### 2.3 Component: `StagedChunkEditorModal` (`prototype/src/components/employee/StagedChunkEditorModal.tsx`, 447 lines)
- **Current Behavior:** Modal for editing chunk text, clause titles, numbers, and verification status before publishing.
- **Deficiencies:** Operates purely on transient job chunks in memory or local state, without tracking version differences, diffs, or audit logging.

---

## 3. Authentication & Staff Access Control

### 3.1 Current Auth Implementation
- **Files:** `prototype/src/components/auth/LoginModal.tsx` (291 lines) and `prototype/src/lib/chat-storage.ts`.
- **Mechanism:** Stores a `UserProfile` object in browser `localStorage`.
- **Vulnerabilities / Gaps:**
  - `LoginModal.tsx:247-270` offers "1-Click Officer Demo Access" (`Dr. A. K. Verma`, `Priya Sen`) that sets `role: "employee"` without password verification.
  - Anyone can access `/admin` by simply clicking a button in the browser.
  - No server-side password validation or session token exists.

### 3.2 Navigation & Discoverability Violations
- **Navbar (`prototype/src/components/layout/Navbar.tsx:324-341` & `986`):**
  - Renders a prominent "Officer Dashboard" button with a `Layers` icon in the main public navigation when `user.role === "employee"`.
  - Links to `/admin` within the public "e-Services" mega-menu.
  - **Spec Violation:** Phase 2 §2.0 explicitly mandates:
    > *"Remove the 'Officer Dashboard' button from the public navbar; staff reach it from a small 'Staff login' link in the footer."*
- **Footer (`prototype/src/components/layout/Footer.tsx:1-176`):**
  - Currently contains no "Staff login" link.

---

## 4. Ingestion Pipeline & Job/Event Storage

### 4.1 Ingestion Orchestrator (`prototype/src/lib/ingestion/pipeline.ts`)
- **Job & Event In-Memory Store:**
  - `pipeline.ts:540-545`: `ingestionStore = Map<string, IngestionResult>()`.
  - Emits `IngestionJobEvent` with fields: `jobId`, `step`, `status`, `startedAt`, `completedAt`, `durationMs`, `counts`, `warnings`, `error`, `metadata`.
- **Persistence Store (`prototype/src/lib/local-db.ts:368-393`):**
  - `localSaveIngestionJob()` records job metadata and event arrays in `store.ingestion_jobs[jobId]`.
- **Critical Pipeline Deficiencies (Lines 795–857):**
  - When a PDF is ingested, `pipeline.ts` writes directly to `documents` and `chunks`.
  - It does **not** create a row in `document_versions` with status `'draft'`.
  - It does **not** set `doc_version_id` on the generated `chunks`.
  - It automatically sets `status = 'published'` if `verificationStatus === 'verified'`, violating the requirement that uploads must start as `draft` and only become searchable when an officer clicks **Publish** in the Knowledge Console.
  - It does **not** extract cited Indian Standards as `proposed` `REFERENCES` facts/edges.

---

## 5. Knowledge Layer Database Health & Table Counts

Live audit ran via `prototype/audit_phase2.js` against the active local persistence store (`data/bisveda_local_db.json` & `prototype/data/bisveda_local_db.json`):

### 5.1 Relational & Facts Tables
| Table / Entity | Row Count | Status / Notes |
|---|---|---|
| `documents` | **20** | Canonical registered standards documents |
| `document_versions` | **20** | **20 published**, 0 draft, 0 in_review, 0 archived |
| `chunks` | **2,028** | All with 768-d Gemini embeddings and weighted `tsv` |
| `standards` | **108** | Full catalogue entries with normalized IDs |
| `qcos` | **108** | Quality Control Orders (mandatory/in-force) |
| `qco_standards` | **130** | QCO to Standard links |
| `schemes` | **5** | Schemes I, II, X, FMCS, Hallmarking |
| `standard_schemes` | **109** | Standard to Scheme links |
| `labs` | **461** | BIS-recognized laboratories |
| `lab_scopes` | **794** | Lab accreditation scope links |
| `facts` | **288** | **288 approved**, 0 proposed, 0 rejected |
| `ingestion_jobs` | **21** | Stored historical ingestion jobs |
| `audit_log` | **0** | **Missing** — Schema & persistence not yet implemented |

### 5.2 Knowledge Graph Nodes (`kg_nodes`: 2,870 Total)
| Node Type | Count |
|---|---|
| `Standard` | 108 |
| `QCO` | 108 |
| `Scheme` | 5 |
| `Lab` | 461 |
| `ProductGroup` | 25 |
| `Product` | 288 |
| `Document` | 20 |
| `DocVersion` | 20 |
| `Chunk` | 1,000 (capped in global graph per spec) |
| `Clause` | 835 |

### 5.3 Knowledge Graph Edges (`kg_edges`: 2,607 Total)
| Edge Type | Count | Status Breakdown |
|---|---|---|
| `ACCREDITED_FOR` | 738 | 738 approved |
| `IS_A` | 311 | 311 approved |
| `HAS_CLAUSE` | 270 | 270 approved |
| `MANDATES` | 130 | 130 approved |
| `CERTIFIED_UNDER` | 109 | 109 approved |
| `COVERS` | 25 | 25 approved |
| `HAS_VERSION` | 20 | 20 approved |
| `DOCUMENTS` | 4 | 4 approved |
| `HAS_CHUNK` | 1,000 | 1,000 approved |
| **Total** | **2,607** | **2,607 approved**, 0 proposed, 0 rejected |

---

## 6. Actual Bugs & Gaps Found (File + Line + Root Cause)

| # | File & Line | Issue / Root Cause |
|---|---|---|
| **B2.1** | `prototype/src/app/admin/page.tsx:1-147` | Only renders the old `EmployeePipeline`. The dedicated route `/admin/knowledge` and its 4 tabs (`Graph`, `Document`, `Facts`, `History`) and `NodeInspector` do not exist. |
| **B2.2** | `prototype/src/components/layout/Navbar.tsx:324-341, 986` | Exposes "Officer Dashboard" button and dropdown links to the public. Must be removed from navbar. |
| **B2.3** | `prototype/src/components/layout/Footer.tsx:160-176` | Lacks a discrete "Staff login" link in the footer leading to `/admin/knowledge`. |
| **B2.4** | `prototype/src/components/auth/LoginModal.tsx:223-270` | Unprotected client-side demo officer authentication. Requires a secure password gate (env `STAFF_PASSWORD`, defaulting to `bisveda2026`). |
| **B2.5** | `prototype/src/lib/ingestion/pipeline.ts:795-857` | Uploads do not write to `document_versions` as `draft`, do not link `chunks.doc_version_id`, and auto-publish instead of waiting for staff review. |
| **B2.6** | `prototype/src/lib/speed-gate.ts:11-13` | `queryCache` is a private, unexported in-memory map. When a document version is published/archived or a fact is approved/rejected, cache invalidation cannot occur. |
| **B2.7** | `prototype/src/lib/local-db.ts` | Lacks `audit_log` storage, lacks atomic version lifecycle functions (`submitForReview`, `publishVersion`, `archiveVersion`, `rollbackVersion`), and lacks fact state transitions that dynamically update `kg_edges`. |
| **B2.8** | `prototype/src/app/api/admin/` | Zero administrative API endpoints exist. All graph queries, version actions, diffs, fact moderation, and audit logs lack backend handlers. |

---

## 7. Exact Files to Change & Create

### 7.1 New Dependencies (Validated via dry run)
- `react-force-graph-2d`: Canvas 2D force-directed graph renderer (supports >1,500 nodes).
- `diff` & `@types/diff`: Word-level and chunk-level text diffing between document versions.
- `react-pdf`: Rendering stored PDF pages directly in the document tab viewer.

### 7.2 Backend & Data Layer Files to Create / Modify
1. `prototype/src/lib/knowledge/types.ts`: Add `AuditLogRecord`, `VersionImpactResult`, `VersionDiffResult`, and expand graph filter types.
2. `prototype/src/lib/local-db.ts`:
   - Add `audit_log` storage (`localInsertAuditLog`, `localGetAuditLogs`).
   - Add version lifecycle methods (`localSubmitVersionForReview`, `localPublishVersion`, `localArchiveVersion`, `localRollbackVersion`, `localGetVersionImpact`, `localDiffVersions`).
   - Add atomic fact transition methods (`localApproveFact`, `localRejectFact`, `localEditFact`, `localCreateFact`) with automatic synchronization of `kg_edges` (`approved` vs `rejected`).
3. `prototype/src/lib/speed-gate.ts`: Export `clearSpeedGateCache()` for immediate invalidation upon staff actions.
4. `prototype/src/lib/ingestion/pipeline.ts`: Update ingestion staging to create `draft` document versions, link `doc_version_id`, and emit `REFERENCES` edges as `proposed`.
5. `migrations/002_audit_log.sql`: Create PostgreSQL `audit_log` table with indexes.

### 7.3 Administrative API Endpoints to Create (`prototype/src/app/api/admin/`)
1. `/api/admin/auth/route.ts`: Password verification gate (`POST`) and session check (`GET`).
2. `/api/admin/graph/route.ts`: Filtered graph query returning nodes (with degrees and types) and edges (global capped at 1,500; local neighborhood depth 1–3).
3. `/api/admin/documents/route.ts`: List documents with search and version counts (`GET`), upload new document draft (`POST`).
4. `/api/admin/documents/[id]/versions/route.ts`: List versions for a document (`GET`).
5. `/api/admin/versions/[vid]/chunks/route.ts`: List chunks for a version (`GET`).
6. `/api/admin/versions/[a]/diff/[b]/route.ts`: Word-level chunk diff between two versions (`GET`).
7. `/api/admin/versions/[vid]/[action]/route.ts`: Lifecycle actions (`submit`, `publish`, `archive`, `rollback`) (`POST`).
8. `/api/admin/versions/[vid]/impact/route.ts`: Pre-publish/archive impact analysis (`GET`).
9. `/api/admin/facts/route.ts`: List filtered facts (`GET`), add manual fact (`POST`).
10. `/api/admin/facts/[id]/route.ts`: Approve, reject, or edit fact (`PATCH`).
11. `/api/admin/history/route.ts`: Audit log listing with filters (`GET`).

### 7.4 UI Pages & Components to Create / Modify (`prototype/src/app/admin/knowledge/` & `components/admin/`)
1. `prototype/src/app/admin/knowledge/page.tsx`: Main Knowledge Console page container (layout: 260px left sidebar, center main panel, 340px right inspector).
2. `prototype/src/components/admin/KnowledgeConsoleLayout.tsx`: Header, search box, staff dropdown, tab switcher (`Graph`, `Document`, `Facts`, `History`).
3. `prototype/src/components/admin/GraphTab.tsx`: Dynamic client-only `react-force-graph-2d` graph viewer, type filters, orphan toggle, proposed toggle, legend.
4. `prototype/src/components/admin/DocumentTab.tsx`: Document versions manager, chunk table, word-level diff viewer, PDF viewer with chunk text highlight, draft upload trigger.
5. `prototype/src/components/admin/FactsTab.tsx`: Fact approval/rejection/editing queue, chunk excerpt highlight, source links, bulk approval.
6. `prototype/src/components/admin/HistoryTab.tsx`: Audit log table with before/after JSON diffs and actor records.
7. `prototype/src/components/admin/NodeInspector.tsx`: Right sidebar (340px) displaying selected node details, status badge, source links, neighborhood connections, and quick actions.
8. `prototype/src/components/admin/AdminPasswordModal.tsx`: Staff password prompt gate.
9. `prototype/src/components/layout/Navbar.tsx`: Remove "Officer Dashboard" button and admin dropdown link.
10. `prototype/src/components/layout/Footer.tsx`: Add "Staff login" link in the bottom legal / footer bar.

---

## 8. Verification Strategy for Acceptance Criteria

1. **Global Graph Performance:** Graph renders 108 Standards, 108 QCOs, 461 Labs, 288 Products, and Schemes in < 2 s (total ≤1,500 nodes).
2. **Local Graph Traversal:** Selecting `IS 4151` displays its connected QCO (`qco:helmet-2020`), scheme (`scheme:scheme-1`), labs, product groups, versions, and chunks.
3. **Draft Isolation:** Uploading a PDF creates a `draft` version; verify `npm run eval:rag` results are unchanged until published.
4. **Publish & Rollback:** Publishing activates new chunks in retrieval. Rolling back restores the prior published version.
5. **Deterministic Fact Control:**
   - Reject the fact behind helmet QCO `MANDATES` edge -> helmet evaluation returns `qco.status = "unknown"`.
   - Re-approve the fact -> helmet evaluation returns `qco.status = "mandatory"`.
6. **Version Diff:** Word-level diff correctly highlights added, removed, and modified chunks between two versions.
7. **Audit Log:** Every action (submit, publish, archive, rollback, fact approve/reject/edit) creates an immutable `audit_log` row.
8. **Regression Defense:** `npm run eval:rag` passes all Phase 1 golden cases (25/25, 0 wrong standards, 100% primary/citation/number support).

---

**STOP. Audit is complete and ready for human review before any code is modified.**
