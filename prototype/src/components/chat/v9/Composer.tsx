"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { AttachMenu } from "./AttachMenu";
import { AttachmentPreview } from "./AttachmentPreview";
import { VoiceMicButton } from "./VoiceMicButton";
import type { VoiceInputState } from "@/lib/voice/useVoiceInput";
import { fileToAttachment, type AttachmentItem } from "@/lib/attachments";

export type { AttachmentItem };

interface ComposerProps {
  onSend: (message: string, attachment?: AttachmentItem | null) => void;
  isLoading?: boolean;
  placeholder?: string;
  /** Voice input is owned by the chat page (so it can run the hands-free loop). Omit to hide the mic. */
  voiceState?: VoiceInputState;
  onMicClick?: () => void;
}

export function Composer({
  onSend,
  isLoading = false,
  placeholder = "Ask a follow-up… e.g. which labs can test this?",
  voiceState = "idle",
  onMicClick,
}: ComposerProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<AttachmentItem | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleAttachFile = async (file: File) => {
    setAttachError(null);
    try {
      setAttachment(await fileToAttachment(file));
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Could not attach that file.");
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || isLoading) return;

    onSend(trimmed || (attachment ? `Analyze attached ${attachment.name}` : ""), attachment);
    setInput("");
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      {/* Attached file preview */}
      {attachment && <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />}
      {attachError && <p className="text-xs text-[#bd2f2f]">{attachError}</p>}

      {/* Main Composer Box */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-1.5 p-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm focus-within:border-[#0B2A4A] focus-within:ring-2 focus-within:ring-[#0B2A4A]/10 transition-all"
      >
        <AttachMenu onFile={handleAttachFile} disabled={isLoading} direction="up" className="mb-0.5" />

        {/* Microphone (speech-to-text via the chat page's voice hook) */}
        {onMicClick && <VoiceMicButton state={voiceState} onClick={onMicClick} disabled={isLoading} className="mb-0.5" />}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceState === "listening" ? "Listening… speak now" : voiceState === "transcribing" ? "Understanding what you said…" : placeholder
          }
          disabled={isLoading}
          className="flex-1 max-h-36 py-1.5 px-1 resize-none bg-transparent text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!input.trim() && !attachment) || isLoading}
          className="p-2 rounded-xl bg-[#0B2A4A] text-white hover:bg-[#0B2A4A]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
          aria-label="Send query"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
