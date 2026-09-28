"use client";

import React, { useEffect } from "react";
import { X, ExternalLink, FileText, BookOpen } from "lucide-react";
import type { Source } from "@/lib/pipeline/package";

interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  source: Source | null;
  sourceIndex: number;
}

export function SourceDrawer({
  isOpen,
  onClose,
  source,
  sourceIndex,
}: SourceDrawerProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !source) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs transition-opacity"
      />

      {/* Slide-over Drawer (380px) */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-white border-l border-[#E5E7EB] shadow-xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#E5E7EB] bg-[#F7F8FA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#0B2A4A] text-white">
              S{sourceIndex}
            </span>
            <span className="font-semibold text-xs text-[#0B2A4A]">
              Source citation
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#E5E7EB] transition-colors cursor-pointer"
            title="Close Drawer (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Title & Metadata */}
          <div>
            <h3 className="font-bold text-sm text-[#0F172A] leading-snug">
              {source.title}
            </h3>
            {source.standard_id && (
              <span className="font-mono text-xs font-semibold text-[#0B2A4A] mt-1 inline-block">
                {source.standard_id}
              </span>
            )}
          </div>

          {/* Clause & Page */}
          {(source.clause || source.page) && (
            <div className="flex items-center gap-3 py-1.5 px-2.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#64748B]">
              {source.clause && (
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-[#0B2A4A]" />
                  <span>Clause {source.clause}</span>
                </div>
              )}
              {source.page && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-[#0B2A4A]" />
                  <span>Page {source.page}</span>
                </div>
              )}
            </div>
          )}

          {/* Excerpt */}
          <div>
            <h4 className="font-semibold text-[#0F172A] mb-1.5 text-[11px] text-[#64748B]">
              Verified excerpt
            </h4>
            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E5E7EB] leading-relaxed text-[#0F172A] font-sans">
              <span className="bg-[#FFF7ED] text-[#0F172A] px-0.5 rounded font-medium">
                {source.text}
              </span>
            </div>
          </div>

          {/* Source Document */}
          <div className="p-3 rounded-lg border border-[#E5E7EB] bg-slate-50 text-slate-600 space-y-1">
            <span className="font-semibold block text-[#0F172A]">Document:</span>
            <p className="text-[11px] text-[#64748B]">
              From the original PDF, page {source.page || "—"}.
            </p>
          </div>
        </div>

        {/* Drawer Footer Link */}
        <div className="p-4 border-t border-[#E5E7EB] bg-[#F7F8FA]">
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] font-semibold text-xs transition-colors"
            >
              <span>Open official source</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <div className="text-center text-[11px] text-[#64748B] italic">
              Official gazette archive reference
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
