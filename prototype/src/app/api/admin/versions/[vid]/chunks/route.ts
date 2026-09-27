import { NextRequest, NextResponse } from "next/server";
import { localGetDocumentVersions, localGetDocumentChunks } from "@/lib/local-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vid: string }> }
) {
  try {
    const { vid } = await params;
    const versionId = parseInt(vid, 10);
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();
    const pageNum = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 50;

    const versions = await localGetDocumentVersions();
    const targetVersion = versions.find((v) => v.id === versionId);
    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const allDocChunks = await localGetDocumentChunks(targetVersion.document_id);
    let versionChunks = allDocChunks.filter(
      (c) => c.doc_version_id === versionId || (!c.doc_version_id && targetVersion.status === "published")
    );

    if (query) {
      versionChunks = versionChunks.filter(
        (c) =>
          (c.clause_number && c.clause_number.toLowerCase().includes(query)) ||
          (c.clause_title && c.clause_title.toLowerCase().includes(query)) ||
          c.text.toLowerCase().includes(query)
      );
    }

    const total = versionChunks.length;
    const startIndex = (pageNum - 1) * pageSize;
    const paginated = versionChunks.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      version: targetVersion,
      chunks: paginated.map((c) => ({
        chunk_id: c.chunk_id,
        clause_id: c.clause_number || c.clause_id || "Gen",
        clause_title: c.clause_title || "",
        page: c.page_numbers?.[0] || c.page || 1,
        breadcrumb: c.breadcrumb || [],
        token_count: c.token_count || 0,
        has_embedding: Boolean(c.embedding && c.embedding.length > 0),
        text_preview: c.text ? c.text.slice(0, 160) : "",
        full_text: c.text || "",
      })),
      page: pageNum,
      pageSize,
      total,
    });
  } catch (err: any) {
    console.error("[Version Chunks API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load chunks" },
      { status: 500 }
    );
  }
}
