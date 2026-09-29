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
  year: number | null; // null: the uploaded PDF does not state it
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

// Edition and amendment registry, taken only from what the uploaded PDFs print (cover page and the
// amendment slips bound into them). Nothing here comes from outside those files; when a PDF does not state
// something (an edition year, an amendment's content) it says so instead of filling it in.
// Staff can add later revisions and amendments with the buttons on this tab.
const DEFAULT_VERSION_HISTORIES: Record<
  string,
  { revisions: VersionRevision[]; amendments: AmendmentRecord[] }
> = {
  "IS 4151": {
    revisions: [
      {
        id: "v-4151-1993",
        version: "Third Revision",
        year: 1993,
        status: "active",
        effective_date: "Published October 1993, reaffirmed 2008",
        gazette_notification: "Uploaded PDF: second reprint, January 2006, including Amendments No. 1 and 2",
        summary: "Edition held in the knowledge base and cited in answers: protective helmets for motorcycle riders.",
      },
    ],
    amendments: [
      {
        id: "amd-4151-1",
        amendment_number: 1,
        date: "September 1998",
        clause_affected: "Clauses 5.1, 6.3, 6.6",
        summary: "Helmet sizes matched to headform sizes 500 to 620 mm per IS 7692 : 1993; padding to cover the areas above plane AA; note added to 6.6.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 3",
      },
      {
        id: "amd-4151-2",
        amendment_number: 2,
        date: "January (year not legible in scan)",
        clause_affected: "Fig. 7 (page 14)",
        summary: "Figure 7 substituted.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 3",
      },
    ],
  },
  "IS 2925": {
    revisions: [
      {
        id: "v-2925-1984",
        version: "Second Revision",
        year: 1984,
        status: "active",
        effective_date: "1984 edition",
        summary: "Edition held in the knowledge base and cited in answers: industrial safety helmets.",
      },
    ],
    amendments: [],
  },
  "IS 1417": {
    revisions: [
      {
        id: "v-1417-1999",
        version: "Third Revision",
        year: 1999,
        status: "active",
        effective_date: "Published December 1999, reaffirmed",
        gazette_notification: "Uploaded PDF, with Amendments No. 1, 2 and 3 bound in",
        summary: "Edition held in the knowledge base and cited in answers: gold fineness grades and hallmark marking.",
      },
      {
        id: "v-8844",
        version: "IS 8844 (withdrawn)",
        year: null,
        status: "withdrawn",
        effective_date: "Superseded by IS 1417 : 1999",
        summary: "The IS 1417 : 1999 cover states it supersedes IS 8844, which stands withdrawn.",
      },
    ],
    amendments: [
      {
        id: "amd-1417-1",
        amendment_number: 1,
        date: "December 2004",
        clause_affected: "Clause 4.1 (notes)",
        summary: "Gold alloys for jewellery/artefacts and gold solders to be free from iridium and ruthenium.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 4",
      },
      {
        id: "amd-1417-2",
        amendment_number: 2,
        date: "December 2007",
        clause_affected: "Clauses 4.1, 5.2, 6.1, 6.2",
        summary: "Grade 708 (17 carat) added; hallmarked articles to carry BIS mark, purity grade/fineness, assay centre mark, year letter and jeweller's mark; clause 6.1.4 added; 6.2 substituted.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 6",
      },
      {
        id: "amd-1417-3",
        amendment_number: 3,
        date: "June 2010",
        clause_affected: "Clauses 6.1.4, 6.2(d)",
        summary: "Clause 6.1.4 and item 6.2(d) deleted.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 8",
      },
    ],
  },
  "IS 1418": {
    revisions: [
      {
        id: "v-1418-2009",
        version: "Current edition in knowledge base",
        year: 2009,
        status: "active",
        effective_date: "2009 edition",
        summary: "Edition held in the knowledge base and cited in answers: cupellation (fire assay) method for gold.",
      },
    ],
    amendments: [],
  },
  "IS 15820": {
    revisions: [
      {
        id: "v-15820-2009",
        version: "Current edition in knowledge base",
        year: 2009,
        status: "active",
        effective_date: "2009 edition",
        summary: "Edition held in the knowledge base and cited in answers: competence of assaying and hallmarking centres.",
      },
    ],
    amendments: [],
  },
  "IS 9873 (Part 3)": {
    revisions: [
      {
        id: "v-9873-3-1999",
        version: "First Revision",
        year: 1999,
        status: "active",
        effective_date: "1999 edition (adopted from ISO 8124-3 : 1997)",
        gazette_notification: "Uploaded PDF, with Amendments No. 1, 2 and 3 bound in",
        summary: "Edition held in the knowledge base and cited in answers: migration of certain elements (and phthalates, per Amendment No. 3).",
      },
    ],
    amendments: [
      {
        id: "amd-9873-3-1",
        amendment_number: 1,
        date: "August 2009",
        clause_affected: "See amendment slip",
        summary: "Later deleted by Amendment No. 2.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 13",
      },
      {
        id: "amd-9873-3-2",
        amendment_number: 2,
        date: "October 2010",
        clause_affected: "National Foreword; new National Annex A",
        summary: "Amendment No. 1 deleted; National Annex A added with BIS certification marking and the details to be marked on each toy and its packing.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 13",
      },
      {
        id: "amd-9873-3-3",
        amendment_number: 3,
        date: "July 2011",
        clause_affected: "Designation, title, National Foreword",
        summary: "Title changed to 'Migration of certain elements and phthalates'; designation simplified to IS 9873 (Part 3) : 1999.",
        gazette_ref: "Amendment slip in uploaded PDF, p. 4",
      },
    ],
  },
};

/** Any document without a registry entry: state only what the knowledge base knows. */
function editionUnknownHistory(stdId: string): { revisions: VersionRevision[]; amendments: AmendmentRecord[] } {
  return {
    revisions: [
      {
        id: `v-${stdId}`,
        version: "Edition as uploaded",
        year: null,
        status: "active",
        effective_date: "Year not stated in the uploaded PDF text",
        summary: `Edition of ${stdId} held in the knowledge base and cited in answers.`,
      },
    ],
    amendments: [],
  };
}

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
    return editionUnknownHistory(stdId);
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
                        Edition in the knowledge base
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Answers cite this edition
                    </span>
                  </div>

                  {selectedHistory.revisions[0] && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Revision Notation:</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {selectedHistory.revisions[0].version}
                          {selectedHistory.revisions[0].year ? ` (${selectedHistory.revisions[0].year})` : ""}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[11px]">Edition:</span>
                        <span className="font-medium text-slate-800">
                          {selectedHistory.revisions[0].effective_date}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[11px]">Source:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {selectedHistory.revisions[0].gazette_notification || "Uploaded PDF"}
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
                              {selectedDoc.standard_id}{rev.year ? ` : ${rev.year}` : ""}
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
                              {rev.effective_date}
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
                    <span>Amendments printed in the PDF ({selectedHistory.amendments.length})</span>
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Amendment #</th>
                          <th className="py-2.5 px-3 font-semibold">Clause Affected</th>
                          <th className="py-2.5 px-3 font-semibold">Summary of Change</th>
                          <th className="py-2.5 px-3 font-semibold">Where</th>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedHistory.amendments.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-3 px-3 text-slate-500">
                              No amendment slips are printed in the uploaded PDF. Use &quot;Add amendment&quot; to record one.
                            </td>
                          </tr>
                        )}
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
