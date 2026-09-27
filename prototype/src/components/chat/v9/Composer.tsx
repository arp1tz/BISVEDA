"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, Loader2, Mic, MicOff, X, Image as ImageIcon } from "lucide-react";

export interface AttachmentItem {
  name: string;
  previewUrl?: string;
  base64?: string;
  type?: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
      setAttachment({
        name: file.name,
        previewUrl: dataUrl,
        base64,
        type: file.type,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
      {/* Attached Image Thumbnail Preview */}
      {attachment && (
        <div className="flex items-center gap-2 p-1.5 px-3 bg-white rounded-xl border border-[#E5E7EB] w-fit max-w-full shadow-2xs animate-in fade-in duration-150">
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="h-10 w-10 object-cover rounded-lg border border-[#E5E7EB]"
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-[#0B2A4A]" />
          )}
          <div className="min-w-0 pr-1">
            <p className="text-xs font-medium text-[#0F172A] truncate max-w-[200px]">{attachment.name}</p>
            <span className="text-[10px] text-[#228f4a]">Ready to send</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7F8FA] cursor-pointer"
            title="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Composer Box */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-1.5 p-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm focus-within:border-[#0B2A4A] focus-within:ring-2 focus-within:ring-[#0B2A4A]/10 transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Paperclip Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7F8FA] rounded-xl transition-colors shrink-0 cursor-pointer"
          title="Attach product photo or document"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>

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
