"use client";

import React, { useState, useEffect } from "react";
import { FileText, ExternalLink, Search, ChevronRight, Layers, Eye, BookOpen } from "lucide-react";

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

export function DocumentsTab() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkQuery, setChunkQuery] = useState("");
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

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

  const filteredChunks = chunks.filter((c) => {
    if (!chunkQuery.trim()) return true;
    const q = chunkQuery.toLowerCase();
    return (
      c.clause.toLowerCase().includes(q) ||
      (c.clause_title || "").toLowerCase().includes(q) ||
      c.text.toLowerCase().includes(q)
    );
  });

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
            Standard specifications and forms uploaded by employees
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

                    <a
                      href={`/api/docs/${doc.doc_id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2A4A] hover:underline"
                    >
                      <span>PDF</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Document Details & Chunk Browser */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedDoc ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-[#E5E7EB] bg-slate-50/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#0B2A4A]">{selectedDoc.standard_id}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-xs font-mono text-slate-500">doc_id: {selectedDoc.doc_id}</span>
                </div>
                <h2 className="text-sm font-bold text-slate-900">{selectedDoc.title}</h2>
              </div>

              <div className="flex items-center gap-2">
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
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Select a document on the left to inspect its clauses and text chunks.
          </div>
        )}
      </div>
    </div>
  );
}
