"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface StandardItem {
  id: string;
  title: string;
  class: "applies" | "may_apply" | "related";
  why: string;
  source: string;
}

interface StandardsListProps {
  standards?: StandardItem[];
}

export function StandardsList({ standards = [] }: StandardsListProps) {
  const [showRelated, setShowRelated] = useState(false);

  if (!standards || standards.length === 0) {
    return <p className="text-xs text-[#64748B] italic p-2">No standards data available.</p>;
  }

  const primary = standards.filter((s) => s.class === "applies" || s.class === "may_apply");
  const related = standards.filter((s) => s.class === "related");

  return (
    <div className="space-y-2.5 pt-2 text-xs">
      {primary.map((std) => (
        <div
          key={std.id}
          className="p-3 rounded-lg border border-[#E5E7EB] bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono font-bold text-xs text-[#0B2A4A] bg-[#F7F8FA] px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                {std.id}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  std.class === "applies"
                    ? "bg-[#228f4a]/10 text-[#228f4a]"
                    : "bg-[#B45309]/10 text-[#B45309]"
                }`}
              >
                {std.class === "applies" ? "Applies" : "May apply"}
              </span>
            </div>
            <p className="font-semibold text-xs text-[#0F172A] truncate">{std.title}</p>
            {std.why && <p className="text-[11px] text-[#64748B] mt-0.5">{std.why}</p>}
          </div>

          <Link
            href={`/standards/${encodeURIComponent(std.id)}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B2A4A] hover:underline shrink-0"
          >
            <span>Open</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ))}

      {related.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowRelated(!showRelated)}
            className="text-xs font-medium text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 cursor-pointer"
          >
            <span>Related standards ({related.length})</span>
            {showRelated ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showRelated && (
            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-[#E5E7EB]">
              {related.map((std) => (
                <div key={std.id} className="py-1">
                  <span className="font-mono font-semibold text-xs text-[#0F172A]">{std.id}</span>
                  <span className="text-xs text-[#64748B]"> — {std.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
