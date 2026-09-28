"use client";

/**
 * BISVEDA — Language picker (components/chat/v9/LanguagePicker.tsx, P12.4)
 *
 * Replaces the old EN/हिंदी toggle, which only swapped its own label and did nothing to the
 * page. This opens a searchable dropdown of English + the 22 scheduled languages; picking one
 * sets the shared UI language (LanguageContext), which PageTranslator then applies to the page.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Search, Check, Loader2 } from "lucide-react";
import { UI_LANGUAGES, findLanguage } from "@/lib/ui-i18n/languages";
import { useUiLanguage } from "@/lib/ui-i18n/LanguageContext";
import { isTranslatingNow, onTranslatingChange } from "@/lib/ui-i18n/translatingStatus";

export function LanguagePicker() {
  const { lang, setLang } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [translating, setTranslating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = findLanguage(lang);

  // Reflects PageTranslator's live progress, so switching language never looks stuck while a
  // batch is still being fetched in the background.
  useEffect(() => {
    setTranslating(isTranslatingNow());
    return onTranslatingChange(setTranslating);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UI_LANGUAGES;
    return UI_LANGUAGES.filter((l) => l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: string) => {
    setLang(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative" translate="no">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={translating}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-[#0B2A4A] bg-[#F7F8FA] hover:bg-[#E5E7EB] transition-colors cursor-pointer border border-[#E5E7EB]"
        title={translating ? "Translating the page..." : "Choose interface language"}
      >
        {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E8710A]" /> : <Languages className="h-3.5 w-3.5" />}
        <span>{translating ? "Translating..." : current.native}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-64 max-h-80 flex flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-lg z-40 overflow-hidden"
        >
          <div className="p-2 border-b border-[#E5E7EB] flex items-center gap-1.5 shrink-0">
            <Search className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language..."
              className="flex-1 min-w-0 text-xs bg-transparent focus:outline-hidden text-[#0F172A] placeholder-[#64748B]"
            />
          </div>
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-[#64748B]">No language matches "{query}".</p>}
            {filtered.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={l.code === lang}
                onClick={() => choose(l.code)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[#F7F8FA] cursor-pointer ${
                  l.code === lang ? "bg-[#F7F8FA]" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[#0F172A]">{l.native}</span>
                  <span className="block text-[10px] text-[#64748B]">{l.name}</span>
                </span>
                {l.code === lang && <Check className="h-3.5 w-3.5 text-[#228f4a] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
