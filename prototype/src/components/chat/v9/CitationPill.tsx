"use client";

import React from "react";

interface CitationPillProps {
  sourceIndex: number;
  sourceLabel?: string;
  onClick: (index: number) => void;
}

export function CitationPill({ sourceIndex, sourceLabel, onClick }: CitationPillProps) {
  const label = sourceLabel || `S${sourceIndex}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(sourceIndex);
      }}
      className="inline-flex items-center justify-center align-super text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#0B2A4A]/10 text-[#0B2A4A] hover:bg-[#0B2A4A] hover:text-white transition-colors mx-0.5 cursor-pointer select-none"
      title={`View source ${label}`}
    >
      [{label}]
    </button>
  );
}
