/**
 * /api/v8/documents/[id]
 * GET: Retrieve document details and chunks
 * DELETE: Permanently purge document, chunks, embeddings, and MinIO storage
 */
import { NextRequest, NextResponse } from "next/server";
import { getDocumentById, getDocumentChunks, purgeDocument } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const doc = await getDocumentById(id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const chunks = await getDocumentChunks(id);
    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        sha256: doc.sha256,
        standardNumber: (doc as any).standard_number || (doc as any).standardNumber || null,
        standard_number: (doc as any).standard_number || (doc as any).standardNumber || null,
        title: doc.title,
        pageCount: (doc as any).page_count ?? (doc as any).pageCount ?? 0,
        knowledgeTier: (doc as any).knowledge_tier || (doc as any).knowledgeTier || "B",
        verificationStatus: (doc as any).verification_status || (doc as any).verificationStatus || "unverified",
        status: doc.status || "published",
        uploadedBy: (doc as any).uploaded_by || (doc as any).uploadedBy,
        createdAt: (doc as any).created_at,
        metadata: doc.metadata,
      },
      chunkCount: chunks.length,
      chunks: chunks.map((c: any) => ({
        chunkId: c.chunk_id || c.chunkId,
        clauseNumber: c.clause_number || c.clauseNumber,
        clauseTitle: c.clause_title || c.clauseTitle,
        breadcrumb: c.breadcrumb,
        pageNumbers: c.page_numbers || c.pageNumbers || [],
        text: c.text,
        isActive: c.is_active ?? c.isActive ?? true,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const doc = await getDocumentById(id);
    const purgeTargetId = doc ? doc.id : id;
    const purgeRes = await purgeDocument(purgeTargetId);
    if (!purgeRes.success && !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Document ${id} (${doc?.filename || id}) and all derived knowledge permanently purged.`,
      purgedDocumentId: purgeTargetId,
      filename: doc?.filename || id,
      chunksRemoved: purgeRes.chunksRemoved,
      minioDeleted: purgeRes.minioDeleted,
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { updateDocument, updateDocumentChunks, deleteChunk } = await import("@/lib/db");
    const body = await request.json();

    // 1. Update Document Metadata if provided
    if (body.document) {
      await updateDocument(id, {
        standard_number: body.document.standard_number || body.document.standardNumber,
        root_standard: body.document.root_standard || body.document.rootStandard,
        edition_year: body.document.edition_year || body.document.editionYear,
        version: body.document.version,
        amendment: body.document.amendment,
        title: body.document.title,
        knowledge_tier: body.document.knowledge_tier || body.document.knowledgeTier,
        status: body.document.status,
      });
    }

    // 2. Delete chunk if requested
    if (body.deleteChunkId) {
      await deleteChunk(body.deleteChunkId);
    }

    // 3. Update or Add Chunks if provided
    if (Array.isArray(body.chunks)) {
      const formattedChunks = body.chunks.map((c: any) => ({
        chunk_id: c.chunkId || c.chunk_id,
        document_id: id,
        standard_number: c.standardNumber || c.standard_number,
        clause_number: c.clauseNumber || c.clause_number,
        clause_title: c.clauseTitle || c.clause_title,
        breadcrumb: c.breadcrumb || [],
        page_numbers: c.pageNumbers || c.page_numbers || [],
        text: c.text,
        token_count: c.tokenCount || Math.ceil((c.text || "").length / 4),
        sha256: c.sha256 || "",
        knowledge_tier: c.knowledgeTier || c.knowledge_tier || "B",
        verification_status: c.verificationStatus || "verified",
        is_active: c.isActive ?? c.is_active ?? true,
      }));
      await updateDocumentChunks(id, formattedChunks);
    }

    return NextResponse.json({
      success: true,
      message: `Document ${id} and chunks updated successfully.`,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

