/**
 * BISVEDA — Batch Document Ingestion Script
 * Processes PDFs from a directory through the 10-step Sovereign Document Ingestion Pipeline:
 * - Intake & Integrity (SHA-256)
 * - Document Intelligence (PyMuPDF layout + table extraction + clause detection)
 * - Sovereign Clause Hierarchy & Token Bounding (Clause-aware chunking)
 * - Vector Embeddings (Gemini 768-dim embeddings)
 * - Persistence & Indexing (PostgreSQL pgvector / Local Sovereign Store)
 * - Auto-Publishing (Active status for search retrieval)
 *
 * Usage:
 *   npx tsx scripts/ingest_folder.ts ["example docs uploaded by employees"] [--limit 5]
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Ensure prototype .env is loaded
const envPaths = [
  path.resolve(process.cwd(), "prototype/.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../prototype/.env"),
  path.resolve(__dirname, "../.env"),
];
for (const ep of envPaths) {
  if (fs.existsSync(ep)) {
    const lines = fs.readFileSync(ep, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let targetFolder = "example docs uploaded by employees";
  let maxDocs = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      maxDocs = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith("--")) {
      targetFolder = args[i];
    }
  }

  const folderPath = path.resolve(process.cwd(), targetFolder);
  if (!fs.existsSync(folderPath)) {
    console.error(`[-] Target folder does not exist: ${folderPath}`);
    process.exit(1);
  }

  console.log("=" .repeat(75));
  console.log("  BISVEDA — Sovereign Document Ingestion Engine");
  console.log(`  Source Directory : ${folderPath}`);
  console.log(`  Ingestion Limit  : ${maxDocs} document(s)`);
  console.log("=" .repeat(75));

  // Check manifest if present
  let manifest: any[] = [];
  const manifestPath = path.join(folderPath, "download_manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      console.log(`  [i] Found download manifest with ${manifest.length} record(s).`);
    } catch {}
  }

  // Find all PDF files
  const allFiles = fs.readdirSync(folderPath);
  const pdfFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.log("[-] No PDF documents found in target folder.");
    process.exit(0);
  }

  console.log(`  [+] Found ${pdfFiles.length} PDF(s). Processing top ${Math.min(pdfFiles.length, maxDocs)}...`);

  // Dynamically import pipeline & db
  const { runIngestionPipeline } = await import("../prototype/src/lib/ingestion/pipeline");
  const { initDb, getDocumentBySha256 } = await import("../prototype/src/lib/db");

  await initDb();

  const selectedFiles = pdfFiles.slice(0, maxDocs);
  const summaryReport: any[] = [];
  const overallStart = Date.now();

  for (let idx = 0; idx < selectedFiles.length; idx++) {
    const filename = selectedFiles[idx];
    const filePath = path.join(folderPath, filename);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);

    // Look up manifest metadata
    const metaRecord = manifest.find((m) => m.saved_filename === filename || m.original_pdf_name === filename);
    const claimedStd = metaRecord?.title?.match(/\bIS\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?:\s*:\s*\d{4})?)/i)?.[0];
    const sourceUrl = metaRecord?.source_url || "https://archive.org/details/bureau_of_indian_standards";

    const fullSha256 = crypto.createHash("sha256").update(content).digest("hex");
    const docId = `bis_doc_${fullSha256.slice(0, 12)}`;
    const jobId = `job_batch_${Date.now()}_${idx + 1}`;

    const existing = await getDocumentBySha256(fullSha256);
    if (existing) {
      console.log(`\n[Doc ${idx + 1}/${selectedFiles.length}] ${filename}`);
      console.log(`  [i] Already ingested as ${existing.id} (${existing.standard_number || "Statutory Doc"}). Skipping.`);
      summaryReport.push({
        file: filename,
        standard: existing.standard_number || "Existing",
        pages: existing.page_count,
        chunks: existing.page_count > 0 ? "~" : 0,
        status: "cached",
        errors: 0,
        timeSec: "0.0",
      });
      continue;
    }

    console.log("\n" + "-" .repeat(75));
    console.log(`[Doc ${idx + 1}/${selectedFiles.length}] ${filename}`);
    console.log(`  Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB | Document ID: ${docId}`);
    if (metaRecord?.title) console.log(`  Title: ${metaRecord.title}`);
    console.log("-" .repeat(75));

    const docStart = Date.now();

    try {
      const result = await runIngestionPipeline(
        {
          jobId,
          documentId: docId,
          filename,
          content,
          mimeType: "application/pdf",
          claimedStandardNumber: claimedStd,
          title: metaRecord?.title,
          knowledgeTier: "B",
          sourceUrl,
          uploadedBy: "pipeline_batch_runner",
          verificationStatus: "verified", // Auto-publish for immediate retrieval
        },
        (event) => {
          if (event.status === "done") {
            const extraInfo = [];
            if (event.counts?.totalPages) extraInfo.push(`${event.counts.totalPages} pages`);
            if (event.counts?.chunksCreated) extraInfo.push(`${event.counts.chunksCreated} chunks`);
            if (event.counts?.embeddingsGenerated) extraInfo.push(`${event.counts.embeddingsGenerated} embeddings`);
            if (event.counts?.chunksIndexed) extraInfo.push(`${event.counts.chunksIndexed} indexed`);
            const details = extraInfo.length > 0 ? ` (${extraInfo.join(", ")})` : "";
            console.log(`    ✓ Step [${event.step.padEnd(14)}] completed in ${event.durationMs || 0}ms${details}`);
          } else if (event.status === "failed") {
            console.error(`    ✗ Step [${event.step.padEnd(14)}] FAILED: ${event.error || "Unknown error"}`);
          }
        }
      );

      const docElapsed = ((Date.now() - docStart) / 1000).toFixed(1);
      console.log(`  => Status: ${result.status.toUpperCase()} | Standard: ${result.standardNumber || "Detected"} | Pages: ${result.pageCount} | Chunks: ${result.chunkCount} | Time: ${docElapsed}s`);

      summaryReport.push({
        file: filename,
        standard: result.standardNumber || "N/A",
        pages: result.pageCount,
        chunks: result.chunkCount,
        status: result.status,
        errors: result.errors.length,
        timeSec: docElapsed,
      });
    } catch (err: any) {
      console.error(`  => Failed to ingest ${filename}:`, err.message);
      summaryReport.push({
        file: filename,
        standard: "ERROR",
        pages: 0,
        chunks: 0,
        status: "failed",
        errors: 1,
        timeSec: ((Date.now() - docStart) / 1000).toFixed(1),
      });
    }
  }

  // Summary Table
  const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log("\n" + "=" .repeat(75));
  console.log("  Ingestion Batch Execution Summary");
  console.log("=" .repeat(75));
  console.log("  Filename                                   | Standard      | Pages | Chunks | Status    | Time");
  console.log("  " + "-" .repeat(71));

  for (const r of summaryReport) {
    const fn = (r.file.length > 40 ? r.file.slice(0, 37) + "..." : r.file).padEnd(42);
    const std = (r.standard || "N/A").padEnd(13);
    const pgs = String(r.pages).padStart(5);
    const chk = String(r.chunks).padStart(6);
    const st = r.status.padEnd(9);
    const tm = `${r.timeSec}s`.padStart(5);
    console.log(`  ${fn} | ${std} | ${pgs} | ${chk} | ${st} | ${tm}`);
  }

  const totalChunks = summaryReport.reduce((acc, r) => acc + r.chunks, 0);
  const totalPages = summaryReport.reduce((acc, r) => acc + r.pages, 0);

  console.log("  " + "-" .repeat(71));
  console.log(`  Total: ${summaryReport.length} document(s), ${totalPages} pages, ${totalChunks} chunks embedded & indexed in ${totalElapsed}s`);
  console.log("=" .repeat(75));
}

main().catch((err) => {
  console.error("Fatal ingestion error:", err);
  process.exit(1);
});
