"use client";

import React from "react";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="w-full bg-[#F7F8FA] border-t border-[#E5E7EB] py-3.5 px-4 text-xs text-[#64748B] shrink-0 select-none">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <span>Prototype for Smart India Hackathon 2026 · PS 26107</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/about" className="hover:text-[#0F172A] hover:underline transition-colors">
            About
          </Link>
          <span>·</span>
          <Link
            href="/admin/knowledge"
            className="hover:text-[#0F172A] hover:underline transition-colors font-medium text-[#0B2A4A]"
          >
            Staff login
          </Link>
        </div>
      </div>
    </footer>
  );
}
