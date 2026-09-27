"use client";

import React, { useState } from "react";
import { BookOpen, Award, FlaskConical, FileText } from "lucide-react";
import { StandardsList } from "./StandardsList";
import { CertificationSteps } from "./CertificationSteps";
import { LabsList } from "./LabsList";
import type { Source } from "@/lib/pipeline/package";

interface DetailTabsProps {
  standards?: any[];
  certification?: any;
  labs?: any[] | null;
  sources?: Source[];
  onOpenSourceDrawer?: (index: number) => void;
  onRequestLocation?: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function DetailTabs({
  standards,
  certification,
  labs,
  sources,
  onOpenSourceDrawer,
  onRequestLocation,
  userLocation,
}: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"standards" | "certification" | "labs" | "sources" | null>(null);

  const toggleTab = (tab: "standards" | "certification" | "labs" | "sources") => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const hasStandards = Boolean(standards && standards.length > 0);
  const hasCertification = Boolean(certification);
  const hasLabs = Boolean(labs && labs.length > 0);
  const hasSources = Boolean(sources && sources.length > 0);

  if (!hasStandards && !hasCertification && !hasLabs && !hasSources) {
    return null;
  }

  return (
    <div className="pt-3 border-t border-[#E5E7EB] mt-3">
      {/* 4 Small Tab-Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs select-none">
        {hasStandards && (
          <button
            onClick={() => toggleTab("standards")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
              activeTab === "standards"
                ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                : "bg-[#F7F8FA] border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB]"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Standards ({standards?.length})</span>
          </button>
        )}

        {hasCertification && (
          <button
            onClick={() => toggleTab("certification")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
              activeTab === "certification"
                ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                : "bg-[#F7F8FA] border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB]"
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Certification</span>
          </button>
        )}

        {hasLabs && (
          <button
            onClick={() => toggleTab("labs")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
              activeTab === "labs"
                ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                : "bg-[#F7F8FA] border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB]"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Labs ({labs?.length})</span>
          </button>
        )}

        {hasSources && (
          <button
            onClick={() => {
              if (onOpenSourceDrawer) {
                onOpenSourceDrawer(1);
              } else {
                toggleTab("sources");
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
              activeTab === "sources"
                ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                : "bg-[#F7F8FA] border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB]"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Sources ({sources?.length})</span>
          </button>
        )}
      </div>

      {/* Expanded Tab Body */}
      {activeTab && (
        <div className="mt-3 p-3 rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] animate-in fade-in duration-150">
          {activeTab === "standards" && <StandardsList standards={standards} />}
          {activeTab === "certification" && (
            <CertificationSteps certification={certification} onOpenSource={onOpenSourceDrawer} />
          )}
          {activeTab === "labs" && (
            <LabsList labs={labs} onRequestLocation={onRequestLocation} userLocation={userLocation} />
          )}
          {activeTab === "sources" && (
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-[#0B2A4A]">Cited Sources:</span>
              <div className="space-y-1.5">
                {sources?.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOpenSourceDrawer?.(idx + 1)}
                    className="w-full text-left p-2 rounded bg-white border border-[#E5E7EB] hover:border-[#0B2A4A] flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-medium text-[#0F172A] truncate">
                      [{s.label}] {s.title}
                    </span>
                    <span className="text-[11px] text-[#0B2A4A] shrink-0 font-medium ml-2">View ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
