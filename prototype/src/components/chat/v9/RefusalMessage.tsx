"use client";

import React from "react";
import { Info, ExternalLink, Compass, ArrowRight, HelpCircle, PhoneCall } from "lucide-react";

interface NextStepItem {
  text: string;
  url?: string;
}

interface RefusalMessageProps {
  message: string;
  nextSteps?: NextStepItem[];
  onSelectSuggestion?: (query: string) => void;
}

const DEFAULT_RECOMMENDED_TOPICS = [
  { label: "Helmets (IS 4151)", query: "Is BIS certification mandatory for helmets?" },
  { label: "Pressure Cookers (IS 2347)", query: "Domestic pressure cooker certification requirements" },
  { label: "Toys Safety (IS 9873)", query: "Which standards apply to children toys?" },
  { label: "Packaged Water (IS 14543)", query: "Packaged drinking water BIS standard" },
  { label: "Gold Hallmarking (IS 1417)", query: "Gold jewellery hallmarking rules" },
];

export function RefusalMessage({
  message,
  nextSteps = [],
  onSelectSuggestion,
}: RefusalMessageProps) {
  return (
    <div className="w-full my-3 p-4 rounded-2xl border border-[#E5E7EB] bg-[#F7F8FA] text-xs space-y-4 shadow-2xs">
      {/* Primary Message */}
      <div className="flex items-start gap-2.5 text-[#0F172A]">
        <Info className="h-4 w-4 text-[#64748B] shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <p className="leading-relaxed font-medium text-sm text-[#0F172A]">{message}</p>
          <p className="text-[#64748B] text-xs">
            We couldn&apos;t confirm an exact match in our authorized BIS database. You can try a recommended query below or consult official portals.
          </p>
        </div>
      </div>

      {/* Guided Path: Recommended Queries */}
      <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0B2A4A]">
          <Compass className="h-3.5 w-3.5 text-[#E8710A]" />
          <span>Recommended Pathways</span>
        </div>
        <p className="text-[11px] text-[#64748B]">
          Select a verified product category to inspect applicable standards, QCO orders, and testing labs:
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {DEFAULT_RECOMMENDED_TOPICS.map((topic, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectSuggestion?.(topic.query)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#0B2A4A] hover:text-[#0B2A4A] text-xs font-medium text-[#0F172A] transition-colors cursor-pointer group shadow-2xs"
            >
              <span>{topic.label}</span>
              <ArrowRight className="h-3 w-3 text-[#64748B] group-hover:text-[#0B2A4A]" />
            </button>
          ))}
        </div>
      </div>

      {/* Official Government Routes */}
      <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          Official Government Resources
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <a
            href="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#0B2A4A] text-[#0B2A4A] font-medium transition-colors"
          >
            <span>Search BIS Active Standards</span>
            <ExternalLink className="h-3 w-3 text-[#64748B]" />
          </a>

          <a
            href="https://www.bis.gov.in/product-certification/products-under-compulsory-certification/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#0B2A4A] text-[#0B2A4A] font-medium transition-colors"
          >
            <span>Notified QCO Mandatory Orders</span>
            <ExternalLink className="h-3 w-3 text-[#64748B]" />
          </a>

          <a
            href="https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/lims/lims_search/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#0B2A4A] text-[#0B2A4A] font-medium transition-colors"
          >
            <span>Recognized Laboratory Directory</span>
            <ExternalLink className="h-3 w-3 text-[#64748B]" />
          </a>

          <a
            href="https://consumerhelpline.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#0B2A4A] text-[#0B2A4A] font-medium transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <PhoneCall className="h-3 w-3 text-[#228f4a]" />
              <span>Consumer Helpline (1915)</span>
            </span>
            <ExternalLink className="h-3 w-3 text-[#64748B]" />
          </a>
        </div>
      </div>
    </div>
  );
}
