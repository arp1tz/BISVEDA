"use client";

import React from "react";
import { CitationPill } from "./CitationPill";

interface StepItem {
  text: string;
  source: string;
}

interface CertificationStepsProps {
  certification?: {
    scheme_name: string;
    steps: StepItem[];
  } | null;
  onOpenSource?: (idx: number) => void;
}

export function CertificationSteps({ certification, onOpenSource }: CertificationStepsProps) {
  if (!certification) {
    return <p className="text-xs text-[#64748B] italic p-2">No certification scheme details available.</p>;
  }

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[#64748B]">Applicable Scheme:</span>
        <span className="font-bold text-[#0B2A4A] bg-[#F7F8FA] px-2 py-0.5 rounded border border-[#E5E7EB]">
          {certification.scheme_name}
        </span>
      </div>

      <div className="space-y-2 pl-1">
        {certification.steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-[#0B2A4A]/10 text-[#0B2A4A] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <p className="text-[#0F172A] leading-relaxed flex-1">
              {step.text}
              {onOpenSource && <CitationPill sourceIndex={idx + 1} onClick={onOpenSource} />}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
