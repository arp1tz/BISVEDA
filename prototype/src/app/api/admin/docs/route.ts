import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, getAllChunks } from "@/lib/kb/store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("doc_id");

    const allDocs = getAllDocs();
    const allChunks = getAllChunks();

    // Map chunk counts per doc
    const chunkCounts = new Map<string, number>();
    for (const c of allChunks) {
      chunkCounts.set(c.doc_id, (chunkCounts.get(c.doc_id) || 0) + 1);
    }

    if (docId) {
      const doc = allDocs.find((d) => d.doc_id === docId);
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      const docChunks = allChunks
        .filter((c) => c.doc_id === docId)
        .map((c) => ({
          chunk_id: c.chunk_id,
          standard_id: c.standard_id,
          clause: c.clause,
          clause_title: c.clause_title,
          page_start: c.page_start,
          page_end: c.page_end,
          text: c.text,
          tokens: c.tokens,
        }));

      return NextResponse.json({
        doc: {
          ...doc,
          chunk_count: chunkCounts.get(docId) || 0,
        },
        chunks: docChunks,
      });
    }

    const docsWithCounts = allDocs.map((d) => ({
      ...d,
      chunk_count: chunkCounts.get(d.doc_id) || 0,
    }));

    return NextResponse.json({
      docs: docsWithCounts,
      total_docs: docsWithCounts.length,
      total_chunks: allChunks.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
