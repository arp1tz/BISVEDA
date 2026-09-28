"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Minus, Plus, RotateCcw } from "lucide-react";

const STORAGE_KEY = "bisveda.textScale";
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.3;
const STEP = 0.1;
const DEFAULT_SCALE = 1;

function applyScale(scale: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--bisveda-text-scale", String(scale));
}

/**
 * UX4G handbook (Design System > Accessibility Bar, p.173): a thin strip offering quick
 * access to accessibility options, here a "skip to content" link and a text-size control.
 * No flag or government emblem is shown, this is a student prototype, not an official portal.
 */
export function AccessibilityBar() {
  const pathname = usePathname();
  const [scale, setScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? parseFloat(stored) : DEFAULT_SCALE;
      if (!Number.isNaN(parsed)) {
        setScale(parsed);
        applyScale(parsed);
      }
    } catch {
      // localStorage unavailable (private browsing) — default scale still applies via CSS.
    }
  }, []);

  const setAndPersist = (next: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 100) / 100));
    setScale(clamped);
    applyScale(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Non-fatal: the size still applies for this page view.
    }
  };

  // Hidden on the internal admin console: it has its own dense operator layout.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="w-full bg-[#0B2A4A] text-white text-[11px] select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-3">
        <a
          href="#main-content"
          className="rounded px-2 py-0.5 -ml-2 focus:not-sr-only focus:relative focus:bg-white focus:text-[#0B2A4A] sr-only"
        >
          Skip to main content
        </a>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1" role="group" aria-label="Adjust text size">
            <span className="text-white/70 mr-0.5 hidden sm:inline">Text size</span>
            <button
              type="button"
              onClick={() => setAndPersist(scale - STEP)}
              disabled={scale <= MIN_SCALE}
              className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Decrease text size"
              title="Decrease text size"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setAndPersist(DEFAULT_SCALE)}
              className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/15 cursor-pointer"
              aria-label="Reset text size"
              title="Reset text size"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => setAndPersist(scale + STEP)}
              disabled={scale >= MAX_SCALE}
              className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Increase text size"
              title="Increase text size"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
