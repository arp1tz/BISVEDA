import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { localGetDocumentVersions } from "@/lib/local-db";
import { getDocumentBuffer } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docVersionId: string }> }
) {
  const { docVersionId } = await params;
  const vId = parseInt(docVersionId, 10);

  // 1. Resolve Document Version
  const versions = await localGetDocumentVersions();
  const version = versions.find((v) => v.id === vId);

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
  let foundFilename = version?.document_id ? `${version.document_id}.pdf` : `version-${docVersionId}.pdf`;

  if (version?.storage_key) {
    try {
      resolvedBuffer = await getDocumentBuffer(version.storage_key);
    } catch {}
  }

  if (!resolvedBuffer) {
    // Check candidate disk folders
    for (const dir of candidateDirectories) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (!f.toLowerCase().endsWith(".pdf")) continue;
          if (version?.document_id && f.includes(version.document_id)) {
            resolvedBuffer = fs.readFileSync(path.join(dir, f));
            foundFilename = f;
            break;
          }
        }
        if (resolvedBuffer) break;
      } catch {}
    }
  }

  if (!resolvedBuffer) {
    return NextResponse.json(
      {
        held: false,
        message: "The official PDF document is not held in the local repository for this version.",
        version_id: vId,
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
