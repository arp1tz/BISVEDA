"use client";

import React from "react";
import { AlertCircle, Clock, Info } from "lucide-react";
import { CitationPill } from "./CitationPill";

interface QcoLineProps {
  qco?: {
    status: "mandatory" | "notified_not_in_force" | "unknown";
    order_title?: string;
    effective_on?: string;
    source?: string;
  };
  onOpenSource?: (sourceIdx: number) => void;
  citationIndex?: number;
}

export function QcoLine({ qco, onOpenSource, citationIndex }: QcoLineProps) {
  if (!qco) return null;

  if (qco.status === "mandatory") {
    return (
      <div className="flex items-start gap-2.5 my-2.5 pl-3 py-1 border-l-3 border-[#bd2f2f] bg-[#bd2f2f]/5 text-xs text-[#0F172A] rounded-r-md">
        <AlertCircle className="h-4 w-4 text-[#bd2f2f] shrink-0 mt-0.5" />
        <div className="flex-1 font-medium">
          <span className="font-bold text-[#bd2f2f]">BIS certification is mandatory</span>
          {qco.order_title && <span> — {qco.order_title}</span>}
          {citationIndex && onOpenSource && (
            <CitationPill sourceIndex={citationIndex} onClick={onOpenSource} />
          )}
        </div>
      </div>
    );
  }

  if (qco.status === "notified_not_in_force") {
    return (
      <div className="flex items-start gap-2.5 my-2.5 pl-3 py-1 border-l-3 border-[#B45309] bg-[#B45309]/5 text-xs text-[#0F172A] rounded-r-md">
        <Clock className="h-4 w-4 text-[#B45309] shrink-0 mt-0.5" />
        <div className="flex-1 font-medium">
          <span className="font-bold text-[#B45309]">Notified Quality Control Order</span>
          {qco.effective_on && <span> (comes into force on {qco.effective_on})</span>}
          {qco.order_title && <span> — {qco.order_title}</span>}
          {citationIndex && onOpenSource && (
            <CitationPill sourceIndex={citationIndex} onClick={onOpenSource} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 my-2 text-xs text-[#64748B] italic">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>We couldn&apos;t confirm a Quality Control Order for this product in our sources.</span>
    </div>
  );
}
