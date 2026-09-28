"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Paperclip, BookOpen, ShieldCheck, FlaskConical, Sparkles, PhoneCall } from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";
import { HelplineModal } from "@/components/chat/v9/HelplineModal";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isHelplineOpen, setIsHelplineOpen] = useState(false);

  const productPills = [
    { label: "Helmets", query: "Which Indian Standard applies to motorcycle helmets and is it mandatory under QCO?" },
    { label: "Toys", query: "What safety testing and mechanical requirements apply to toys under IS 9873?" },
    { label: "Gold Jewellery & Hallmarking", query: "What are the hallmarking requirements and pure gold grades under IS 1417?" },
    { label: "Form I", query: "How do I register my jewellery retail outlet for hallmarking using Form I?" },
  ];

  const actionCards = [
    {
      icon: BookOpen,
      title: "Find standard & QCO",
      desc: "Discover mandatory Indian Standards and gazetted Quality Control Orders",
      query: "Which Indian Standard applies to protective helmets and toys?",
    },
    {
      icon: FlaskConical,
      title: "Find testing labs & AHCs",
      desc: "Locate BIS-recognised testing laboratories and hallmarking centres",
      query: "Which BIS-recognized laboratories can test IS 4151 helmets?",
    },
    {
      icon: ShieldCheck,
      title: "Verify marks & Form I",
      desc: "Check ISI / HUID mark formats or draft Form I jeweller registration",
      query: "I want to apply for BIS hallmarking registration for my jewellery shop",
    },
  ];

  const handleSearch = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q && !attachedFile) return;
    const conversationId = `conv-${Date.now()}`;

    if (attachedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            `pending_attachment_${conversationId}`,
            JSON.stringify({
              name: attachedFile.name,
              previewUrl: dataUrl,
              base64,
              type: attachedFile.type,
            })
          );
        }
        router.push(`/chat/${conversationId}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      };
      reader.readAsDataURL(attachedFile);
      return;
    }

    router.push(`/chat/${conversationId}?q=${encodeURIComponent(q)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleTryExample = () => {
    const example = productPills[0];
    setQuery(example.query);
    handleSearch(example.query);
  };

  return (
    <div className="flex flex-col min-h-screen sm:h-screen w-screen overflow-x-hidden bg-white text-[#0F172A] font-sans justify-between">
      {/* Shared Minimal Header */}
      <AppHeader onOpenHelpline={() => setIsHelplineOpen(true)} />

      {/* Center 1-Screen Landing View */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
        {/* Hero Headings */}
        <div className="text-center space-y-2.5 mb-5">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B2A4A] tracking-tight leading-tight">
            Find the right BIS standard, certification and lab.
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-xl mx-auto leading-relaxed">
            Ask in any Indian language. Every answer shows its official source.
          </p>
        </div>

        {/* Helpline Voice Call Pill */}
        <div className="mb-5 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsHelplineOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100/90 border border-amber-200 text-xs font-bold text-[#0B2A4A] shadow-2xs transition-all hover:scale-105 cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5 text-[#E8710A] animate-pulse" />
            <span>📞 Call Helpline — Speak with BISVEDA on Call</span>
          </button>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl relative mb-4">
          <div className="flex items-center w-full bg-[#F7F8FA] border border-[#E5E7EB] focus-within:border-[#0B2A4A] focus-within:ring-2 focus-within:ring-[#0B2A4A]/10 rounded-xl px-3.5 py-2.5 shadow-xs transition-all">
            <Search className="h-5 w-5 text-[#64748B] shrink-0 mr-2.5" />
            <input
              type="text"
              id="landing-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about a product, standard or certification…"
              className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder-[#64748B] focus:outline-hidden"
              autoFocus
            />

            {/* Hidden file input for attachment */}
            <input
              type="file"
              id="file-attachment-input"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) setAttachedFile(e.target.files[0]);
              }}
            />

            <label
              htmlFor="file-attachment-input"
              className={`p-1.5 rounded-lg text-[#64748B] hover:text-[#0B2A4A] hover:bg-[#E5E7EB] cursor-pointer transition-colors mr-1.5 ${
                attachedFile ? "text-[#E8710A] bg-[#FFF7ED]" : ""
              }`}
              title={attachedFile ? attachedFile.name : "Attach photo or document"}
            >
              <Paperclip className="h-4 w-4" />
            </label>

            <button
              type="submit"
              disabled={!query.trim() && !attachedFile}
              className="p-2 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Submit Query"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {attachedFile && (
            <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1.5">
              <span>Attached: {attachedFile.name}</span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-red-500 hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </form>

        {/* Product Pills + Try an example */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-2xl">
          {productPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => {
                setQuery(pill.query);
                handleSearch(pill.query);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F7F8FA] border border-[#E5E7EB] text-[#0F172A] hover:border-[#0B2A4A] hover:bg-white hover:text-[#0B2A4A] transition-all cursor-pointer"
            >
              {pill.label}
            </button>
          ))}
          <button
            onClick={handleTryExample}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#E8710A] bg-[#FFF7ED] border border-[#FDBA74]/50 hover:bg-[#FFEDD5] transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            <span>Try an example</span>
          </button>
        </div>

        {/* 3 Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-2xl">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => {
                  setQuery(card.query);
                  handleSearch(card.query);
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#0B2A4A] hover:shadow-xs transition-all text-left cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-[#F7F8FA] text-[#0B2A4A] group-hover:bg-[#0B2A4A] group-hover:text-white transition-colors mb-2.5">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-[#0F172A] mb-1 group-hover:text-[#0B2A4A]">
                  {card.title}
                </h3>
                <p className="text-[11px] text-[#64748B] leading-snug line-clamp-2">
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* What I know coverage banner */}
        <div className="mt-8 pt-5 border-t border-[#E5E7EB] text-center max-w-2xl w-full">
          <div className="text-[11px] font-bold text-[#0B2A4A] uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#228f4a]" />
            <span>Coverage · 8 Indian Standards</span>
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">
            <strong className="text-[#0F172A]">Helmets:</strong> IS 4151, IS 2925 ·{" "}
            <strong className="text-[#0F172A]">Toys:</strong> IS 9873 (Part 1 &amp; 3), IS 15644 ·{" "}
            <strong className="text-[#0F172A]">Hallmarking:</strong> IS 1417, IS 1418, IS 15820
          </p>
        </div>
      </main>

      {/* Shared Minimal Footer */}
      <AppFooter />

      {/* Voice Call Helpline Modal */}
      <HelplineModal isOpen={isHelplineOpen} onClose={() => setIsHelplineOpen(false)} />
    </div>
  );
}
