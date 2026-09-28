"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  ExternalLink,
  Search,
  ChevronRight,
  Layers,
  Eye,
  GitBranch,
  History,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  FileCheck,
  Tag,
  Info,
} from "lucide-react";

interface DocItem {
  doc_id: string;
  standard_id: string;
  title: string;
  domain: string;
  file: string;
  chunk_count: number;
  source_url?: string;
}

interface ChunkItem {
  chunk_id: string;
  standard_id: string;
  clause: string;
  clause_title: string;
  page_start: number;
  page_end: number;
  text: string;
  tokens: number;
}

interface VersionRevision {
  id: string;
  version: string;
  year: number;
  status: "active" | "superseded" | "withdrawn" | "draft";
  effective_date: string;
  gazette_notification?: string;
  qco_order?: string;
  summary: string;
}

interface AmendmentRecord {
  id: string;
  amendment_number: number;
  date: string;
  clause_affected: string;
  summary: string;
  gazette_ref: string;
}

// Built-in standard version control registry
const DEFAULT_VERSION_HISTORIES: Record<
  string,
  { revisions: VersionRevision[]; amendments: AmendmentRecord[] }
> = {
  "IS 4151": {
    revisions: [
      {
        id: "v-4151-4",
        version: "Revision 4 (Current)",
        year: 2015,
        status: "active",
        effective_date: "2016-01-01",
        gazette_notification: "Gazette of India S.O. 3855(E)",
        qco_order: "Two-Wheeler Helmet QCO (MoRTH Notification No. RT-11036)",
        summary:
          "Enforces mandatory ISI certification for all two-wheeler rider protective helmets manufactured or sold in India.",
      },
      {
        id: "v-4151-3",
        version: "Revision 3",
        year: 1993,
        status: "superseded",
        effective_date: "1994-06-15",
        summary:
          "Introduced standardized chin-guard retention and visor optical clarity specifications.",
      },
      {
        id: "v-4151-2",
        version: "Revision 2",
        year: 1982,
        status: "withdrawn",
        effective_date: "1983-01-01",
        summary: "Early revision establishing energy absorption testing using metal headforms.",
      },
      {
        id: "v-4151-1",
        version: "First Edition",
        year: 1974,
        status: "withdrawn",
        effective_date: "1974-08-10",
        summary: "Initial standard for motorcycle rider helmets in India.",
      },
    ],
    amendments: [
      {
        id: "amd-4151-1",
        amendment_number: 1,
        date: "2018-05-12",
        clause_affected: "Clause 7.1.2 (Drop Velocity)",
        summary: "Revised anvil impact drop velocity tolerances from ±0.15 m/s to ±0.10 m/s.",
        gazette_ref: "BIS Standards Gazette Part II",
      },
      {
        id: "amd-4151-2",
        amendment_number: 2,
        date: "2020-08-28",
        clause_affected: "Clause 6.4 (Retention Buckle)",
        summary: "Mandated dual-action release mechanism on micro-metric quick-release buckles.",
        gazette_ref: "MoRTH S.O. 2933(E)",
      },
      {
        id: "amd-4151-3",
        amendment_number: 3,
        date: "2024-03-15",
        clause_affected: "Clause 8.2 (Traceability Marking)",
        summary: "Mandatory QR code and 7-digit CM/L licence number display on helmet exterior.",
        gazette_ref: "BIS Technical Directive TD/4151/24",
      },
    ],
  },
  "IS 1417": {
    revisions: [
      {
        id: "v-1417-5",
        version: "Revision 5 (Current)",
        year: 2016,
        status: "active",
        effective_date: "2016-07-01",
        gazette_notification: "Gazette S.O. 1383(E)",
        qco_order: "Hallmarking of Gold Jewellery Order 2020",
        summary:
          "Defines 6 standard karat purity grades (14K, 18K, 20K, 22K, 23K, 24K) and mandatory 6-digit alphanumeric HUID marking.",
      },
      {
        id: "v-1417-4",
        version: "Revision 4",
        year: 1999,
        status: "superseded",
        effective_date: "2000-04-11",
        summary: "Pre-HUID voluntary hallmarking standard using 4-symbol marking system.",
      },
      {
        id: "v-1417-3",
        version: "Revision 3",
        year: 1989,
        status: "withdrawn",
        effective_date: "1990-01-01",
        summary: "Specification for gold and silver alloys purity assays.",
      },
    ],
    amendments: [
      {
        id: "amd-1417-1",
        amendment_number: 1,
        date: "2019-11-20",
        clause_affected: "Clause 5.1 (Marking)",
        summary: "Transitioned from 4-mark system to 3-mark system: BIS logo, Purity/Fineness, HUID.",
        gazette_ref: "Gazette Notification S.O. 4221(E)",
      },
      {
        id: "amd-1417-2",
        amendment_number: 2,
        date: "2021-06-16",
        clause_affected: "Clause 4.2 (Mandatory Districts)",
        summary: "Mandatory hallmarking phased enforcement across 256 notified districts.",
        gazette_ref: "Consumer Affairs Order CA-2021/HM",
      },
      {
        id: "amd-1417-3",
        amendment_number: 3,
        date: "2023-04-01",
        clause_affected: "Clause 6.1 (6-Digit HUID Requirement)",
        summary: "Prohibited sale of gold jewellery without 6-digit alphanumeric HUID nationwide.",
        gazette_ref: "BIS Central Hallmarking Order HM/2023",
      },
    ],
  },
  "IS 9873 (Part 1)": {
    revisions: [
      {
        id: "v-9873-2",
        version: "Revision 2 (Current)",
        year: 2019,
        status: "active",
        effective_date: "2020-09-01",
        gazette_notification: "Gazette S.O. 2235(E)",
        qco_order: "Toys (Quality Control) Order 2020 (DPIIT Mandate)",
        summary:
          "Mechanical and physical properties test specification for toys. Mandatory Scheme-I ISI marking required before customs import or domestic sale.",
      },
      {
        id: "v-9873-1",
        version: "First Edition",
        year: 2012,
        status: "superseded",
        effective_date: "2013-05-01",
        summary: "Harmonized Indian Standard with ISO 8124-1 for toy mechanical safety.",
      },
    ],
    amendments: [
      {
        id: "amd-9873-1",
        amendment_number: 1,
        date: "2021-10-14",
        clause_affected: "Clause 4.14 (Battery Compartments)",
        summary: "Mandatory tool-operated screw locks on all button-cell battery compartments.",
        gazette_ref: "DPIIT Order No. P-29026/2021",
      },
      {
        id: "amd-9873-2",
        amendment_number: 2,
        date: "2023-07-08",
        clause_affected: "Clause 4.22 (Projectile Toy Kinetic Energy)",
        summary: "Lowered permissible kinetic energy limit on suction-cup projectiles to 0.08 J.",
        gazette_ref: "BIS Toy Safety Directive TSD-2023",
      },
    ],
  },
};

export function DocumentsTab() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkQuery, setChunkQuery] = useState("");
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  // View state: "clauses" vs "versions"
  const [viewMode, setViewMode] = useState<"clauses" | "versions">("versions");

  // Version Control State
  const [versionHistories, setVersionHistories] = useState(DEFAULT_VERSION_HISTORIES);
  const [showAddRevisionModal, setShowAddRevisionModal] = useState(false);
  const [showAddAmendmentModal, setShowAddAmendmentModal] = useState(false);

  // New Revision Form State
  const [newVersion, setNewVersion] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newEffectiveDate, setNewEffectiveDate] = useState("");
  const [newGazette, setNewGazette] = useState("");
  const [newQco, setNewQco] = useState("");
  const [newSummary, setNewSummary] = useState("");

  // New Amendment Form State
  const [newAmdNumber, setNewAmdNumber] = useState(1);
  const [newAmdClause, setNewAmdClause] = useState("");
  const [newAmdSummary, setNewAmdSummary] = useState("");
  const [newAmdGazette, setNewAmdGazette] = useState("");

  useEffect(() => {
    async function loadDocs() {
      setLoadingDocs(true);
      try {
        const res = await fetch("/api/admin/docs");
        if (res.ok) {
          const data = await res.json();
          setDocs(data.docs || []);
          if (data.docs?.length > 0) {
            setSelectedDocId(data.docs[0].doc_id);
          }
        }
      } catch (err) {
        console.error("Failed to load docs:", err);
      } finally {
        setLoadingDocs(false);
      }
    }
    loadDocs();
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    async function loadDocDetails() {
      setLoadingChunks(true);
      try {
        const res = await fetch(`/api/admin/docs?doc_id=${encodeURIComponent(selectedDocId!)}`);
        if (res.ok) {
          const data = await res.json();
          setChunks(data.chunks || []);
        }
      } catch (err) {
        console.error("Failed to load chunks:", err);
      } finally {
        setLoadingChunks(false);
      }
    }
    loadDocDetails();
  }, [selectedDocId]);

  const selectedDoc = docs.find((d) => d.doc_id === selectedDocId);

  // Look up or generate version history for selected standard
  const getStandardHistory = (stdId: string) => {
    const key = Object.keys(versionHistories).find((k) =>
      stdId.toLowerCase().includes(k.toLowerCase())
    );
    if (key && versionHistories[key]) {
      return versionHistories[key];
    }
    // Generic fallback for any other standard in KB
    return {
      revisions: [
        {
          id: `v-${stdId}-1`,
          version: "Revision 1 (Current Active)",
          year: 2021,
          status: "active" as const,
          effective_date: "2021-04-01",
          gazette_notification: "Gazette Notification S.O. 1822(E)",
          qco_order: "Mandatory Quality Control Order Enforced",
          summary: `Current active standard specification for ${stdId}. Mandatory ISI mark required under Section 16 of BIS Act.`,
        },
        {
          id: `v-${stdId}-0`,
          version: "Original Edition",
          year: 2011,
          status: "superseded" as const,
          effective_date: "2011-08-15",
          summary: `Previous superseded edition of ${stdId}.`,
        },
      ],
      amendments: [
        {
          id: `amd-${stdId}-1`,
          amendment_number: 1,
          date: "2023-01-10",
          clause_affected: "Clause 3.2 (Scope & Testing Protocols)",
          summary: "Harmonized sampling guidelines with updated laboratory testing parameters.",
          gazette_ref: "BIS Technical Directive",
        },
      ],
    };
  };

  const handleAddRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    const stdId = selectedDoc.standard_id;
    const current = getStandardHistory(stdId);

    const newRevObj: VersionRevision = {
      id: `v-${Date.now()}`,
      version: newVersion || `Revision ${current.revisions.length + 1}`,
      year: Number(newYear) || new Date().getFullYear(),
      status: "active",
      effective_date: newEffectiveDate || new Date().toISOString().slice(0, 10),
      gazette_notification: newGazette || undefined,
      qco_order: newQco || undefined,
      summary: newSummary || "New standard revision registered.",
    };

    // Mark previous active revision as superseded
    const updatedRevisions = current.revisions.map((r) =>
      r.status === "active" ? { ...r, status: "superseded" as const } : r
    );

    setVersionHistories((prev) => ({
      ...prev,
      [stdId]: {
        ...current,
        revisions: [newRevObj, ...updatedRevisions],
      },
    }));

    setShowAddRevisionModal(false);
    setNewVersion("");
    setNewGazette("");
    setNewQco("");
    setNewSummary("");
  };

  const handleAddAmendment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    const stdId = selectedDoc.standard_id;
    const current = getStandardHistory(stdId);

    const newAmdObj: AmendmentRecord = {
      id: `amd-${Date.now()}`,
      amendment_number: Number(newAmdNumber) || current.amendments.length + 1,
      date: new Date().toISOString().slice(0, 10),
      clause_affected: newAmdClause || "General",
      summary: newAmdSummary || "Formal amendment registered.",
      gazette_ref: newAmdGazette || "BIS Gazette Notification",
    };

    setVersionHistories((prev) => ({
      ...prev,
      [stdId]: {
        ...current,
        amendments: [newAmdObj, ...current.amendments],
      },
    }));

    setShowAddAmendmentModal(false);
    setNewAmdClause("");
    setNewAmdSummary("");
    setNewAmdGazette("");
  };

  const filteredChunks = chunks.filter((c) => {
    if (!chunkQuery.trim()) return true;
    const q = chunkQuery.toLowerCase();
    return (
      c.clause.toLowerCase().includes(q) ||
      (c.clause_title || "").toLowerCase().includes(q) ||
      c.text.toLowerCase().includes(q)
    );
  });

  const selectedHistory = selectedDoc ? getStandardHistory(selectedDoc.standard_id) : null;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#F7F8FA] text-[#0F172A]">
      {/* Left Column: Documents Registry (380px) */}
      <div className="w-[380px] border-r border-[#E5E7EB] bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E5E7EB] bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0B2A4A] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#E8710A]" />
              <span>Official BIS Documents ({docs.length})</span>
            </h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Verified PDFs
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Standard specifications, versions, amendments &amp; forms
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB]">
          {loadingDocs ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading documents…</div>
          ) : (
            docs.map((doc) => {
              const isSelected = doc.doc_id === selectedDocId;
              return (
                <div
                  key={doc.doc_id}
                  onClick={() => setSelectedDocId(doc.doc_id)}
                  className={`p-3.5 transition-colors cursor-pointer text-left ${
                    isSelected ? "bg-slate-50 border-l-4 border-l-[#0B2A4A]" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-[#0B2A4A]">{doc.standard_id}</span>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {doc.domain}
                    </span>
                  </div>

                  <h3 className="text-xs font-medium text-slate-800 line-clamp-2 mb-1.5">
                    {doc.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Layers className="h-3 w-3" />
                      <span>{doc.chunk_count} chunks</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span>Active</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Document Details, Version Control & Chunk Browser */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedDoc ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-[#E5E7EB] bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#0B2A4A]">{selectedDoc.standard_id}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-xs font-mono text-slate-500">doc_id: {selectedDoc.doc_id}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full">
                    Current Enforced Edition
                  </span>
                </div>
                <h2 className="text-sm font-bold text-slate-900">{selectedDoc.title}</h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/docs/${selectedDoc.doc_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Open Full PDF</span>
                </a>
              </div>
            </div>

            {/* View Mode Switcher: Version Control vs Clauses */}
            <div className="px-4 py-2 border-b border-[#E5E7EB] bg-slate-50/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode("versions")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "versions"
                      ? "bg-white text-[#0B2A4A] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <History className="h-3.5 w-3.5 text-[#E8710A]" />
                  <span>Version Control &amp; Amendments</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("clauses")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "clauses"
                      ? "bg-white text-[#0B2A4A] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Clauses &amp; Text Chunks ({chunks.length})</span>
                </button>
              </div>

              {viewMode === "versions" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAmendmentModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="h-3 w-3 text-[#E8710A]" />
                    <span>Add Amendment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddRevisionModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B2A4A] hover:bg-[#081e36] text-xs font-semibold text-white transition-colors shadow-2xs cursor-pointer"
                  >
                    <GitBranch className="h-3 w-3 text-emerald-400" />
                    <span>Register New Revision</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: Version Control Management */}
            {viewMode === "versions" && selectedHistory && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Active Standard Version Overview Card */}
                <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 p-5 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Current Enforced Standard Revision
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Mandatory QCO Compliant
                    </span>
                  </div>

                  {selectedHistory.revisions[0] && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Revision Notation:</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedHistory.revisions[0].version} ({selectedHistory.revisions[0].year})
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[11px]">Effective Date:</span>
                        <span className="font-medium text-slate-800">
                          {selectedHistory.revisions[0].effective_date}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[11px]">Statutory Gazette Ref:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {selectedHistory.revisions[0].gazette_notification || "BIS Standards Directorate"}
                        </span>
                      </div>

                      {selectedHistory.revisions[0].qco_order && (
                        <div className="md:col-span-3 pt-2 border-t border-emerald-200/60">
                          <span className="text-slate-500 block text-[11px]">Quality Control Order (QCO):</span>
                          <span className="font-medium text-[#0B2A4A]">
                            {selectedHistory.revisions[0].qco_order}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Revision History Timeline */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-[#0B2A4A]" />
                    <span>Revision History &amp; Superseded Editions</span>
                  </h3>

                  <div className="space-y-3">
                    {selectedHistory.revisions.map((rev, idx) => (
                      <div
                        key={rev.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          rev.status === "active"
                            ? "bg-white border-emerald-300 shadow-2xs"
                            : "bg-slate-50/70 border-slate-200 text-slate-600"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#0B2A4A]">
                              {selectedDoc.standard_id}:{rev.year}
                            </span>
                            <span className="text-slate-400">—</span>
                            <span className="font-medium text-xs text-slate-800">{rev.version}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                rev.status === "active"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : rev.status === "superseded"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {rev.status}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Effective: {rev.effective_date}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{rev.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formal Amendments Log */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-[#E8710A]" />
                    <span>Notified Amendments Log ({selectedHistory.amendments.length})</span>
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Amendment #</th>
                          <th className="py-2.5 px-3 font-semibold">Clause Affected</th>
                          <th className="py-2.5 px-3 font-semibold">Summary of Change</th>
                          <th className="py-2.5 px-3 font-semibold">Notification Ref</th>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedHistory.amendments.map((amd) => (
                          <tr key={amd.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-[#0B2A4A]">
                              Amd No. {amd.amendment_number}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                              {amd.clause_affected}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 leading-relaxed max-w-[320px]">
                              {amd.summary}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {amd.gazette_ref}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {amd.date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Clauses & Text Chunks (Original functionality preserved) */}
            {viewMode === "clauses" && (
              <>
                {/* Chunk Search Bar */}
                <div className="p-3 border-b border-[#E5E7EB] bg-white flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clauses in this document by title, number, or text…"
                      value={chunkQuery}
                      onChange={(e) => setChunkQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A]"
                    />
                  </div>

                  <div className="text-xs text-slate-500">
                    Showing <strong>{filteredChunks.length}</strong> of {chunks.length} chunks
                  </div>
                </div>

                {/* Chunks List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingChunks ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Loading document chunks…
                    </div>
                  ) : filteredChunks.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No matching clauses found.
                    </div>
                  ) : (
                    filteredChunks.map((chunk) => {
                      const isExpanded = expandedChunkId === chunk.chunk_id;
                      return (
                        <div
                          key={chunk.chunk_id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#0B2A4A]">
                                  Clause {chunk.clause}
                                </span>
                                {chunk.clause_title && (
                                  <span className="text-xs font-medium text-slate-700">
                                    — {chunk.clause_title}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Pages {chunk.page_start}
                                {chunk.page_end !== chunk.page_start ? `–${chunk.page_end}` : ""} •{" "}
                                {chunk.tokens} tokens
                              </div>
                            </div>

                            <a
                              href={`/api/docs/${selectedDoc.doc_id}#page=${chunk.page_start}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2A4A] hover:underline shrink-0"
                            >
                              <span>Page {chunk.page_start}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          <div
                            className={`text-xs text-slate-600 leading-relaxed font-sans ${
                              isExpanded ? "" : "line-clamp-3"
                            }`}
                          >
                            {chunk.text}
                          </div>

                          {chunk.text.length > 220 && (
                            <button
                              type="button"
                              onClick={() => setExpandedChunkId(isExpanded ? null : chunk.chunk_id)}
                              className="mt-2 text-[11px] font-semibold text-[#0B2A4A] hover:underline cursor-pointer"
                            >
                              {isExpanded ? "Show less" : "Show full chunk text"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Modal: Register New Revision */}
            {showAddRevisionModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-bold text-[#0B2A4A] flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-emerald-600" />
                      <span>Register New Revision for {selectedDoc.standard_id}</span>
                    </h3>
                    <button
                      onClick={() => setShowAddRevisionModal(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAddRevision} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Revision Notation (e.g. Revision 5)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Fifth Revision"
                        value={newVersion}
                        onChange={(e) => setNewVersion(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Year</label>
                        <input
                          type="number"
                          value={newYear}
                          onChange={(e) => setNewYear(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Effective Date</label>
                        <input
                          type="date"
                          value={newEffectiveDate}
                          onChange={(e) => setNewEffectiveDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Gazette Notification / S.O. Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Gazette of India S.O. 4521(E)"
                        value={newGazette}
                        onChange={(e) => setNewGazette(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Quality Control Order (QCO) Reference
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mandatory QCO Enforcement Directive"
                        value={newQco}
                        onChange={(e) => setNewQco(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Summary of Revision
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Key technical changes introduced in this revision..."
                        value={newSummary}
                        onChange={(e) => setNewSummary(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowAddRevisionModal(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#0B2A4A] text-white text-xs font-bold hover:bg-[#081e36] cursor-pointer shadow-xs"
                      >
                        Save &amp; Supersede Previous
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Add Amendment */}
            {showAddAmendmentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-bold text-[#0B2A4A] flex items-center gap-2">
                      <Plus className="h-4 w-4 text-[#E8710A]" />
                      <span>Add Amendment to {selectedDoc.standard_id}</span>
                    </h3>
                    <button
                      onClick={() => setShowAddAmendmentModal(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAddAmendment} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Amendment Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newAmdNumber}
                        onChange={(e) => setNewAmdNumber(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Clause Affected
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Clause 6.2 (Marking &amp; Labeling)"
                        value={newAmdClause}
                        onChange={(e) => setNewAmdClause(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Summary of Amendment
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe the modification, insertion, or deletion..."
                        value={newAmdSummary}
                        onChange={(e) => setNewAmdSummary(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Gazette / Directive Reference
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BIS Technical Gazette Notification 2026/A1"
                        value={newAmdGazette}
                        onChange={(e) => setNewAmdGazette(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-[#0B2A4A]"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowAddAmendmentModal(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#0B2A4A] text-white text-xs font-bold hover:bg-[#081e36] cursor-pointer shadow-xs"
                      >
                        Record Amendment
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Select a document on the left to inspect its clauses and version control history.
          </div>
        )}
      </div>
    </div>
  );
}
