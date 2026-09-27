import { NextRequest, NextResponse } from "next/server";
import kbData from "../../../../../data/knowledge_base.json";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const standard = (searchParams.get("standard") || "").trim().toUpperCase();
  const section = (searchParams.get("section") || "").trim().toLowerCase();

  const chunks = (kbData as any).chunks || [];

  let filtered = chunks;

  if (standard) {
    filtered = filtered.filter((c: any) =>
      c.standard_number.toUpperCase().includes(standard)
    );
  }

  if (section) {
    filtered = filtered.filter((c: any) =>
      c.section.toLowerCase().includes(section)
    );
  }

  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    filtered = filtered.filter((c: any) => {
      const full = `${c.section} ${c.text} ${c.doc_title}`.toLowerCase();
      return terms.some((t: string) => full.includes(t));
    });
  }

  return NextResponse.json({
    total_found: filtered.length,
    query: q,
    standard,
    section,
    source_documents: (kbData as any).source_documents,
    chunks: filtered,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const q = (body.query || "").trim().toLowerCase();
    const standard = (body.standard || "").trim().toUpperCase();

    const chunks = (kbData as any).chunks || [];
    let matches = chunks;

    if (standard) {
      matches = matches.filter((c: any) =>
        c.standard_number.toUpperCase().includes(standard)
      );
    }

    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      matches = matches.map((c: any) => {
        const full = `${c.section} ${c.text}`.toLowerCase();
        let score = 0;
        terms.forEach((t: string) => {
          if (full.includes(t)) score += 1;
        });
        return { ...c, score };
      }).filter((c: any) => c.score > 0)
        .sort((a: any, b: any) => b.score - a.score);
    }

    return NextResponse.json({
      success: true,
      count: matches.length,
      chunks: matches.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to query knowledge base" }, { status: 500 });
  }
}
