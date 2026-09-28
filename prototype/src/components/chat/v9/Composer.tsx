"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2, Mic, MicOff } from "lucide-react";
import { AttachMenu } from "./AttachMenu";
import { AttachmentPreview } from "./AttachmentPreview";
import { fileToAttachment, type AttachmentItem } from "@/lib/attachments";

export type { AttachmentItem };

interface ComposerProps {
  onSend: (message: string, attachment?: AttachmentItem | null) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function Composer({
  onSend,
  isLoading = false,
  placeholder = "Ask a follow-up… e.g. which labs can test this?",
}: ComposerProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<AttachmentItem | null>(null);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleAttachFile = async (file: File) => {
    setAttachError(null);
    try {
      setAttachment(await fileToAttachment(file));
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Could not attach that file.");
    }
  };

  const handleToggleVoice = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported by your browser. Please try Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
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

        {/* Microphone Voice Input Button */}
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`p-2 rounded-xl transition-all shrink-0 cursor-pointer ${
            isListening
              ? "bg-[#E8710A] text-white animate-pulse"
              : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7F8FA]"
          }`}
          title={isListening ? "Listening... click to stop" : "Speak query using microphone"}
          aria-label="Voice input"
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening to your voice..." : placeholder}
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
