"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { BisvedaResponse } from "@/lib/pipeline/respond";
import { QcoLine } from "./QcoLine";
import { CitationPill } from "./CitationPill";
import { DetailTabs } from "./DetailTabs";

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

  // Stop speaking when unmounted
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Check if standard or query refers to a superseded edition
  const isSuperseded =
    query.includes("14543:2004") ||
    query.includes("4151:1993") ||
    query.includes("2347:2006") ||
    query.includes("1293:2005") ||
    query.includes("9873:2012") ||
    response.primary_standard?.id === "IS 14543:2004" ||
    (response.answer?.headline && response.answer.headline.toLowerCase().includes("superseded"));

  const supersededTarget =
    query.includes("14543") || response.primary_standard?.id?.includes("14543")
      ? "IS 14543:2024"
      : query.includes("4151")
      ? "IS 4151:2020"
      : query.includes("2347")
      ? "IS 2347:2017"
      : "current edition";

  const handleCopy = () => {
    const textParts: string[] = [];
    if (response.answer?.headline) textParts.push(response.answer.headline);
    if (response.answer?.points) textParts.push(...response.answer.points);
    if (response.answer?.next_steps) {
      textParts.push("\nNext steps:");
      response.answer.next_steps.forEach((s, i) => textParts.push(`${i + 1}. ${s}`));
    }
    navigator.clipboard.writeText(textParts.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const parts: string[] = [];
    if (response.answer?.headline) parts.push(response.answer.headline);
    if (response.answer?.points) parts.push(...response.answer.points);
    if (response.answer?.next_steps) {
      parts.push("What to do next: " + response.answer.next_steps.join(". "));
    }

    // Strip bracketed citations like [S1], [S2] before reading
    const textToRead = parts.join(". ").replace(/\[S\d+\]/g, "");
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = response.language === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // Helper to parse citations like [S1], [S2] in points and render CitationPill
  const renderPointWithCitations = (point: string) => {
    const regex = /\[S(\d+)\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(point)) !== null) {
      if (match.index > lastIndex) {
        elements.push(point.substring(lastIndex, match.index));
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
      elements.push(point.substring(lastIndex));
    }

    return elements;
  };

  const hasPoints = response.answer?.points && response.answer.points.length > 0;
  const hasNextSteps = response.answer?.next_steps && response.answer.next_steps.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
      {/* Primary Standard Badge & Superseded Warning Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {response.primary_standard && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0B2A4A]/5 border border-[#0B2A4A]/15 text-xs font-medium text-[#0B2A4A]">
            <span className="h-2 w-2 rounded-full bg-[#228f4a]" />
            <span className="font-mono font-bold">{response.primary_standard.id}</span>
            <span className="text-[#64748B]">—</span>
            <span className="truncate max-w-[260px]">{response.primary_standard.title}</span>
          </div>
        )}

        {isSuperseded && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B45309]/10 border border-[#B45309]/20 text-[#B45309] text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Superseded by {supersededTarget}</span>
          </div>
        )}
      </div>

      {/* Answer Headline */}
      {response.answer?.headline && (
        <h3 className="text-base md:text-lg font-bold text-[#0F172A] leading-snug">
          {response.answer.headline}
        </h3>
      )}

      {/* QCO Line */}
      <QcoLine
        qco={response.qco}
        onOpenSource={onOpenSourceDrawer}
        citationIndex={response.sources?.length ? 1 : undefined}
      />

      {/* What we read on the label (honest verbatim OCR box) */}
      {response.visual_evidence &&
        (response.visual_evidence.label_text || response.visual_evidence.licence_number) && (
          <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] space-y-1.5 text-xs">
            <div className="font-bold text-[#0B2A4A] flex items-center gap-1.5">
              <span>What we read on the label</span>
            </div>
            {response.visual_evidence.label_text && (
              <div className="font-mono text-[11px] text-[#0F172A] bg-white p-2.5 rounded-lg border border-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                {response.visual_evidence.label_text}
              </div>
            )}
            {response.visual_evidence.licence_number && (
              <div className="text-[11px] text-[#64748B] pt-0.5">
                Licence number read:{" "}
                <strong className="text-[#0B2A4A]">{response.visual_evidence.licence_number}</strong>. Check
                it on the official BIS Care app or Manak Online portal.
              </div>
            )}
          </div>
        )}

      {/* Bulleted Points (Max 4) */}
      {hasPoints && (
        <ul className="space-y-2 text-sm text-[#0F172A] leading-relaxed">
          {response.answer!.points.slice(0, 4).map((pt, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0B2A4A] mt-2 shrink-0" />
              <div className="flex-1">{renderPointWithCitations(pt)}</div>
            </li>
          ))}
        </ul>
      )}

      {/* Next Steps in soft callout box */}
      {hasNextSteps && (
        <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            What to do next
          </div>
          <ol className="space-y-1.5 text-xs text-[#0F172A] leading-relaxed">
            {response.answer!.next_steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-[#0B2A4A] shrink-0">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Grounding Status Indicator */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB]/60 text-xs">
        {response.grounding === "verified" ? (
          <div className="flex items-center gap-1.5 text-[#228f4a] font-medium">
            <span>✓ Every fact is from official BIS sources</span>
          </div>
        ) : response.grounding === "partial" ? (
          <div className="flex items-center gap-1.5 text-[#B45309] font-medium">
            <span>Some details could not be confirmed in official sources</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <span>General enquiry response</span>
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

      {/* Inline Detail Tabs (Standards, Certification, Labs, Sources) */}
      <DetailTabs
        standards={response.standards}
        certification={response.certification}
        labs={response.labs}
        sources={response.sources}
        onOpenSourceDrawer={onOpenSourceDrawer}
        onRequestLocation={onRequestLocation}
        userLocation={userLocation}
      />

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
    </div>
  );
}
