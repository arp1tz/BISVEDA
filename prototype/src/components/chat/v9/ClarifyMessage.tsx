"use client";

import React from "react";
import { HelpCircle, ArrowRight } from "lucide-react";

interface ClarifyOption {
  label: string;
  value: string;
}

interface ClarifyMessageProps {
  question: string;
  options: ClarifyOption[];
  onSelectOption: (optionText: string) => void;
}

export function ClarifyMessage({
  question,
  options,
  onSelectOption,
}: ClarifyMessageProps) {
  return (
    <div className="w-full my-3 p-4 rounded-xl border border-[#E5E7EB] bg-white shadow-xs space-y-3 text-xs">
      <div className="flex items-start gap-2 text-[#0B2A4A] font-semibold text-sm">
        <HelpCircle className="h-4 w-4 text-[#E8710A] shrink-0 mt-0.5" />
        <span>{question}</span>
      </div>

      <p className="text-[#64748B] pl-6">
        Please specify your product type to identify the correct Indian Standard specification:
      </p>

      {/* Option Chips */}
      <div className="flex flex-wrap gap-2 pl-6 pt-1">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onSelectOption(opt.label || opt.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] hover:border-[#0B2A4A] hover:bg-white hover:text-[#0B2A4A] font-medium transition-all text-xs cursor-pointer group"
          >
            <span>{opt.label}</span>
            <ArrowRight className="h-3 w-3 text-[#64748B] group-hover:text-[#0B2A4A]" />
          </button>
        ))}
      </div>
    </div>
  );
}
