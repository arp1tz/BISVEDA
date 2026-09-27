# BISVEDA V9 — Phase 2 Implementation Plan: Knowledge Console

**Status:** Plan Proposed — Awaiting Lead Approval  
**Scope:** Phase 2 — Knowledge Console (Graph View, Version Control, Fact Control, History)  

---

## 1. Plan Overview & Sequence

All changes will be implemented in small, isolated steps with verification (`tsc --noEmit` / `npm run build` and `npm run eval:rag`) after each step.

---

## 2. Numbered Implementation Checklist

### Step 1: Package Dependencies Installation
- [ ] Install `react-force-graph-2d`, `diff`, `@types/diff`, `react-pdf`.
- [ ] Verify `npm run typecheck` passes with zero compiler errors.

### Step 2: Data Models & Persistence Layer Extensions
- [ ] In [prototype/src/lib/knowledge/types.ts](file:///c:/BISVEDA/prototype/src/lib/knowledge/types.ts):
  - Add `AuditLogRecord` (`id`, `at`, `actor`, `action`, `target_type`, `target_id`, `before`, `after`, `note`).
  - Add `VersionImpactResult` (`searchableChunksDelta`, `affectedFactsCount`, `orphanedEdgesCount`).
  - Add `VersionDiffResult` (`addedChunks`, `removedChunks`, `changedChunks` with word-level diffs).
- [ ] In [prototype/src/lib/local-db.ts](file:///c:/BISVEDA/prototype/src/lib/local-db.ts):
  - Add `audit_log` storage (`localInsertAuditLog`, `localGetAuditLogs`).
  - Add version lifecycle methods (`localSubmitVersionForReview`, `localPublishVersion`, `localArchiveVersion`, `localRollbackVersion`).
  - Add `localGetVersionImpact(vid)` and `localDiffVersions(vA, vB)`.
  - Add fact state modification methods (`localApproveFact`, `localRejectFact`, `localEditFact`, `localCreateFact`).
  - When a fact with `object_id` is approved/rejected, atomically update corresponding `kg_edges` status (`approved` vs `rejected`).
- [ ] In [prototype/src/lib/speed-gate.ts](file:///c:/BISVEDA/prototype/src/lib/speed-gate.ts):
  - Export `clearSpeedGateCache(): void`.
- [ ] Create [migrations/002_audit_log.sql](file:///c:/BISVEDA/migrations/002_audit_log.sql):
  - SQL schema for `audit_log` with indexes on `target_type` and `target_id`.

### Step 3: Ingestion Pipeline Version Control Alignment
- [ ] In [prototype/src/lib/ingestion/pipeline.ts](file:///c:/BISVEDA/prototype/src/lib/ingestion/pipeline.ts):
  - Modify staging step to check for existing document versions for the matched standard.
  - Automatically create a `document_versions` record with `status: 'draft'`, incremented `version_no`, `sha256`, and `storage_key`.
  - Assign `doc_version_id` to all newly extracted chunks.
  - Record cited standard references (`outdatedRefs` / cited IS numbers) as `proposed` `REFERENCES` facts and edges.
  - Enforce that new uploads remain in `draft` (never auto-published) until reviewed and explicitly published in the console.

### Step 4: Administrative API Endpoints (`prototype/src/app/api/admin/`)
- [ ] `/api/admin/auth/route.ts`: Authenticate staff with env `STAFF_PASSWORD` (defaulting to `bisveda2026`).
- [ ] `/api/admin/graph/route.ts`:
  - Support query parameters: `focus`, `depth` (1–3), `types`, `includeProposed`.
  - Compute degrees for each node.
  - Cap global graph at 1,500 nodes (excluding `Chunk` and `DocVersion`).
  - In local graph (`focus` supplied), include neighborhood nodes and chunks up to specified depth.
- [ ] `/api/admin/documents/route.ts`: List documents with version summary, chunk counts, and search filter.
- [ ] `/api/admin/documents/[id]/versions/route.ts`: Fetch all versions for a given document.
- [ ] `/api/admin/versions/[vid]/chunks/route.ts`: Paginated and searchable chunk list for a specific version.
- [ ] `/api/admin/versions/[a]/diff/[b]/route.ts`: Chunk-level and word-level diff matching chunks by `clause_id`.
- [ ] `/api/admin/versions/[vid]/[action]/route.ts`: Handle `submit`, `publish`, `archive`, `rollback` with audit log creation and cache invalidation.
- [ ] `/api/admin/versions/[vid]/impact/route.ts`: Pre-publish/archive impact analysis.
- [ ] `/api/admin/facts/route.ts`: Filterable facts list (`status`, `predicate`, `subject`) and manual fact creation.
- [ ] `/api/admin/facts/[id]/route.ts`: Fact review actions (`approve`, `reject`, `edit`) with edge sync, audit log creation, and cache invalidation.
- [ ] `/api/admin/history/route.ts`: Audit log query with filters for `target_type` and `target_id`.

### Step 5: Public Navigation & Discovery Fixes
- [ ] In [prototype/src/components/layout/Navbar.tsx](file:///c:/BISVEDA/prototype/src/components/layout/Navbar.tsx):
  - Remove "Officer Dashboard" button from header navigation (lines 324-341).
  - Remove Officer Ingestion link from eServices dropdown (line 986).
- [ ] In [prototype/src/components/layout/Footer.tsx](file:///c:/BISVEDA/prototype/src/components/layout/Footer.tsx):
  - Add small, discrete "Staff login" link in the bottom legal/footer bar linking to `/admin/knowledge`.

### Step 6: Knowledge Console UI Implementation (`prototype/src/app/admin/knowledge/`)
- [ ] Create layout and design tokens (white surface, slate text, `#0B2A4A` navy primary accent, no gradients):
  - Left panel: 260px (documents list with version status indicators: ● published, ◐ draft/in review, ○ archived, and "+ Upload PDF").
  - Center panel: Dynamic tab views (`Graph`, `Document`, `Facts`, `History`).
  - Right panel: 340px (`NodeInspector` displaying node type, label, status badge, source link, connections list, and action buttons).
- [ ] Create [prototype/src/components/admin/GraphTab.tsx](file:///c:/BISVEDA/prototype/src/components/admin/GraphTab.tsx):
  - Dynamic client-only `react-force-graph-2d` canvas component (`ssr: false`).
  - Node styling: Standard (navy), QCO (red), Scheme (purple), Lab (teal), ProductGroup/Product (amber), Committee (grey), Document/DocVersion (slate), Chunk (light slate), Clause (blue-grey). Node size proportional to √degree.
  - Edges: thin grey lines; `proposed` edges dashed amber; `rejected` hidden unless toggled.
  - Zoom-dependent and hover labels; node selection updating `NodeInspector`; double-click local focus.
  - Filter overlay: type checkboxes, "show proposed", "orphans only".
  - Bottom-left legend.
- [ ] Create [prototype/src/components/admin/DocumentTab.tsx](file:///c:/BISVEDA/prototype/src/components/admin/DocumentTab.tsx):
  - Document versions list with actor, date, and change notes.
  - Actions: *View*, *Compare with...*, *Submit for review*, *Publish*, *Archive*, *Roll back*.
  - Chunks table with clause IDs, pages, breadcrumbs, character previews, token counts, and embedding status badges.
  - Version comparison modal showing added, removed, and modified chunks with word-level diff (`diff`).
  - PDF page viewer (`react-pdf`) showing chunk text highlight, with graceful "File not stored" fallback.
  - Pre-action impact confirmation dialog.
  - Upload PDF drawer triggering the ingestion pipeline and streaming real step events.
- [ ] Create [prototype/src/components/admin/FactsTab.tsx](file:///c:/BISVEDA/prototype/src/components/admin/FactsTab.tsx):
  - Fact review queue filterable by status (`proposed` default), predicate, and subject.
  - Subject -> predicate -> object/value display with source excerpt and link.
  - Actions: Approve, Reject (with mandatory reason), Edit, Add Fact manually.
  - Bulk approval for up to 50 selected facts.
- [ ] Create [prototype/src/components/admin/HistoryTab.tsx](file:///c:/BISVEDA/prototype/src/components/admin/HistoryTab.tsx):
  - Audit log table displaying timestamp, actor, action, target, and expandable before/after state diffs.
- [ ] Create [prototype/src/components/admin/NodeInspector.tsx](file:///c:/BISVEDA/prototype/src/components/admin/NodeInspector.tsx):
  - 340px inspector displaying selected node metadata, status badge, official source URL, neighbor connections list, and quick actions.
- [ ] Create [prototype/src/components/admin/AdminPasswordModal.tsx](file:///c:/BISVEDA/prototype/src/components/admin/AdminPasswordModal.tsx):
  - Simple password gate modal for staff authentication.
- [ ] Create [prototype/src/app/admin/knowledge/page.tsx](file:///c:/BISVEDA/prototype/src/app/admin/knowledge/page.tsx):
  - Root page tying together the console tabs, inspector, and staff authentication state.

### Step 7: Acceptance Verification & Testing
- [ ] Acceptance Check 1: Global graph renders real DB counts (2,870 nodes / 2,607 edges capped per spec) in < 2 s.
- [ ] Acceptance Check 2: Selecting `IS 4151` displays its connected QCO, scheme, labs, product group, versions, and chunks.
- [ ] Acceptance Check 3: Upload a PDF for an existing standard -> appears as `draft`; verify `npm run eval:rag` results do not change.
- [ ] Acceptance Check 4: Publish the draft -> its chunks become searchable. Roll back -> old version becomes active again.
- [ ] Acceptance Check 5: Deterministic Fact Control:
  - Reject the fact behind the helmet QCO `MANDATES` edge -> helmet question returns `qco.status = "unknown"`.
  - Re-approve the fact -> helmet question returns `qco.status = "mandatory"`.
- [ ] Acceptance Check 6: Compare two versions shows added/removed/changed chunks with word-level diffs.
- [ ] Acceptance Check 7: History tab logs all administrative actions with before/after snapshots.
- [ ] Acceptance Check 8: `npm run eval:rag` passes all Phase 1 thresholds (25/25 golden cases, 0 wrong standards, 100% primary/citation/number support).

### Step 8: Phase 2 Report & Sign-Off
- [ ] Write [docs/v9/PHASE_2_REPORT.md](file:///c:/BISVEDA/docs/v9/PHASE_2_REPORT.md) with exact verification outputs, screenshots/logs, and acceptance sign-off.
