"use client";

import React from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import type { VoiceInputState } from "@/lib/voice/useVoiceInput";

interface VoiceMicButtonProps {
  state: VoiceInputState;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

/** Mic button: idle → tap to speak; listening → tap to finish; transcribing → spinner. */
export function VoiceMicButton({ state, onClick, disabled = false, className = "" }: VoiceMicButtonProps) {
  const listening = state === "listening";
  const busy = state === "transcribing";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={listening ? "Stop listening" : busy ? "Processing your voice" : "Speak your question"}
      title={listening ? "Listening… tap to finish" : busy ? "Understanding what you said…" : "Speak in any Indian language"}
      className={`relative h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
        listening
          ? "bg-[#E8710A] text-white"
          : "border border-[#E5E7EB] bg-white text-[#0B2A4A] hover:bg-[#F7F8FA] disabled:opacity-50"
      } ${className}`}
    >
      {listening && <span className="absolute inset-0 rounded-lg bg-[#E8710A]/40 animate-ping" aria-hidden />}
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : listening ? <Square className="relative h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
