"use client";

import React, { useState } from "react";
import { Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { StageEvent } from "@/lib/pipeline/respond";

interface WorkingStepsProps {
  events?: StageEvent[];
  steps?: StageEvent[];
  isComplete?: boolean;
  totalDurationMs?: number;
  sourcesCount?: number;
}

const ORDERED_STAGES = [
  { stage: "understand", label: "Understanding your question" },
  { stage: "search", label: "Searching official BIS sources" },
  { stage: "check", label: "Checking certification rules" },
  { stage: "write", label: "Writing a clear answer" },
];

export function WorkingSteps({
  events,
  steps,
  isComplete = false,
  totalDurationMs,
  sourcesCount,
}: WorkingStepsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeEvents = events || steps || [];

  // Map latest status per stage
  const stageStatusMap = new Map<string, "active" | "done" | "pending">();
  ORDERED_STAGES.forEach((s) => stageStatusMap.set(s.stage, "pending"));

  activeEvents.forEach((ev) => {
    stageStatusMap.set(ev.stage, ev.status);
  });

  if (isComplete && !isExpanded) {
    const seconds = totalDurationMs ? (totalDurationMs / 1000).toFixed(1) : "1.2";
    return (
      <div className="flex items-center justify-between text-xs text-[#64748B] py-1.5 px-3 rounded-lg bg-[#F7F8FA] border border-[#E5E7EB] my-2 select-none">
        <span className="font-medium text-[#0F172A]">
          Answered in {seconds} s · {sourcesCount || 0} sources
        </span>
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1 text-[11px] text-[#0B2A4A] hover:underline cursor-pointer"
        >
          <span>View steps</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-3 p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] text-xs space-y-2 select-none">
      <div className="flex items-center justify-between font-semibold text-[#0B2A4A] mb-1">
        <span>BISVEDA is working on it…</span>
        {isComplete && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-0.5 cursor-pointer"
          >
            <span>Collapse</span>
            <ChevronUp className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="space-y-1.5 pl-1">
        {ORDERED_STAGES.map((s) => {
          const status = stageStatusMap.get(s.stage) || "pending";
          return (
            <div key={s.stage} className="flex items-center gap-2.5">
              {status === "done" ? (
                <div className="h-4 w-4 rounded-full bg-[#228f4a]/15 text-[#228f4a] flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              ) : status === "active" ? (
                <div className="h-4 w-4 text-[#0B2A4A] flex items-center justify-center shrink-0">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border border-[#CBD5E1] shrink-0" />
              )}
              <span
                className={
                  status === "active"
                    ? "font-semibold text-[#0B2A4A]"
                    : status === "done"
                    ? "text-[#0F172A]"
                    : "text-[#64748B]"
                }
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
