"use client";

import React from "react";
import { X, FileText } from "lucide-react";
import type { AttachmentItem } from "@/lib/attachments";

interface AttachmentPreviewProps {
  attachment: AttachmentItem;
  onRemove: () => void;
  className?: string;
}

/** Small thumbnail chip shown above the message box for a picked photo or document. */
export function AttachmentPreview({ attachment, onRemove, className = "" }: AttachmentPreviewProps) {
  return (
    <div
      className={`flex items-center gap-2 p-1.5 pr-2 bg-white rounded-xl border border-[#E5E7EB] w-fit max-w-full shadow-2xs animate-in fade-in duration-150 ${className}`}
    >
      {attachment.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="h-12 w-12 object-cover rounded-lg border border-[#E5E7EB]"
        />
      ) : (
        <div className="h-12 w-12 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] flex items-center justify-center">
          <FileText className="h-5 w-5 text-[#0B2A4A]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#0F172A] truncate max-w-[200px]">{attachment.name}</p>
        <span className="text-[10px] text-[#228f4a]">Ready to send</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7F8FA] cursor-pointer"
        title="Remove attachment"
        aria-label="Remove attachment"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
