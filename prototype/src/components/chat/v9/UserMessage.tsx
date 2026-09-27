"use client";

import React from "react";
import { FileText } from "lucide-react";

interface UserMessageProps {
  content?: string;
  text?: string;
  imageThumbnail?: string;
  filename?: string;
}

export function UserMessage({ content, text, imageThumbnail, filename }: UserMessageProps) {
  const displayContent = content || text || "";
  return (
    <div className="flex justify-end w-full my-3">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-[#F7F8FA] border border-[#E5E7EB] p-3.5 text-sm text-[#0F172A] shadow-2xs space-y-2">
        {imageThumbnail && (
          <div className="rounded-lg overflow-hidden border border-[#E5E7EB] max-w-[200px]">
            <img src={imageThumbnail} alt="Attached query context" className="w-full h-auto object-cover" />
          </div>
        )}

        {filename && !imageThumbnail && (
          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-white border border-[#E5E7EB] rounded-md px-2 py-1">
            <FileText className="h-3.5 w-3.5 text-[#0B2A4A]" />
            <span className="truncate">{filename}</span>
          </div>
        )}

        <p className="whitespace-pre-wrap leading-relaxed">{displayContent}</p>
      </div>
    </div>
  );
}
