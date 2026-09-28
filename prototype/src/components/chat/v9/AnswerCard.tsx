"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, Copy, ThumbsUp, ThumbsDown, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { BisvedaResponse } from "@/lib/pipeline/respond";
import { CitationPill } from "./CitationPill";
import { speak, stopSpeaking, languageLabel } from "@/lib/voice/tts";

interface AnswerCardProps {
  response: BisvedaResponse;
  query?: string;
  onOpenSourceDrawer?: (index: number) => void;
  onRequestLocation?: () => void;
  onSendQuery?: (q: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function AnswerCard({
  response,
  query = "",
  onOpenSourceDrawer,
  onRequestLocation,
  onSendQuery,
  userLocation,
}: AnswerCardProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const isSpeakingRef = useRef(false);

  const speakableText = response.text || response.refusal?.message || response.clarify?.question || "";

  // Keep the button in sync with the shared speech engine, and stop when this card goes away.
  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) stopSpeaking();
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(response.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeech = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }

    setVoiceNote(null);
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    const result = await speak(speakableText, response.language);
    // A newer speak() (another card) interrupts this one; its own card handles its own state.
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    if (!result.ok) {
      if (result.reason === "unsupported") setVoiceNote("Read aloud is not supported in this browser.");
      else if (result.reason === "no_voice")
        setVoiceNote(`No ${languageLabel(result.language)} voice is installed on this device, so this answer can't be read aloud. Install one in your system's speech settings.`);
      else setVoiceNote("Couldn't play the audio. Please try again.");
    }
  };

  // Renders "**bold**" spans within a plain-text segment.
  const renderInlineBold = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>
      )
    );
  };

  // Helper to parse citations like [S1], [S2] and **bold** in a line, rendering CitationPill/<strong>.
  const renderPointWithCitations = (point: string) => {
    const regex = /\[S(\d+)\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(point)) !== null) {
      if (match.index > lastIndex) {
        elements.push(...renderInlineBold(point.substring(lastIndex, match.index), `seg-${match.index}`));
      }
      const sourceIdx = parseInt(match[1], 10);
      elements.push(
        <CitationPill
          key={`${match.index}-${sourceIdx}`}
          sourceIndex={sourceIdx}
          onClick={(idx) => onOpenSourceDrawer?.(idx)}
        />
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < point.length) {
      elements.push(...renderInlineBold(point.substring(lastIndex), `seg-end`));
    }

    return elements;
  };

  const primaryStandard = response.standards?.find((s) => s.class === "applies") || response.standards?.[0];
  const imageCard = response.cards?.image;

  // Render the markdown-lite answer text: bullets grouped into a <ul>, [S#] citation pills.
  const renderAnswerText = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const blocks: React.ReactNode[] = [];
    let bulletBuf: string[] = [];
    const flushBullets = () => {
      if (bulletBuf.length === 0) return;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="space-y-2">
          {bulletBuf.map((content, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#0F172A] leading-relaxed">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0B2A4A] mt-2 shrink-0" />
              <div className="flex-1">{renderPointWithCitations(content)}</div>
            </li>
          ))}
        </ul>
      );
      bulletBuf = [];
    };

    for (const line of lines) {
      const isBullet = /^[-*]\s+/.test(line);
      if (isBullet) {
        bulletBuf.push(line.replace(/^[-*]\s+/, ""));
        continue;
      }
      flushBullets();
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm text-[#0F172A] leading-relaxed">
          {renderPointWithCitations(line)}
        </p>
      );
    }
    flushBullets();
    return blocks;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
      {/* Primary Standard Badge */}
      {primaryStandard && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0B2A4A]/5 border border-[#0B2A4A]/15 text-xs font-medium text-[#0B2A4A]">
            <span className="h-2 w-2 rounded-full bg-[#228f4a]" />
            <span className="font-mono font-bold">{primaryStandard.id}</span>
            <span className="text-[#64748B]">—</span>
            <span className="truncate max-w-[260px]">{primaryStandard.title}</span>
          </div>
        </div>
      )}

      {/* What we read on the label (honest verbatim OCR box) — image inputs only */}
      {imageCard && (imageCard.label_text || imageCard.product_guess) && (
        <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] space-y-1.5 text-xs">
          <div className="font-bold text-[#0B2A4A] flex items-center gap-1.5">
            <span>What we read from your photo</span>
          </div>
          {imageCard.label_text && (
            <div className="font-mono text-[11px] text-[#0F172A] bg-white p-2.5 rounded-lg border border-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
              {imageCard.label_text}
            </div>
          )}
        </div>
      )}

      {/* Answer text (markdown-lite: bullets, bold, [S#] citation pills) */}
      <div className="space-y-2">
        {response.text
          ? renderAnswerText(response.text)
          : response.refusal?.message
          ? renderAnswerText(response.refusal.message)
          : null}
      </div>

      {/* Grounding Status Indicator */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB]/60 text-xs">
        {response.grounding === "verified" ? (
          <div className="flex items-center gap-1.5 text-[#228f4a] font-medium">
            <span>✓ Every fact is from official BIS sources</span>
          </div>
        ) : response.grounding === "supported_inference" ? (
          <div className="flex items-center gap-1.5 text-[#B45309] font-medium">
            <span>Some details could not be confirmed in official sources</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#0B2A4A] font-medium">
            <span className="h-2 w-2 rounded-full bg-[#228f4a]" />
            <span>✓ BIS Assistant Guidance</span>
          </div>
        )}

        {/* Short Sources summary line */}
        {response.sources && response.sources.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
            <span>Sources:</span>
            {response.sources.map((src, i) => (
              <button
                key={src.label || i}
                onClick={() => onOpenSourceDrawer?.(i + 1)}
                className="hover:text-[#0B2A4A] underline font-mono cursor-pointer"
              >
                {src.label || `S${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Standards Badges (if present) */}
      {response.standards && response.standards.length > 0 && (
        <div className="pt-3 border-t border-[#E5E7EB] mt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mr-1">
              Standards:
            </span>
            {response.standards.map((std) => (
              <span
                key={std.id}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                  std.class === "applies"
                    ? "bg-[#0B2A4A] text-white"
                    : "bg-slate-100 text-slate-800 border border-slate-200"
                }`}
                title={std.title}
              >
                <span>{std.id}</span>
                {std.class === "applies" && (
                  <span className="text-[10px] text-emerald-300 font-normal">• Applies</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Sources List (Standard · Clause · Page) */}
      {response.sources && response.sources.length > 0 && (
        <div className="pt-2.5 border-t border-[#E5E7EB] mt-2.5">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
            Cited Evidence ({response.sources.length}):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {response.sources.map((src, i) => (
              <button
                key={src.label || i}
                onClick={() => onOpenSourceDrawer?.(i + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] hover:bg-[#E5E7EB] text-xs font-mono text-[#0F172A] transition-colors cursor-pointer"
                title={src.title || src.standard_id}
              >
                <span className="font-bold text-[#0B2A4A]">{src.label || `S${i + 1}`}</span>
                <span className="text-[#64748B] font-sans">
                  {src.standard_id} • Cl. {src.clause} (p.{src.page})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action / Overflow Menu */}
      <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] text-xs text-[#64748B]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#F7F8FA] hover:text-[#0F172A] transition-colors cursor-pointer"
            title="Copy answer to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#228f4a]" />
                <span className="text-[#228f4a]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              isSpeaking
                ? "bg-[#0B2A4A] text-white"
                : "hover:bg-[#F7F8FA] hover:text-[#0F172A]"
            }`}
            title={isSpeaking ? "Stop speech playback" : "Read answer aloud in natural language"}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="h-3.5 w-3.5 text-[#E8710A]" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>Read aloud</span>
              </>
            )}
          </button>

          {onSendQuery && (
            <button
              type="button"
              onClick={() => onSendQuery("Explain this simply in everyday language without technical jargon.")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#F7F8FA] hover:text-[#0F172A] transition-colors cursor-pointer"
              title="Explain in simpler terms"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#E8710A]" />
              <span>Explain simply</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              feedback === "up"
                ? "bg-[#228f4a]/10 text-[#228f4a]"
                : "hover:bg-[#F7F8FA] hover:text-[#0F172A]"
            }`}
            title="Helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              feedback === "down"
                ? "bg-[#bd2f2f]/10 text-[#bd2f2f]"
                : "hover:bg-[#F7F8FA] hover:text-[#0F172A]"
            }`}
            title="Not helpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {voiceNote && <p className="text-[11px] text-[#B45309]">{voiceNote}</p>}
    </div>
  );
}
