/**
 * POST /api/v8/documents/[id]/revoke
 * Revokes / unpublishes a document.
 * Sets document status = 'revoked' and deactivates all its chunks so they
 * immediately drop out of all active retrieval queries.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDocumentById, revokeDocument } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const doc = await getDocumentById(id);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const ok = await revokeDocument(id);
    if (!ok) {
      return NextResponse.json({ error: "Failed to revoke document" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Document ${id} (${doc.filename}) has been revoked and removed from active search.`,
      documentId: id,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
