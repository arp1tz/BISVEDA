import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDocumentById, getAllDocuments } from "@/lib/db";
import { getDocumentBuffer } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id).trim();

  // 1. Try resolving document record from database
  let doc = await getDocumentById(decodedId);

  // If not found by direct ID, search across all documents by standard_number or filename
  if (!doc) {
    const allDocs = await getAllDocuments();
    const cleanQuery = decodedId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    doc = allDocs.find((d: any) => {
      const cleanStd = (d.standard_number || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const cleanFile = (d.filename || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const cleanDocId = (d.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      return (
        cleanStd.includes(cleanQuery) ||
        cleanQuery.includes(cleanStd) ||
        cleanFile.includes(cleanQuery) ||
        cleanDocId === cleanQuery
      );
    }) || null;
  }

  const targetFilename = doc?.filename || decodedId;

  // 2. Candidate directory paths on disk
  const candidateDirectories = [
    path.resolve(process.cwd(), "example docs uploaded by employees"),
    path.resolve(process.cwd(), "../example docs uploaded by employees"),
    path.resolve(process.cwd(), "storage/documents"),
    path.resolve(process.cwd(), "../storage/documents"),
    path.resolve(process.cwd(), "prototype/bis pdfs"),
    path.resolve(process.cwd(), "bis pdfs"),
    path.resolve(process.cwd(), "data/storage"),
    path.resolve(process.cwd(), "../data/storage"),
  ];

  let resolvedBuffer: Buffer | null = null;
  let foundFilename = targetFilename;

  // Search candidate directories for exact or partial filename match
  for (const dir of candidateDirectories) {
    if (!fs.existsSync(dir)) continue;

    // Check exact target filename
    const exactPath = path.join(dir, targetFilename);
    if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
      resolvedBuffer = fs.readFileSync(exactPath);
      foundFilename = path.basename(exactPath);
      break;
    }

    // Check prefixed filename (e.g. doc-xxx_filename.pdf)
    try {
      const dirFiles = fs.readdirSync(dir);
      const cleanTarget = targetFilename.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

      for (const f of dirFiles) {
        if (!f.toLowerCase().endsWith(".pdf")) continue;
        const cleanF = f.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

        // Check if standard number (e.g. IS 9873, IS 4151, IS 1417) matches
        const stdMatch = (doc?.standard_number || decodedId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (
          cleanF === cleanTarget ||
          cleanF.includes(cleanTarget) ||
          (stdMatch.length >= 4 && cleanF.includes(stdMatch))
        ) {
          const matchPath = path.join(dir, f);
          resolvedBuffer = fs.readFileSync(matchPath);
          foundFilename = f;
          break;
        }
      }
      if (resolvedBuffer) break;
    } catch {
      // Continue to next dir
    }
  }

  // 3. Fallback: MinIO / Object Storage
  if (!resolvedBuffer && doc?.minio_path) {
    try {
      resolvedBuffer = await getDocumentBuffer(doc.minio_path);
    } catch {}
  }

  // 4. Truth Boundary Enforcement: If document is not held, return 404
  // Never synthesize simulated statutory documents or fake BIS PDFs (§11.4)
  if (!resolvedBuffer) {
    return NextResponse.json(
      {
        error: "Document not held in local repository",
        message: `The physical official PDF document for '${decodedId}' is not held in the local repository. BISVEDA enforces strict truth boundaries and will not synthesize simulated statutory documents.`,
        document_id: decodedId,
        held: false,
      },
      { status: 404 }
    );
  }

  return new Response(new Uint8Array(resolvedBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${foundFilename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

