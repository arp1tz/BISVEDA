import { NextRequest, NextResponse } from "next/server";
import { localApproveFact, localRejectFact, localEditFact } from "@/lib/local-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const factId = parseInt(id, 10);
    if (isNaN(factId)) {
      return NextResponse.json({ error: "Invalid fact ID" }, { status: 400 });
    }

    const body = await req.json();
    const action = (body?.action || "").toLowerCase();
    const actor = body?.actor || "officer";
    const note = body?.note || "";

    let result;
    if (action === "approve") {
      result = await localApproveFact(factId, actor, note);
    } else if (action === "reject") {
      const reason = body?.reason || note || "Rejected by officer";
      result = await localRejectFact(factId, reason, actor);
    } else if (action === "edit") {
      const updates = body?.updates || {};
      result = await localEditFact(factId, updates, actor, note);
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Allowed: approve, reject, edit.` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, action, fact: result });
  } catch (err: any) {
    console.error("[Fact Action API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update fact" },
      { status: 500 }
    );
  }
}
