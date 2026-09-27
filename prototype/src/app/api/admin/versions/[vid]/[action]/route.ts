import { NextRequest, NextResponse } from "next/server";
import {
  localSubmitVersionForReview,
  localPublishVersion,
  localArchiveVersion,
  localRollbackVersion,
} from "@/lib/local-db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vid: string; action: string }> }
) {
  try {
    const { vid, action } = await params;
    const versionId = parseInt(vid, 10);
    if (isNaN(versionId)) {
      return NextResponse.json({ error: "Invalid version ID" }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const note = body?.note || "";
    const actor = body?.actor || "officer";

    let result;
    switch (action.toLowerCase()) {
      case "submit":
        result = await localSubmitVersionForReview(versionId, note, actor);
        break;
      case "publish":
        result = await localPublishVersion(versionId, note, actor);
        break;
      case "archive":
        result = await localArchiveVersion(versionId, note, actor);
        break;
      case "rollback":
        result = await localRollbackVersion(versionId, note, actor);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Allowed: submit, publish, archive, rollback.` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action, version: result });
  } catch (err: any) {
    console.error("[Version Action API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute version lifecycle action" },
      { status: 500 }
    );
  }
}
