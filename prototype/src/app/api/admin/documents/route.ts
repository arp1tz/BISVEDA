import { NextRequest, NextResponse } from "next/server";
import {
  localGetAllDocuments,
  localGetDocumentVersions,
  localGetDocumentChunks,
} from "@/lib/local-db";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    const [docs, versions] = await Promise.all([
      localGetAllDocuments(),
      localGetDocumentVersions(),
    ]);

    const result = await Promise.all(
      docs.map(async (d) => {
        const docVersions = versions.filter((v) => v.document_id === d.id);
        docVersions.sort((a, b) => b.version_no - a.version_no);
        const latestVersion = docVersions[0];
        const publishedVersion = docVersions.find((v) => v.status === "published");
        const chunks = await localGetDocumentChunks(d.id);

        return {
          id: d.id,
          standard_number: d.standard_number,
          title: d.title,
          filename: d.filename,
          knowledge_tier: d.knowledge_tier,
          verification_status: d.verification_status,
          page_count: d.page_count,
          chunk_count: chunks.length,
          versions_count: docVersions.length,
          latest_version_no: latestVersion?.version_no || 1,
          latest_status: latestVersion?.status || (publishedVersion ? "published" : "draft"),
          published_version_no: publishedVersion?.version_no || null,
        };
      })
    );

    let filtered = result;
    if (statusFilter) {
      filtered = filtered.filter((d) => d.latest_status === statusFilter);
    }
    if (query) {
      filtered = filtered.filter(
        (d) =>
          d.id.toLowerCase().includes(query) ||
          (d.standard_number && d.standard_number.toLowerCase().includes(query)) ||
          (d.title && d.title.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({ documents: filtered, total: filtered.length });
  } catch (err: any) {
    console.error("[Admin Documents GET Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load documents" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const standardNumber = (formData.get("standardNumber") as string) || "";
    const title = (formData.get("title") as string) || "";
    const uploadedBy = (formData.get("uploadedBy") as string) || "officer";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cleanStd = standardNumber.replace(/\s+/g, "").toUpperCase();
    const docId = cleanStd ? `bis_doc_${cleanStd.toLowerCase()}` : `bis_doc_${Date.now()}`;
    const jobId = `job_${Date.now()}`;

    const res = await runIngestionPipeline({
      jobId,
      documentId: docId,
      filename: file.name,
      content: buffer,
      mimeType: file.type || "application/pdf",
      claimedStandardNumber: standardNumber,
      title: title || file.name,
      uploadedBy,
    });

    return NextResponse.json({
      success: true,
      jobId: res.jobId,
      documentId: res.documentId,
      status: res.status,
      chunkCount: res.chunkCount,
      pageCount: res.pageCount,
      events: res.events,
    });
  } catch (err: any) {
    console.error("[Admin Documents POST Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload and ingest document" },
      { status: 500 }
    );
  }
}
