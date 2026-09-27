/**
 * GET /api/v8/documents
 * List all documents in the knowledge fabric.
 */
import { NextResponse } from "next/server";
import { getAllDocuments, parseStandardVersion } from "@/lib/db";

export async function GET() {
  try {
    const docs = await getAllDocuments();
    return NextResponse.json({
      total: docs.length,
      documents: docs.map((d: any) => {
        const parsed = parseStandardVersion(d.standard_number);
        return {
          id: d.id,
          filename: d.filename,
          standardNumber: d.standard_number,
          rootStandard: d.root_standard || parsed.rootStandard,
          editionYear: d.edition_year || parsed.editionYear,
          version: d.version || "1.0",
          amendment: d.amendment || null,
          title: d.title,
          pageCount: d.page_count,
          chunkCount: d.chunk_count || 0,
          knowledgeTier: d.knowledge_tier,
          verificationStatus: d.verification_status,
          status: d.status || "published",
          uploadedBy: d.uploaded_by,
          createdAt: d.created_at,
          publishedAt: d.published_at,
          sha256: d.sha256,
        };
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
