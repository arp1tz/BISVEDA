"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PhoneCall } from "lucide-react";
import { LanguagePicker } from "./LanguagePicker";

interface AppHeaderProps {
  onOpenHelpline?: () => void;
  callLabel?: string;
}

export function AppHeader({ onOpenHelpline, callLabel }: AppHeaderProps) {
  const pathname = usePathname();

  const navLinks = [
    { label: "Standards", href: "/standards" },
    { label: "Labs", href: "/labs" },
    { label: "Certification", href: "/certification" },
  ];

  return (
    <header className="w-full max-w-full bg-white border-b border-[#E5E7EB] shrink-0 sticky top-0 z-30 select-none overflow-x-clip">
      <div className="max-w-6xl mx-auto h-14 px-3 sm:px-6 flex items-center justify-between gap-2">
        {/* Logo Wordmark */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <span className="text-[#E8710A] text-lg font-black transition-transform group-hover:scale-105">
            ◆
          </span>
          <span className="font-bold text-base tracking-tight text-[#0B2A4A]">
            BISVEDA
          </span>
        </Link>

        {/* 3 Plain Navigation Links (Desktop) + Helpline + Language Toggle */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm shrink-0">
          <nav className="hidden md:flex items-center gap-5 font-medium">
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

          <div className="hidden md:block h-4 w-px bg-[#E5E7EB]" />

          {/* Call Helpline Button */}
          {onOpenHelpline && (
            <button
              type="button"
              onClick={onOpenHelpline}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold text-[#0B2A4A] bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
              title="Talk with BISVEDA on Call"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#E8710A] shrink-0" />
              <span className="hidden min-[360px]:inline">{callLabel || "Talk on Call"}</span>
              <span className="min-[360px]:hidden">{callLabel ? (callLabel.includes("Talk") ? "Call" : callLabel) : "Call"}</span>
            </button>
          )}

          {/* Language Picker */}
          <div className="shrink-0">
            <LanguagePicker />
          </div>
        </div>
      </div>
    </header>
  );
}
