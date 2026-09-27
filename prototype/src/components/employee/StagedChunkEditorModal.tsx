"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Check,
  Trash2,
  Plus,
  FileText,
  Search,
  Sparkles,
  Layers,
  ShieldCheck,
  Eye,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export interface StagedChunkItem {
  chunkId: string;
  clauseNumber?: string;
  clauseTitle?: string;
  breadcrumb?: string[];
  pageNumbers?: number[];
  text: string;
  knowledgeTier?: string;
  isActive?: boolean;
}

interface StagedChunkEditorModalProps {
  documentId: string;
  filename: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function StagedChunkEditorModal({
  documentId,
  filename,
  onClose,
  onSaved,
}: StagedChunkEditorModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [docMeta, setDocMeta] = useState<{
    id: string;
    filename: string;
    standardNumber?: string;
    title?: string;
    knowledgeTier?: string;
    status?: string;
  }>({ id: documentId, filename });

  const [chunks, setChunks] = useState<StagedChunkItem[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);

  useEffect(() => {
    async function loadDoc() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v8/documents/${encodeURIComponent(documentId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.document) {
            setDocMeta({
              id: data.document.id,
              filename: data.document.filename,
              standardNumber: data.document.standardNumber || data.document.standard_number || "",
              title: data.document.title || "",
              knowledgeTier: data.document.knowledgeTier || "B",
              status: data.document.status || "staged",
            });
          }
          if (Array.isArray(data.chunks)) {
            setChunks(data.chunks);
          }
        }
      } catch (err) {
        console.error("Failed to load document chunks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDoc();
  }, [documentId]);

  const handleUpdateChunk = (index: number, field: keyof StagedChunkItem, val: any) => {
    setChunks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleDeleteChunk = (index: number) => {
    const chunkToDelete = chunks[index];
    if (window.confirm(`Delete chunk "${chunkToDelete.clauseTitle || chunkToDelete.clauseNumber || chunkToDelete.chunkId}"?`)) {
      setChunks((prev) => prev.filter((_, i) => i !== index));
      if (activeChunkIndex >= chunks.length - 1) {
        setActiveChunkIndex(Math.max(0, chunks.length - 2));
      }
    }
  };

  const handleAddNewChunk = () => {
    const newChunk: StagedChunkItem = {
      chunkId: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clauseNumber: "Clause X.X",
      clauseTitle: "New Technical Requirement",
      breadcrumb: [docMeta.standardNumber || "Standard", "Section", "Requirement"],
      pageNumbers: [1],
      text: "Enter statutory requirement text here...",
      knowledgeTier: "B",
      isActive: true,
    };
    setChunks((prev) => [newChunk, ...prev]);
    setActiveChunkIndex(0);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v8/documents/${encodeURIComponent(documentId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            standardNumber: docMeta.standardNumber,
            title: docMeta.title,
            knowledgeTier: docMeta.knowledgeTier,
          },
          chunks: chunks,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        onSaved?.();
      } else {
        alert("Failed to save changes. Please try again.");
      }
    } catch (err) {
      alert("Error saving: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  const filteredChunks = chunks.filter((c) => {
    const q = filterQuery.toLowerCase();
    return (
      (c.clauseNumber && c.clauseNumber.toLowerCase().includes(q)) ||
      (c.clauseTitle && c.clauseTitle.toLowerCase().includes(q)) ||
      (c.text && c.text.toLowerCase().includes(q)) ||
      (c.chunkId && c.chunkId.toLowerCase().includes(q))
    );
  });

  const activeChunk = chunks[activeChunkIndex] || filteredChunks[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] rounded-2xl bg-surface-raised border border-border shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-alt/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-navy text-white">
              <Layers className="h-5 w-5 text-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-navy bg-navy/10 px-2 py-0.5 rounded">
                  {docMeta.standardNumber || "STAGED DOC"}
                </span>
                <span className="text-xs font-bold text-ink-soft">
                  Staging &amp; Chunk Knowledge Editor
                </span>
                <span className="rounded bg-orange/15 px-2 py-0.5 text-[10px] font-bold text-orange">
                  {chunks.length} Chunks Extracted
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-ink truncate mt-0.5">
                {filename}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/v8/documents/${encodeURIComponent(documentId)}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-orange" />
              <span>Preview PDF</span>
            </a>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveChanges}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy hover:bg-navy-deep text-white px-4 py-1.5 text-xs font-bold transition-all shadow-xs"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4 text-success" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-orange" />
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-ink-faint hover:text-navy hover:bg-surface-alt transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Metadata Controls Bar */}
        <div className="px-5 py-2.5 bg-surface border-b border-border/70 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-navy">Standard No:</span>
            <input
              type="text"
              value={docMeta.standardNumber || ""}
              onChange={(e) => setDocMeta({ ...docMeta, standardNumber: e.target.value })}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-mono font-bold text-navy bg-surface-alt focus:border-navy focus:outline-none w-44"
              placeholder="e.g. IS 9873 (Part 1)"
            />
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-[200px]">
            <span className="font-bold text-navy shrink-0">Official Title:</span>
            <input
              type="text"
              value={docMeta.title || ""}
              onChange={(e) => setDocMeta({ ...docMeta, title: e.target.value })}
              className="w-full rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-navy bg-surface-alt focus:border-navy focus:outline-none"
              placeholder="Standard title..."
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-navy">Knowledge Tier:</span>
            <select
              value={docMeta.knowledgeTier || "B"}
              onChange={(e) => setDocMeta({ ...docMeta, knowledgeTier: e.target.value })}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-navy bg-surface-alt focus:border-navy focus:outline-none"
            >
              <option value="A">Tier A (Catalogue / Scope)</option>
              <option value="B">Tier B (Product Manual / STI)</option>
              <option value="C">Tier C (Full Technical Text)</option>
            </select>
          </div>
        </div>

        {/* Main Content: Split Editor View */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-surface">
          
          {/* Left Column: Chunk List & Search */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-border bg-surface-alt/30 flex flex-col shrink-0">
            {/* Search & Add Bar */}
            <div className="p-3 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                  Extracted Clauses ({filteredChunks.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddNewChunk}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-navy hover:text-orange transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Chunk</span>
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Filter clauses by text/number..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface pl-8 pr-2.5 py-1 text-xs font-medium text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none"
                />
              </div>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="p-6 text-center text-xs text-ink-faint animate-pulse">
                  Loading chunks from sovereign fabric...
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-faint">
                  No chunks match filter.
                </div>
              ) : (
                filteredChunks.map((chunk, idx) => {
                  const actualIdx = chunks.findIndex((c) => c.chunkId === chunk.chunkId);
                  const isSelected = actualIdx === activeChunkIndex;

                  return (
                    <div
                      key={chunk.chunkId}
                      onClick={() => setActiveChunkIndex(actualIdx)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-navy bg-surface-raised shadow-xs ring-1 ring-navy/20"
                          : "border-border/70 bg-surface hover:border-border hover:bg-surface-raised"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-bold text-navy truncate">
                          {chunk.clauseNumber || `Chunk ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              chunk.isActive ?? true ? "bg-success/15 text-success" : "bg-ink-faint/20 text-ink-faint"
                            }`}
                          >
                            {chunk.isActive ?? true ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-[11px] font-semibold text-ink truncate mt-0.5">
                        {chunk.clauseTitle || "Clause Requirement"}
                      </h4>

                      <p className="text-[10px] text-ink-faint line-clamp-2 mt-1 leading-snug">
                        {chunk.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chunk Detail & Editor Form */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto space-y-4">
            {activeChunk ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-navy bg-navy/10 px-2 py-0.5 rounded">
                      {activeChunk.chunkId}
                    </span>
                    <span className="text-xs font-bold text-ink-soft">
                      Editing Selected Clause Fact
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-navy cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeChunk.isActive ?? true}
                        onChange={(e) => handleUpdateChunk(activeChunkIndex, "isActive", e.target.checked)}
                        className="rounded border-border text-navy"
                      />
                      <span>Active in Live Search</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteChunk(activeChunkIndex)}
                      className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 transition-colors"
                      title="Delete this chunk"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block mb-1">
                      Clause Number / Ref
                    </label>
                    <input
                      type="text"
                      value={activeChunk.clauseNumber || ""}
                      onChange={(e) => handleUpdateChunk(activeChunkIndex, "clauseNumber", e.target.value)}
                      placeholder="e.g. 4.1 or Table 3"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-mono font-bold text-navy focus:border-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block mb-1">
                      Clause Heading / Title
                    </label>
                    <input
                      type="text"
                      value={activeChunk.clauseTitle || ""}
                      onChange={(e) => handleUpdateChunk(activeChunkIndex, "clauseTitle", e.target.value)}
                      placeholder="e.g. Impact Attenuation Test"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-navy focus:border-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block mb-1">
                      Page Numbers (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={(activeChunk.pageNumbers || []).join(", ")}
                      onChange={(e) => {
                        const pages = e.target.value
                          .split(",")
                          .map((p) => parseInt(p.trim(), 10))
                          .filter((p) => !isNaN(p));
                        handleUpdateChunk(activeChunkIndex, "pageNumbers", pages);
                      }}
                      placeholder="e.g. 8, 9"
                      className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-mono text-navy focus:border-navy focus:outline-none"
                    />
                  </div>
                </div>

                {/* Full Chunk Textarea */}
                <div className="flex-1 flex flex-col space-y-1 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      Verbatim Clause / Statutory Text:
                    </label>
                    <span className="text-[10px] font-mono text-ink-faint">
                      {(activeChunk.text || "").length} characters • ~{Math.ceil((activeChunk.text || "").length / 4)} tokens
                    </span>
                  </div>

                  <textarea
                    rows={12}
                    value={activeChunk.text || ""}
                    onChange={(e) => handleUpdateChunk(activeChunkIndex, "text", e.target.value)}
                    className="w-full flex-1 rounded-xl border border-border bg-surface p-3 text-xs font-mono leading-relaxed text-ink focus:border-navy focus:outline-none resize-none"
                    placeholder="Enter verbatim statutory clause text..."
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-alt/40 p-3 text-[11px] text-ink-faint flex items-center justify-between">
                  <span>
                    💡 <em>Tip: Edits to clause text or numbers take effect immediately in the local hybrid vector &amp; FTS search.</em>
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveChanges}
                    className="rounded-lg bg-navy hover:bg-navy-deep text-white px-3 py-1 text-xs font-bold transition-all shadow-xs"
                  >
                    Save &amp; Update
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-ink-faint">
                Select a clause on the left to edit its details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
