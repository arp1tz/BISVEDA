"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, PhoneCall } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-raised text-xs text-ink-soft">
      {/* Main Government of India & BIS Footer Section */}
      <div className="border-b border-border/70 bg-surface-alt/30 px-4 py-10">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Col 1: Government of India & Ministry Emblem */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <img
                src="/department_consumer_affairs.png"
                alt="Department of Consumer Affairs"
                className="h-10 sm:h-12 w-auto object-contain bg-white/80 p-1 rounded-lg border border-border/60"
              />
              <img
                src="/bis_logo_official.png"
                alt="Bureau of Indian Standards"
                className="h-10 sm:h-12 w-auto object-contain bg-white/80 p-1 rounded-lg border border-border/60"
              />
            </div>
            <div className="space-y-0.5 pt-1">
              <p className="text-xs font-bold text-navy">
                उपभोक्ता मामले, खाद्य एवं सार्वजनिक वितरण मंत्रालय
              </p>
              <p className="text-[11px] font-extrabold uppercase tracking-tight text-navy">
                Ministry of Consumer Affairs, Food &amp; Public Distribution
              </p>
              <p className="text-[10px] font-semibold text-ink-faint">
                Government of India • Bureau of Indian Standards
              </p>
            </div>
            <p className="text-[11px] text-ink-soft leading-relaxed pt-1">
              Bureau of Indian Standards (BIS) is the National Standards Body of India established under the BIS Act 2016 for the harmonious development of standardisation, marking and quality certification.
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-orange pt-1">
              <PhoneCall className="h-3.5 w-3.5" />
              <span>National Consumer Helpline: 14434 / 1915</span>
            </div>
          </div>

          {/* Col 2: Know About BIS */}
          <div className="md:col-span-2 space-y-2">
            <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
              Know About BIS
            </h4>
            <ul className="space-y-1.5 text-[11px] text-ink-soft">
              <li>
                <Link href="/about" className="hover:text-navy hover:underline">
                  About BIS Overview
                </Link>
              </li>
              <li>
                <a href="https://www.bis.gov.in" target="_blank" rel="noreferrer" className="hover:text-navy hover:underline">
                  Official Portal
                </a>
              </li>
              <li>
                <Link href="/standards" className="hover:text-navy hover:underline">
                  Standards Catalogue
                </Link>
              </li>
              <li>
                <Link href="/quality" className="hover:text-navy hover:underline">
                  Quality Benchmarks
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Standards & Testing */}
          <div className="md:col-span-2 space-y-2">
            <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
              Certification &amp; Labs
            </h4>
            <ul className="space-y-1.5 text-[11px] text-ink-soft">
              <li>
                <Link href="/certification" className="hover:text-navy hover:underline">
                  Scheme-I (ISI Mark)
                </Link>
              </li>
              <li>
                <Link href="/certification" className="hover:text-navy hover:underline">
                  Scheme-II (CRS)
                </Link>
              </li>
              <li>
                <Link href="/testing" className="hover:text-navy hover:underline">
                  Recognized Laboratories
                </Link>
              </li>
              <li>
                <Link href="/consumer" className="hover:text-navy hover:underline">
                  Verify ISI / CM-L Mark
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Help & Support */}
          <div className="md:col-span-2 space-y-2">
            <h4 className="font-extrabold text-navy text-xs uppercase tracking-wider">
              Help &amp; Portals
            </h4>
            <ul className="space-y-1.5 text-[11px] text-ink-soft">
              <li>
                <a href="https://www.manakonline.in" target="_blank" rel="noreferrer" className="hover:text-navy hover:underline inline-flex items-center gap-1">
                  Manak Online <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
              <li>
                <a href="https://www.services.bis.gov.in" target="_blank" rel="noreferrer" className="hover:text-navy hover:underline inline-flex items-center gap-1">
                  e-BIS Services <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
              <li>
                <a href="https://egazette.gov.in" target="_blank" rel="noreferrer" className="hover:text-navy hover:underline inline-flex items-center gap-1">
                  The Gazette of India <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
              <li>
                <Link href="/contact" className="hover:text-navy hover:underline">
                  Contact &amp; Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Connect with BIS Box (Matching Reference Screenshot) */}
          <div className="md:col-span-2 rounded-2xl border border-navy/20 bg-navy p-4 text-white space-y-3 shadow-xs">
            <h5 className="text-[11px] font-black uppercase tracking-wider text-orange">
              Connect With BIS
            </h5>
            <p className="text-[10px] text-white/80 leading-snug">
              Official updates from the Bureau of Indian Standards on gazettes, amendments, and public safety alerts.
            </p>
            <div className="flex items-center gap-2 pt-1 text-white/90">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-orange hover:text-white transition-colors cursor-pointer text-xs font-bold">
                in
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-orange hover:text-white transition-colors cursor-pointer text-xs font-bold">
                𝕏
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-orange hover:text-white transition-colors cursor-pointer text-xs font-bold">
                ▶
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-orange hover:text-white transition-colors cursor-pointer text-xs font-bold">
                📷
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Bottom Legal Bar */}
      <div className="bg-navy-deep px-4 py-3 text-[11px] text-white/80">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Bureau of Indian Standards (BIS). All Rights Reserved.</p>
          <div className="flex items-center gap-4 text-white/70">
            <span className="hover:text-white cursor-pointer">Privacy Policy</span>
            <span>|</span>
            <span className="hover:text-white cursor-pointer">Terms of Use</span>
            <span>|</span>
            <span className="hover:text-white cursor-pointer">Accessibility Statement</span>
            <span>|</span>
            <Link href="/admin/knowledge" className="hover:text-white transition-colors underline font-medium">
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
