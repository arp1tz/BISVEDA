"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Layers,
  FileText,
  CheckCircle2,
  History,
  Upload,
  Search,
  PanelRightClose,
  PanelRightOpen,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Plus,
  X,
  FileUp,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { AdminPasswordModal } from "@/components/admin/AdminPasswordModal";
import { GraphTab } from "@/components/admin/GraphTab";
import { DocumentTab } from "@/components/admin/DocumentTab";
import { FactsTab } from "@/components/admin/FactsTab";
import { HistoryTab } from "@/components/admin/HistoryTab";
import { NodeInspector } from "@/components/admin/NodeInspector";
import type { GraphApiNode, GraphApiLink, GraphApiResponse } from "@/lib/knowledge/types";

interface DocumentListItem {
  id: string;
  standard_number: string | null;
  title: string | null;
  filename: string;
  knowledge_tier: string;
  verification_status: string;
  chunk_count: number;
  versions_count: number;
  latest_version_no: number;
  latest_status: "published" | "draft" | "in_review" | "archived";
  published_version_no: number | null;
}

export default function AdminKnowledgePage() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Layout & Tabs
  const [activeTab, setActiveTab] = useState<"graph" | "document" | "facts" | "history">("graph");
  const [showInspector, setShowInspector] = useState<boolean>(true);

  // Documents
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Facts count
  const [pendingFactsCount, setPendingFactsCount] = useState<number>(0);

  // Graph state & selection
  const [selectedNode, setSelectedNode] = useState<GraphApiNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [allGraphLinks, setAllGraphLinks] = useState<GraphApiLink[]>([]);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStandardNo, setUploadStandardNo] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");

  // Check authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem("bisveda_staff_auth") === "true";
    setIsAuthenticated(isAuth);
    setAuthChecked(true);
  }, []);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/admin/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        // Auto-select first doc if none selected
        if (!selectedDocId && data.documents?.length > 0) {
          setSelectedDocId(data.documents[0].id);
        }
      }
    } catch (err) {
      console.error("[Documents Fetch Error]:", err);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedDocId]);

  // Fetch pending facts count
  const fetchPendingFacts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/facts?status=proposed");
      if (res.ok) {
        const data = await res.json();
        setPendingFactsCount(data.total || 0);
      }
    } catch (err) {
      console.error("[Facts Count Fetch Error]:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
      fetchPendingFacts();
    }
  }, [isAuthenticated, fetchDocuments, fetchPendingFacts]);

  const handleLogout = () => {
    sessionStorage.removeItem("bisveda_staff_auth");
    setIsAuthenticated(false);
  };

  const handleSelectNode = (node: GraphApiNode) => {
    setSelectedNode(node);
    if (!showInspector) setShowInspector(true);
    if (node.type === "Document") {
      setSelectedDocId(node.id);
    }
  };

  const handleSelectNodeById = (nodeId: string) => {
    setSelectedNode({
      id: nodeId,
      label: nodeId,
      type: "Standard",
    });
    setFocusedNodeId(nodeId);
    if (!showInspector) setShowInspector(true);
  };

  const handleOpenDocumentFromInspector = (docId: string) => {
    setSelectedDocId(docId);
    setActiveTab("document");
  };

  // Upload handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a PDF file");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("standardNumber", uploadStandardNo);
      formData.append("title", uploadTitle);
      formData.append("uploadedBy", "officer");

      const res = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUploadSuccessMsg(`Document staged in draft with ${data.chunkCount} chunks.`);
        await fetchDocuments();
        await fetchPendingFacts();
        if (data.documentId) {
          setSelectedDocId(data.documentId);
          setActiveTab("document");
        }
        setTimeout(() => {
          setIsUploadOpen(false);
          setUploadFile(null);
          setUploadStandardNo("");
          setUploadTitle("");
          setUploadSuccessMsg("");
        }, 1200);
      } else {
        setUploadError(data.error || "Failed to upload document");
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (!docSearchQuery) return true;
    const q = docSearchQuery.toLowerCase();
    return (
      doc.id.toLowerCase().includes(q) ||
      (doc.standard_number && doc.standard_number.toLowerCase().includes(q)) ||
      (doc.title && doc.title.toLowerCase().includes(q))
    );
  });

  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-xs text-slate-500 font-mono">
        Authenticating session...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      {/* Password Gate Modal */}
      <AdminPasswordModal
        isOpen={!isAuthenticated}
        onSuccess={() => setIsAuthenticated(true)}
      />

      {/* Top Navigation */}
      <header className="h-14 bg-[#0B2A4A] text-white flex items-center justify-between px-4 shrink-0 border-b border-[#081e36] select-none shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            title="Exit to public site"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-white">BISVEDA</span>
            <span className="text-xs text-slate-300 font-medium">Knowledge Console</span>
          </div>
        </div>

        {/* Global Search / Node Focus */}
        <div className="flex-1 max-w-md mx-6 hidden md:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents or standards..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-md pl-8 pr-3 py-1 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#E8710A] focus:ring-1 focus:ring-[#E8710A]"
            />
          </div>
        </div>

        {/* Right Nav: Profile & Inspector Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#E8710A]" />
            <span className="font-medium">Staff (admin)</span>
          </div>

          <button
            onClick={() => setShowInspector(!showInspector)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={showInspector ? "Collapse Inspector" : "Expand Inspector"}
          >
            {showInspector ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-red-950/60 text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (260px): Document Version Browser */}
        <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
          {/* Header & Upload Button */}
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Documents ({filteredDocs.length})
              </span>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0B2A4A] text-white hover:bg-[#081e36] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Upload PDF</span>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                placeholder="Filter standard..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-6 pr-2 py-0.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A]"
              />
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingDocs ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading documents...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No documents found</div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const statusDotColor =
                  doc.latest_status === "published"
                    ? "bg-emerald-500"
                    : doc.latest_status === "draft" || doc.latest_status === "in_review"
                    ? "bg-amber-500"
                    : "bg-slate-400";

                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setSelectedNode({
                        id: doc.id,
                        label: doc.standard_number || doc.title || doc.id,
                        type: "Document",
                        props: doc,
                      });
                    }}
                    className={`w-full text-left p-2.5 transition-colors flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 border-l-3 border-[#0B2A4A]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${statusDotColor}`}
                      title={`Status: ${doc.latest_status}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {doc.standard_number || doc.id}
                        </span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                          v{doc.latest_version_no}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {doc.title || doc.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span>{doc.chunk_count} chunks</span>
                        <span>•</span>
                        <span className="capitalize">{doc.latest_status}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Workspace (Tabs & Content) */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Tab Header */}
          <div className="h-10 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("graph")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "graph"
                    ? "border-[#0B2A4A] text-[#0B2A4A] bg-white font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Graph</span>
              </button>

              <button
                onClick={() => setActiveTab("document")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "document"
                    ? "border-[#0B2A4A] text-[#0B2A4A] bg-white font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Document</span>
                {selectedDocId && (
                  <span className="text-[10px] font-mono text-slate-400 max-w-[100px] truncate">
                    ({selectedDocId.replace("bis_doc_", "")})
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("facts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "facts"
                    ? "border-[#0B2A4A] text-[#0B2A4A] bg-white font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Facts</span>
                {pendingFactsCount > 0 && (
                  <span className="ml-1 rounded-full bg-[#E8710A] text-white px-1.5 py-0.2 text-[10px] font-bold">
                    {pendingFactsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "history"
                    ? "border-[#0B2A4A] text-[#0B2A4A] bg-white font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>History</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === "graph" && (
              <GraphTab
                onSelectNode={handleSelectNode}
                selectedNodeId={selectedNode?.id}
                focusedNodeId={focusedNodeId}
                onClearFocus={() => setFocusedNodeId(null)}
                onFocusNode={(nodeId) => setFocusedNodeId(nodeId)}
                onGraphLoaded={(data) => setAllGraphLinks(data.links)}
              />
            )}

            {activeTab === "document" && (
              <DocumentTab
                documentId={selectedDocId}
                onSelectChunk={(chunk) => {
                  setSelectedNode({
                    id: String(chunk.id),
                    label: chunk.clause_id || `Chunk #${chunk.chunk_index}`,
                    type: "Chunk",
                    props: chunk,
                  });
                  if (!showInspector) setShowInspector(true);
                }}
                onRefresh={() => {
                  fetchDocuments();
                  fetchPendingFacts();
                }}
              />
            )}

            {activeTab === "facts" && (
              <FactsTab
                onRefresh={() => {
                  fetchPendingFacts();
                  fetchDocuments();
                }}
                onSelectNode={(nodeId) => {
                  handleSelectNodeById(nodeId);
                  setActiveTab("graph");
                }}
              />
            )}

            {activeTab === "history" && <HistoryTab />}
          </div>
        </main>

        {/* Right Sidebar (340px): Node Inspector */}
        {showInspector && (
          <NodeInspector
            node={selectedNode}
            links={allGraphLinks}
            onSelectNode={handleSelectNodeById}
            onFocusNode={(nodeId) => {
              setFocusedNodeId(nodeId);
              setActiveTab("graph");
            }}
            onOpenDocument={handleOpenDocumentFromInspector}
          />
        )}
      </div>

      {/* PDF Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-[#0B2A4A]" />
                <h3 className="font-semibold text-sm text-slate-800">Upload Standard PDF</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-500">
                Upload a standard or QCO PDF. It will be ingested into the pipeline and staged as a{" "}
                <span className="font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">draft version</span>.
                Chunks will remain inactive until you review and publish.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Standard Number</label>
                <input
                  type="text"
                  placeholder="e.g. IS 4151"
                  value={uploadStandardNo}
                  onChange={(e) => setUploadStandardNo(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0B2A4A] focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Protective Helmets for Motorcycle Riders"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0B2A4A] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PDF File</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  required
                />
              </div>

              {uploadError && (
                <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 text-red-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccessMsg && (
                <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-50 text-emerald-700 text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{uploadSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-1.5 rounded bg-[#0B2A4A] text-white hover:bg-[#081e36] font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Clock className="h-3 w-3 animate-spin" />
                      <span>Ingesting PDF...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      <span>Upload & Stage</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
