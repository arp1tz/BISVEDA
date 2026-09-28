"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PhoneCall } from "lucide-react";

interface AppHeaderProps {
  onLanguageToggle?: (lang: "en" | "hi") => void;
  currentLang?: "en" | "hi";
  onOpenHelpline?: () => void;
}

export function AppHeader({ onLanguageToggle, currentLang = "en", onOpenHelpline }: AppHeaderProps) {
  const pathname = usePathname();
  const [lang, setLang] = useState<"en" | "hi">(currentLang);

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    onLanguageToggle?.(next);
  };

  const navLinks = [
    { label: "Standards", href: "/standards" },
    { label: "Labs", href: "/labs" },
    { label: "Certification", href: "/certification" },
  ];

  return (
    <header className="w-full bg-white border-b border-[#E5E7EB] shrink-0 sticky top-0 z-30 select-none">
      <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between">
        {/* Logo Wordmark */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-[#E8710A] text-lg font-black transition-transform group-hover:scale-105">
            ◆
          </span>
          <span className="font-bold text-base tracking-tight text-[#0B2A4A]">
            BISVEDA
          </span>
        </Link>

        {/* 3 Plain Navigation Links + Language Toggle */}
        <div className="flex items-center gap-6 text-xs sm:text-sm">
          <nav className="flex items-center gap-5 font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors py-1 ${
                    isActive
                      ? "text-[#0B2A4A] font-semibold border-b-2 border-[#0B2A4A]"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="h-4 w-px bg-[#E5E7EB]" />

          {/* Call Helpline Button */}
          {onOpenHelpline && (
            <button
              type="button"
              onClick={onOpenHelpline}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#0B2A4A] bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors shadow-2xs cursor-pointer"
              title="Talk with BISVEDA on Call"
            >
              <PhoneCall className="h-3 w-3 text-[#E8710A]" />
              <span className="hidden sm:inline">Call Helpline</span>
              <span className="sm:hidden">Call</span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#0B2A4A] bg-[#F7F8FA] hover:bg-[#E5E7EB] transition-colors cursor-pointer border border-[#E5E7EB]"
            title="Switch Language"
          >
            {lang === "en" ? "हिंदी" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
