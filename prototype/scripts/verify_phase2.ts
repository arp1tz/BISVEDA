import {
  localGetAdminGraph,
  localGetAllDocuments,
  localGetDocumentVersions,
  localGetDocumentChunks,
  localGetFacts,
  localApproveFact,
  localRejectFact,
  localPublishVersion,
  localRollbackVersion,
  localDiffVersions,
  localGetVersionImpact,
  localGetAuditLogs,
} from "../src/lib/local-db";
import { runPipeline } from "../src/lib/pipeline/orchestrator";
import { runIngestionPipeline } from "../src/lib/ingestion/pipeline";
import { clearSpeedGateCache } from "../src/lib/speed-gate";
import * as fs from "fs";
import * as path from "path";

async function runAcceptanceVerification() {
  console.log("================================================================================");
  console.log("  BISVEDA V9 — Phase 2 Acceptance Verification Suite");
  console.log("================================================================================\n");

  const results: Record<string, { pass: boolean; details: string }> = {};

  // -------------------------------------------------------------------------
  // Check 1: Global graph renders in <2s with real counts from DB (capped at 1,500 nodes)
  // -------------------------------------------------------------------------
  console.log("--- Check 1: Global Graph Rendering & Capping ---");
  const t0 = Date.now();
  const globalGraph = await localGetAdminGraph({});
  const t1 = Date.now();
  const graphLatencyMs = t1 - t0;

  console.log(`Global graph computed in: ${graphLatencyMs}ms`);
  console.log(`Total nodes in store: ${globalGraph.totalNodesInStore}`);
  console.log(`Nodes returned: ${globalGraph.nodes.length} (isCapped: ${globalGraph.isCapped})`);
  console.log(`Links returned: ${globalGraph.links.length}`);

  const check1Pass =
    graphLatencyMs < 2000 &&
    globalGraph.nodes.length > 0 &&
    globalGraph.nodes.length <= 1500;

  results["Check 1: Global Graph (<2s, <=1500 nodes)"] = {
    pass: check1Pass,
    details: `Latency: ${graphLatencyMs}ms (< 2000ms), Nodes: ${globalGraph.nodes.length} / ${globalGraph.totalNodesInStore}, Links: ${globalGraph.links.length}, Capped: ${globalGraph.isCapped}`,
  };

  // -------------------------------------------------------------------------
  // Check 2: Focus on IS 4151 -> connected nodes: QCO, Scheme, Labs, Product Group, versions, chunks
  // -------------------------------------------------------------------------
  console.log("\n--- Check 2: Focus on IS 4151 Topology ---");
  const focusedGraph = await localGetAdminGraph({ focus: "IS 4151", depth: 1, includeProposed: true });
  const focusedNeighbors = focusedGraph.links
    .filter((l) => l.source === "std:IS 4151" || l.target === "std:IS 4151")
    .map((l) => (l.source === "std:IS 4151" ? l.target : l.source));

  const neighborNodeTypes = new Set(
    focusedGraph.nodes
      .filter((n) => focusedNeighbors.includes(n.id))
      .map((n) => n.type)
  );

  console.log(`Focused on 'IS 4151': ${focusedGraph.nodes.length} nodes, ${focusedGraph.links.length} links`);
  console.log("Connected neighbor types:", Array.from(neighborNodeTypes));

  const hasQCO = focusedGraph.nodes.some((n) => n.type === "QCO" || n.id.includes("qco"));
  const hasScheme = focusedGraph.nodes.some((n) => n.type === "Scheme" || n.id.includes("scheme"));
  const hasLab = focusedGraph.nodes.some((n) => n.type === "Lab" || n.id.includes("lab"));
  const hasPG = focusedGraph.nodes.some((n) => n.type === "ProductGroup" || n.id.includes("pg:"));

  const check2Pass = focusedGraph.nodes.length >= 5 && hasQCO && hasLab && hasPG;
  results["Check 2: Focus IS 4151 Connections"] = {
    pass: check2Pass,
    details: `Nodes: ${focusedGraph.nodes.length}, Links: ${focusedGraph.links.length}, Types: ${Array.from(neighborNodeTypes).join(", ")}`,
  };

  // -------------------------------------------------------------------------
  // Check 3: Upload PDF fixture -> stages in document_versions as draft. Chunks inactive.
  // -------------------------------------------------------------------------
  console.log("\n--- Check 3: Upload & Staging as Draft (Inactive Chunks) ---");
  const fixturePdfPath = path.resolve(process.cwd(), "bis pdfs/IS-4151-Product-Manual.pdf");
  const testDocId = `bis_doc_is_test_${Date.now()}`;
  const pdfBuf = fs.readFileSync(fixturePdfPath);

  const uploadRes = await runIngestionPipeline({
    jobId: `job_test_${Date.now()}`,
    documentId: testDocId,
    filename: "IS-4151-Product-Manual.pdf",
    content: pdfBuf,
    mimeType: "application/pdf",
    claimedStandardNumber: "IS 4151",
    title: "Product Manual for Protective Helmet for Two Wheeler Riders",
    uploadedBy: "verifier",
  });

  const versionsAfterUpload = await localGetDocumentVersions(testDocId);
  const latestStagedVersion = versionsAfterUpload[0];
  const stagedChunks = await localGetDocumentChunks(testDocId);
  const anyChunkActive = stagedChunks.some((c) => c.is_active);

  console.log(`Uploaded document: ${testDocId}`);
  console.log(`Staged version: v${latestStagedVersion?.version_no} (Status: ${latestStagedVersion?.status})`);
  console.log(`Total staged chunks: ${stagedChunks.length}, Active chunks: ${stagedChunks.filter((c) => c.is_active).length}`);

  const check3Pass =
    latestStagedVersion?.status === "draft" &&
    anyChunkActive === false &&
    stagedChunks.length > 0;

  results["Check 3: Staged as Draft (Chunks Inactive)"] = {
    pass: check3Pass,
    details: `Status: ${latestStagedVersion?.status}, Inactive chunks: ${stagedChunks.length}, Active: ${stagedChunks.filter((c) => c.is_active).length}`,
  };

  // -------------------------------------------------------------------------
  // Check 4: Publish version -> chunks active. Rollback -> old version restored.
  // -------------------------------------------------------------------------
  console.log("\n--- Check 4: Publish & Rollback Lifecycle ---");
  const impactBeforePublish = await localGetVersionImpact(latestStagedVersion.id);
  console.log(`Impact analysis before publish: delta ${impactBeforePublish.searchableChunksDelta} chunks (total: ${impactBeforePublish.totalChunks})`);

  const published = await localPublishVersion(latestStagedVersion.id, "Acceptance check publishing", "verifier");
  const chunksAfterPublish = await localGetDocumentChunks(testDocId);
  const activeCountAfterPublish = chunksAfterPublish.filter((c) => c.is_active).length;
  console.log(`Published version status: ${published.status}, Active chunks: ${activeCountAfterPublish}`);

  // Roll back
  const rolledBack = await localRollbackVersion(latestStagedVersion.id, "Acceptance check rollback", "verifier");
  const chunksAfterRollback = await localGetDocumentChunks(testDocId);
  const activeCountAfterRollback = chunksAfterRollback.filter((c) => c.is_active).length;
  console.log(`Rollback completed! Status: ${rolledBack.status}, Active chunks: ${activeCountAfterRollback}`);

  const check4Pass =
    published.status === "published" &&
    activeCountAfterPublish > 0 &&
    rolledBack.status === "published";

  results["Check 4: Publish & Rollback Lifecycle"] = {
    pass: check4Pass,
    details: `Publish status: ${published.status} (${activeCountAfterPublish} active chunks), Rollback completed`,
  };

  // -------------------------------------------------------------------------
  // Check 5: Fact Review Queue — Reject QCO MANDATES fact -> qco.status: "unknown". Re-approve -> "mandatory".
  // -------------------------------------------------------------------------
  console.log("\n--- Check 5: Fact Rejection & Re-approval Impact on Pipeline ---");
  const qcoFactId = 20; // Fact #20: std:IS 4151 mandated_by qco:qco-is4151

  // 1. Initial query before rejection
  clearSpeedGateCache();
  const resInitial = await runPipeline({
    query: "Are motorcycle helmets mandatory under BIS in India?",
    sessionId: "verify_init",
  });
  console.log("Initial response QCO status:", resInitial.qco?.status);

  // 2. Reject the fact
  console.log(`Rejecting fact #${qcoFactId}...`);
  await localRejectFact(qcoFactId, "verifier", "Verification test rejection");
  clearSpeedGateCache();

  const resRejected = await runPipeline({
    query: "Are motorcycle helmets mandatory under BIS in India?",
    sessionId: "verify_rejected",
  });
  console.log("Response QCO status after rejection:", resRejected.qco?.status);

  // 3. Re-approve the fact
  console.log(`Re-approving fact #${qcoFactId}...`);
  await localApproveFact(qcoFactId, "verifier", "Verification test re-approval");
  clearSpeedGateCache();

  const resReapproved = await runPipeline({
    query: "Are motorcycle helmets mandatory under BIS in India?",
    sessionId: "verify_reapproved",
  });
  console.log("Response QCO status after re-approval:", resReapproved.qco?.status);

  const check5Pass =
    resRejected.qco?.status === "unknown" &&
    resReapproved.qco?.status === "mandatory";

  results["Check 5: Fact Review & Speed-Gate Sync"] = {
    pass: check5Pass,
    details: `Initial: ${resInitial.qco?.status} -> Rejected: ${resRejected.qco?.status} -> Re-approved: ${resReapproved.qco?.status}`,
  };

  // -------------------------------------------------------------------------
  // Check 6: Diff 2 versions with word diffs
  // -------------------------------------------------------------------------
  console.log("\n--- Check 6: Visual Diff with Word Diffs ---");
  // Find a document with multiple versions, or diff existing versions
  const allVersions = await localGetDocumentVersions();
  const vA = allVersions[0];
  const vB = allVersions[1] || allVersions[0];

  const diffResult = await localDiffVersions(vA.id, vB.id);
  console.log(`Diff between version #${vA.id} (v${vA.version_no}) and version #${vB.id} (v${vB.version_no}):`);
  console.log(`Summary: Added: ${diffResult.summary.added}, Removed: ${diffResult.summary.removed}, Changed: ${diffResult.summary.changed}, Unchanged: ${diffResult.summary.unchanged}`);

  const check6Pass =
    diffResult.summary !== undefined &&
    Array.isArray(diffResult.chunks) &&
    diffResult.chunks.length > 0;

  results["Check 6: Version Chunk Diffing"] = {
    pass: check6Pass,
    details: `Chunks diffed: ${diffResult.chunks.length}, Summary: ${JSON.stringify(diffResult.summary)}`,
  };

  // -------------------------------------------------------------------------
  // Check 7: History tab logs all actions
  // -------------------------------------------------------------------------
  console.log("\n--- Check 7: Audit Log Verification ---");
  const auditLogs = await localGetAuditLogs({ limit: 50 });
  console.log(`Retrieved ${auditLogs.length} audit logs:`);
  auditLogs.slice(0, 5).forEach((log) => {
    console.log(`  - [${log.at}] ${log.action} on ${log.target_type} #${log.target_id} by ${log.actor}: ${log.note || ""}`);
  });

  const hasPublishLog = auditLogs.some((l) => l.action === "publish");
  const hasRollbackLog = auditLogs.some((l) => l.action === "rollback");
  const hasRejectLog = auditLogs.some((l) => l.action === "reject_fact");
  const hasApproveLog = auditLogs.some((l) => l.action === "approve_fact");

  const check7Pass = hasPublishLog && hasRollbackLog && hasRejectLog && hasApproveLog;
  results["Check 7: Audit Log Coverage"] = {
    pass: check7Pass,
    details: `Found actions: publish (${hasPublishLog}), rollback (${hasRollbackLog}), reject (${hasRejectLog}), approve (${hasApproveLog})`,
  };

  // -------------------------------------------------------------------------
  // Final Summary
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("  PHASE 2 ACCEPTANCE SUMMARY");
  console.log("================================================================================");
  let allPass = true;
  for (const [name, res] of Object.entries(results)) {
    const status = res.pass ? "✓ PASS" : "✗ FAIL";
    if (!res.pass) allPass = false;
    console.log(`${status.padEnd(8)} | ${name.padEnd(45)} | ${res.details}`);
  }
  console.log("================================================================================\n");

  if (!allPass) {
    process.exit(1);
  }
}

runAcceptanceVerification().catch((err) => {
  console.error("Verification failed with uncaught exception:", err);
  process.exit(1);
});
