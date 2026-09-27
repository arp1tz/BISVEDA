"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

interface FollowUpsProps {
  suggestions: string[];
  onSelectSuggestion?: (text: string) => void;
  onSelect?: (text: string) => void;
}

export function FollowUps({ suggestions, onSelectSuggestion, onSelect }: FollowUpsProps) {
  if (!suggestions || suggestions.length === 0) return null;
  const handler = onSelect || onSelectSuggestion || (() => {});

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 px-1 select-none">
      {suggestions.slice(0, 3).map((text, idx) => (
        <button
          key={idx}
          onClick={() => handler(text)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#0F172A] hover:border-[#0B2A4A] hover:bg-[#F7F8FA] hover:text-[#0B2A4A] transition-colors cursor-pointer group shadow-2xs"
        >
          <span>{text}</span>
          <ArrowRight className="h-3 w-3 text-[#64748B] group-hover:text-[#0B2A4A]" />
        </button>
      ))}
    </div>
  );
}
