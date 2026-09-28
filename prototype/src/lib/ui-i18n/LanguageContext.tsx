"use client";

/**
 * BISVEDA — UI language context (lib/ui-i18n/LanguageContext.tsx, P12.4)
 *
 * Holds the chosen interface language (a code from languages.ts) in React context and
 * localStorage, and sets it as `<html lang>`. `PageTranslator` (components/a11y) reads this and
 * does the actual page translation; this file only owns the *choice*.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "bisveda.uiLang";

interface LanguageContextValue {
  lang: string;
  setLang: (code: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setLangState(stored);
    } catch {
      // localStorage unavailable: stay on English for this view.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Non-fatal: the choice just won't persist across reloads.
    }
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
