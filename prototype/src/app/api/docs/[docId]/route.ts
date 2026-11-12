/**
 * BISVEDA — Source PDF server (P6.3)
 *
 * Serves the real employee-uploaded PDF a citation's `url` points to
 * (`/api/docs/{doc_id}#page=N`, built in pipeline/package.ts). Whitelisted:
 * only a doc_id present in the build-time registry (data/kb/docs.json, a
 * serialization of scripts/kb/sources.ts's closed SOURCES list) can ever be
 * served — an unknown id is a clean 404, never a guessed path.
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDocById, loadStore } from "@/lib/kb/store";

const DOCS_DIR = "example docs uploaded by employees";

function resolveDocsDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", DOCS_DIR), // dev server cwd = prototype/
    path.resolve(process.cwd(), DOCS_DIR), // cwd = repo root
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  await loadStore();
  const doc = getDocById(docId);
  if (!doc) {
    return NextResponse.json({ error: `Unknown document id "${docId}".` }, { status: 404 });
  }

  const docsDir = resolveDocsDir();
  if (!docsDir) {
    return NextResponse.json({ error: `Source document folder "${DOCS_DIR}" not found on this server.` }, { status: 500 });
  }

  const filePath = path.join(docsDir, doc.file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `Registered file "${doc.file}" for ${docId} is missing on disk.` }, { status: 404 });
  }

  const bytes = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.file}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
