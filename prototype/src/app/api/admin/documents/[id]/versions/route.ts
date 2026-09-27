import { NextRequest, NextResponse } from "next/server";
import { localGetDocumentVersions } from "@/lib/local-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allVersions = await localGetDocumentVersions(id);
    allVersions.sort((a, b) => b.version_no - a.version_no);

    return NextResponse.json({ versions: allVersions });
  } catch (err: any) {
    console.error("[Document Versions API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load document versions" },
      { status: 500 }
    );
  }
}
