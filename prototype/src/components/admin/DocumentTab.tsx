"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Clock,
  CheckCircle,
  Archive,
  RotateCcw,
  GitCompare,
  Upload,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  Eye,
  X,
  FileCheck,
} from "lucide-react";
import type {
  DocumentVersionRecord,
  VersionDiffResult,
  VersionImpactResult,
} from "@/lib/knowledge/types";

interface DocumentTabProps {
  documentId: string | null;
  onSelectChunk?: (chunk: any) => void;
  onRefresh?: () => void;
}

export function DocumentTab({
  documentId,
  onSelectChunk,
  onRefresh,
}: DocumentTabProps) {
  const [versions, setVersions] = useState<DocumentVersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkQuery, setChunkQuery] = useState("");

  // Modals & Panels
  const [impactModal, setImpactModal] = useState<{
    action: "publish" | "archive" | "rollback";
    impact: VersionImpactResult;
  } | null>(null);
  const [diffModal, setDiffModal] = useState<VersionDiffResult | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNote, setActionNote] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadEvents, setUploadEvents] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Fetch document versions
  const fetchVersions = useCallback(async () => {
    if (!documentId) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        if (data.versions?.length > 0) {
          // Select latest or published version
          const published = data.versions.find((v: any) => v.status === "published");
          setSelectedVersionId(published ? published.id : data.versions[0].id);
        }
      }
    } catch (err) {
      console.error("[Fetch Versions Error]:", err);
    } finally {
      setLoadingVersions(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Fetch chunks for selected version
  const fetchChunks = useCallback(async () => {
    if (!selectedVersionId) return;
    setLoadingChunks(true);
    try {
      const url = `/api/admin/versions/${selectedVersionId}/chunks?q=${encodeURIComponent(
        chunkQuery
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChunks(data.chunks || []);
      }
    } catch (err) {
      console.error("[Fetch Chunks Error]:", err);
    } finally {
      setLoadingChunks(false);
    }
  }, [selectedVersionId, chunkQuery]);

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  if (!documentId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-center text-slate-400">
        <div>
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Document Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Select a document from the left sidebar to inspect its versions, compare revisions, and manage publication.
          </p>
        </div>
      </div>
    );
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  // Pre-action impact analysis
  const handleInitiateAction = async (action: "publish" | "archive" | "rollback", vid: number) => {
    try {
      const res = await fetch(`/api/admin/versions/${vid}/impact`);
      if (res.ok) {
        const impact = await res.json();
        setImpactModal({ action, impact });
      }
    } catch (err) {
      console.error("[Impact Check Error]:", err);
    }
  };

  // Execute version action
  const handleExecuteAction = async () => {
    if (!impactModal || !selectedVersionId) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/versions/${selectedVersionId}/${impactModal.action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: actionNote, actor: "Dr. A. K. Verma" }),
        }
      );
      if (res.ok) {
        setImpactModal(null);
        setActionNote("");
        await fetchVersions();
        await fetchChunks();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Action Execution Error]:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Compare two versions
  const handleCompare = async (targetVid: number) => {
    if (!selectedVersionId) return;
    try {
      const res = await fetch(`/api/admin/versions/${selectedVersionId}/diff/${targetVid}`);
      if (res.ok) {
        const data = await res.json();
        setDiffModal(data);
      }
    } catch (err) {
      console.error("[Diff Error]:", err);
    }
  };

  // Handle PDF upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadEvents([]);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("documentId", documentId);
    formData.append("uploadedBy", "Dr. A. K. Verma");

    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.events) {
        setUploadEvents(data.events);
      }
      await fetchVersions();
      onRefresh?.();
    } catch (err) {
      console.error("[Upload Error]:", err);
    } finally {
      setIsUploading(false);
      setUploadFile(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden text-xs">
      {/* Top Header: Document Title & Version Bar */}
      <div className="border-b border-slate-200 p-4 bg-slate-50/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#0B2A4A]">{documentId}</span>
              <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                {versions.length} Version{versions.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs">
              <Upload className="h-3.5 w-3.5 text-[#0B2A4A]" />
              <span>Upload New Revision</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Upload Inline Confirmation */}
        {uploadFile && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-700" />
              <span className="font-medium text-amber-900">
                Ready to ingest: <strong>{uploadFile.name}</strong> (staged as draft version)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUploadFile(null)}
                className="rounded px-2.5 py-1 text-slate-600 hover:bg-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={isUploading}
                className="rounded bg-[#0B2A4A] px-3 py-1 font-semibold text-white hover:bg-[#071D33] text-xs"
              >
                {isUploading ? "Ingesting..." : "Ingest Draft"}
              </button>
            </div>
          </div>
        )}

        {/* Versions Timeline Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
          <span className="text-slate-500 font-medium mr-1">Revisions:</span>
          {versions.map((v) => {
            const isSelected = v.id === selectedVersionId;
            const isPub = v.status === "published";
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                  isSelected
                    ? "border-[#0B2A4A] bg-[#0B2A4A] text-white shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>v{v.version_no}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPub ? "bg-emerald-400" : v.status === "draft" ? "bg-amber-400" : "bg-slate-300"
                  }`}
                />
                <span className="text-[10px] opacity-80 capitalize">{v.status}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Version Detail Bar */}
      {selectedVersion && (
        <div className="border-b border-slate-200 px-4 py-2.5 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-slate-600 text-[11px]">
            <span>
              Author: <strong className="text-slate-900">{selectedVersion.created_by}</strong>
            </span>
            <span>•</span>
            <span>
              Date: <strong className="text-slate-900">{new Date(selectedVersion.created_at || "").toLocaleDateString()}</strong>
            </span>
            <span>•</span>
            <span className="italic text-slate-500">"{selectedVersion.change_note || "Standard edition"}"</span>
          </div>

          {/* Version Action Buttons */}
          <div className="flex items-center gap-1.5">
            {selectedVersion.status !== "published" && (
              <button
                onClick={() => handleInitiateAction("publish", selectedVersion.id)}
                className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
              >
                <CheckCircle className="h-3 w-3" />
                <span>Publish Revision</span>
              </button>
            )}

            {selectedVersion.status === "published" && (
              <button
                onClick={() => handleInitiateAction("archive", selectedVersion.id)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                <Archive className="h-3 w-3" />
                <span>Archive</span>
              </button>
            )}

            {selectedVersion.status === "archived" && (
              <button
                onClick={() => handleInitiateAction("rollback", selectedVersion.id)}
                className="inline-flex items-center gap-1 rounded bg-[#0B2A4A] px-2.5 py-1 font-semibold text-white hover:bg-[#071D33]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Roll Back to This Version</span>
              </button>
            )}

            {versions.length > 1 && (
              <select
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val) handleCompare(val);
                }}
                defaultValue=""
                className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 text-xs"
              >
                <option value="" disabled>
                  Compare with...
                </option>
                {versions
                  .filter((v) => v.id !== selectedVersion.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version_no} ({v.status})
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Chunks Filter Search */}
      <div className="border-b border-slate-200 px-4 py-2 bg-slate-50/50 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search clauses in this revision..."
            value={chunkQuery}
            onChange={(e) => setChunkQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0B2A4A] focus:outline-none"
          />
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {chunks.length} clause chunks indexed
        </span>
      </div>

      {/* Chunks Table */}
      <div className="flex-1 overflow-y-auto">
        {loadingChunks ? (
          <div className="p-8 text-center text-slate-400">Loading chunks...</div>
        ) : chunks.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No chunks found matching search query.</div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 font-semibold w-24">Clause</th>
                <th className="py-2 px-2 font-semibold w-16">Page</th>
                <th className="py-2 px-3 font-semibold">Heading / Breadcrumb</th>
                <th className="py-2 px-4 font-semibold">Excerpt Preview</th>
                <th className="py-2 px-2 font-semibold w-16 text-right">Tokens</th>
                <th className="py-2 px-2 font-semibold w-12 text-center">Vector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chunks.map((c) => (
                <tr
                  key={c.chunk_id}
                  onClick={() => onSelectChunk?.(c)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">
                    {c.clause_id}
                  </td>
                  <td className="py-2 px-2 text-slate-500 font-mono">
                    p.{c.page}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-700 truncate max-w-[200px]">
                    {c.clause_title || c.breadcrumb?.join(" > ") || "General"}
                  </td>
                  <td className="py-2 px-4 text-slate-600 truncate max-w-[340px]">
                    {c.text_preview}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-500">
                    {c.token_count}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {c.has_embedding ? (
                      <span className="text-emerald-600 font-bold" title="768-d Vector Indexed">✓</span>
                    ) : (
                      <span className="text-slate-300 font-bold" title="No Embedding">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pre-Action Impact Modal */}
      {impactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="text-base font-semibold text-slate-900 capitalize">
                Confirm {impactModal.action} Impact
              </h3>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Searchable Chunks Delta:</span>
                <strong className={impactModal.impact.searchableChunksDelta >= 0 ? "text-emerald-700" : "text-amber-700"}>
                  {impactModal.impact.searchableChunksDelta >= 0 ? `+${impactModal.impact.searchableChunksDelta}` : impactModal.impact.searchableChunksDelta} chunks
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Chunks in Version:</span>
                <strong>{impactModal.impact.totalChunks}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Facts Citing this Version:</span>
                <strong>{impactModal.impact.affectedFactsCount}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason / Audit Note (mandatory)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Published Amendment 2 with updated impact absorption criteria"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-[#0B2A4A] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setImpactModal(null)}
                className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={actionLoading || !actionNote.trim()}
                className="rounded-lg bg-[#0B2A4A] px-4 py-2 font-semibold text-white hover:bg-[#071D33] disabled:opacity-50"
              >
                {actionLoading ? "Executing..." : "Confirm & Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Diff Modal */}
      {diffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-[#0B2A4A]" />
                <h3 className="text-base font-semibold text-slate-900">
                  Revision Diff: v{diffModal.versionA.version_no} vs v{diffModal.versionB.version_no}
                </h3>
              </div>
              <button
                onClick={() => setDiffModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Counts */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-200">
                <span className="block text-emerald-800 font-bold text-base">{diffModal.summary.added}</span>
                <span className="text-emerald-700 font-medium">Added</span>
              </div>
              <div className="rounded-lg bg-red-50 p-2 border border-red-200">
                <span className="block text-red-800 font-bold text-base">{diffModal.summary.removed}</span>
                <span className="text-red-700 font-medium">Removed</span>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 border border-amber-200">
                <span className="block text-amber-800 font-bold text-base">{diffModal.summary.changed}</span>
                <span className="text-amber-700 font-medium">Modified</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                <span className="block text-slate-800 font-bold text-base">{diffModal.summary.unchanged}</span>
                <span className="text-slate-600 font-medium">Unchanged</span>
              </div>
            </div>

            {/* Diff Chunk List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {diffModal.chunks
                .filter((c) => c.diffStatus !== "unchanged")
                .map((chunk, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 ${
                      chunk.diffStatus === "added"
                        ? "border-emerald-200 bg-emerald-50/40"
                        : chunk.diffStatus === "removed"
                        ? "border-red-200 bg-red-50/40"
                        : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold mb-1.5">
                      <span className="text-slate-900">Clause {chunk.clause_id}</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-semibold bg-white border border-slate-200">
                        {chunk.diffStatus}
                      </span>
                    </div>

                    {chunk.diffStatus === "changed" && chunk.wordDiff ? (
                      <p className="leading-relaxed font-mono text-[11px]">
                        {chunk.wordDiff.map((part, pIdx) => (
                          <span
                            key={pIdx}
                            className={
                              part.added
                                ? "bg-emerald-200 text-emerald-900 px-0.5 rounded"
                                : part.removed
                                ? "bg-red-200 text-red-900 line-through px-0.5 rounded"
                                : "text-slate-800"
                            }
                          >
                            {part.value}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-slate-700 font-mono text-[11px]">
                        {chunk.textA || chunk.textB}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
