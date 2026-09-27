import { NextRequest, NextResponse } from "next/server";
import { localGetFacts, localCreateFact, localApproveFact } from "@/lib/local-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const predicate = searchParams.get("predicate") || undefined;
    const subject_id = searchParams.get("subject") || undefined;

    const facts = await localGetFacts({
      status,
      predicate,
      subject_id,
    });

    facts.sort((a, b) => b.id - a.id);
    return NextResponse.json({ facts, total: facts.length });
  } catch (err: any) {
    console.error("[Facts GET API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load facts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check for bulk approval action
    if (body?.action === "bulk_approve" && Array.isArray(body?.fact_ids)) {
      const actor = body?.actor || "officer";
      const approvedFacts = [];
      for (const fid of body.fact_ids.slice(0, 50)) {
        try {
          const approved = await localApproveFact(Number(fid), actor, "Bulk approved by officer");
          approvedFacts.push(approved);
        } catch {}
      }
      return NextResponse.json({ success: true, count: approvedFacts.length, facts: approvedFacts });
    }

    // Manual fact creation
    const { subject_id, predicate, object_id, value, source_url, source_chunk_id, note, actor } = body;
    if (!subject_id || !predicate || !source_url) {
      return NextResponse.json(
        { error: "Missing required fields: subject_id, predicate, source_url" },
        { status: 400 }
      );
    }

    const created = await localCreateFact(
      {
        subject_id,
        predicate,
        object_id: object_id || null,
        value: value || null,
        source_chunk_id: source_chunk_id ? Number(source_chunk_id) : null,
        source_url,
        status: "proposed",
        created_by: actor || "officer",
        note: note || "",
      },
      actor || "officer"
    );

    return NextResponse.json({ success: true, fact: created });
  } catch (err: any) {
    console.error("[Facts POST API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process fact" },
      { status: 500 }
    );
  }
}
