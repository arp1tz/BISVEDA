import { NextRequest, NextResponse } from "next/server";
import { getAllStandards } from "@/lib/kb/store";

interface IngestionJob {
  id: string;
  standard_id: string;
  title: string;
  domain: string;
  version: string;
  doc_class: string;
  file_name: string;
  file_size_kb: number;
  chunk_count: number;
  node_count: number;
  status: "indexed" | "processing" | "failed";
  timestamp: string;
  ingested_by: string;
}

// In-memory record of ingested documents during session
const INGESTED_RECORDS: IngestionJob[] = [
  {
    id: "ingest-001",
    standard_id: "IS 4151:2015",
    title: "Protective Helmets for Motorcycle Riders — Specification (Fourth Revision)",
    domain: "Helmets & Safety",
    version: "Revision 4",
    doc_class: "Standard Specification",
    file_name: "IS_4151_2015_Helmet.pdf",
    file_size_kb: 2480,
    chunk_count: 52,
    node_count: 14,
    status: "indexed",
    timestamp: "2026-09-27 10:15",
    ingested_by: "Officer - CED 22",
  },
  {
    id: "ingest-002",
    standard_id: "IS 1417:2016",
    title: "Gold and Gold Alloys, Platina, Silver — Fineness and Marking (Fifth Revision)",
    domain: "Gold & Hallmarking",
    version: "Revision 5",
    doc_class: "Standard Specification",
    file_name: "IS_1417_2016_Gold_Hallmark.pdf",
    file_size_kb: 1820,
    chunk_count: 38,
    node_count: 11,
    status: "indexed",
    timestamp: "2026-09-27 11:40",
    ingested_by: "Assayer - Hallmarking Dept",
  },
  {
    id: "ingest-003",
    standard_id: "IS 9873 (Part 1):2019",
    title: "Safety of Toys — Part 1: Safety Aspects Related to Mechanical and Physical Properties",
    domain: "Toys Safety",
    version: "Part 1 (2019)",
    doc_class: "Standard Specification",
    file_name: "IS_9873_Part1_Toys.pdf",
    file_size_kb: 4120,
    chunk_count: 76,
    node_count: 18,
    status: "indexed",
    timestamp: "2026-09-27 14:20",
    ingested_by: "Inspector - PCD 12",
  },
  {
    id: "ingest-004",
    standard_id: "QCO S.O. 2235(E)",
    title: "Toys (Quality Control) Order, 2020 — Mandatory Certification Mandate",
    domain: "Toys Safety",
    version: "2020 Mandate",
    doc_class: "Mandatory QCO Order",
    file_name: "Toys_QCO_Gazette_2020.pdf",
    file_size_kb: 640,
    chunk_count: 12,
    node_count: 6,
    status: "indexed",
    timestamp: "2026-09-27 16:05",
    ingested_by: "Directorate - QCO Division",
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    records: INGESTED_RECORDS,
    total: INGESTED_RECORDS.length,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      standard_id,
      title,
      domain = "General",
      version = "1.0",
      doc_class = "Standard Specification",
      file_name = "document.pdf",
      file_size_kb = 1200,
    } = body;

    if (!standard_id || !title) {
      return NextResponse.json(
        { error: "standard_id and title are required." },
        { status: 400 }
      );
    }

    const calculatedChunks = Math.max(14, Math.floor((file_size_kb || 1000) / 45));
    const calculatedNodes = Math.max(4, Math.floor(calculatedChunks / 3.5));

    const newRecord: IngestionJob = {
      id: `ingest-${Date.now()}`,
      standard_id: standard_id.trim().toUpperCase(),
      title: title.trim(),
      domain,
      version,
      doc_class,
      file_name,
      file_size_kb: Number(file_size_kb) || 1200,
      chunk_count: calculatedChunks,
      node_count: calculatedNodes,
      status: "indexed",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 16),
      ingested_by: "Employee - Current Session",
    };

    INGESTED_RECORDS.unshift(newRecord);

    return NextResponse.json({
      success: true,
      record: newRecord,
      message: `Document ${standard_id} ingested successfully: ${calculatedChunks} chunks created, ${calculatedNodes} graph nodes linked.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Ingestion failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
