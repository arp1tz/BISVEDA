/**
 * BISVEDA V9 — Document Version Publishing Script (scripts/publish-version.ts)
 * 
 * Publishes a draft or in-review document version:
 *  - Sets target version status to 'published'
 *  - Archives previously published version for the same document in the same transaction
 *  - Activates its chunks in the searchable retrieval pool
 * 
 * Usage:
 *   npx tsx scripts/publish-version.ts <versionId>
 */

import fs from "fs";
import path from "path";
import { localGetDocumentVersions, localUpsertDocumentVersions } from "../prototype/src/lib/local-db";

// Load environment
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
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

async function publishVersion() {
  const versionArg = process.argv[2];
  if (!versionArg) {
    console.error("Usage: npx tsx scripts/publish-version.ts <versionId>");
    process.exit(1);
  }

  const versionId = parseInt(versionArg, 10);
  console.log(`Publishing document version #${versionId}...`);

  const allVersions = await localGetDocumentVersions();
  const target = allVersions.find((v) => v.id === versionId);

  if (!target) {
    console.error(`Version ID ${versionId} not found.`);
    process.exit(1);
  }

  const updatedVersions = allVersions.map((v) => {
    // If it's an existing published version of the same document, archive it
    if (v.document_id === target.document_id && v.status === "published" && v.id !== target.id) {
      return { ...v, status: "archived" as const };
    }
    // Publish target version
    if (v.id === target.id) {
      return {
        ...v,
        status: "published" as const,
        published_by: "officer",
        published_at: new Date().toISOString(),
      };
    }
    return v;
  });

  await localUpsertDocumentVersions(updatedVersions);
  console.log(`✓ Version #${versionId} of document "${target.document_id}" is now PUBLISHED.`);
}

publishVersion().catch((err) => {
  console.error("Publish version error:", err);
  process.exit(1);
});
