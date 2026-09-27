"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  BookOpen,
  MapPin,
  CheckCircle2,
  Moon,
  Sun,
  Globe,
  Layers,
  User,
  LogOut,
  Scale,
  FileCheck2,
  BarChart3,
  ChevronDown,
  Info,
  Phone,
  Search,
  Sparkles,
  ExternalLink,
  ArrowRight,
  FlaskConical,
  FileText,
  Building2,
  HelpCircle,
  Award,
  Zap,
  Bookmark,
} from "lucide-react";
import type { UserProfile } from "@/components/auth/LoginModal";

interface NavbarProps {
  activeTab?: "workspace" | "wizard" | "labs" | "verify" | "employee" | string;
  onTabChange?: (tab: "workspace" | "wizard" | "labs" | "verify" | "employee" | "knowledge") => void;
  lang?: "en" | "hi";
  onLangToggle?: () => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
  user?: UserProfile | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  savedChatsCount?: number;
  onOpenSavedChats?: () => void;
}

type MenuKey = "standards" | "certification" | "testing" | "resources" | "eservices" | "about" | null;

export function Navbar({
  activeTab = "workspace",
  onTabChange,
  lang = "en",
  onLangToggle,
  darkMode = false,
  onThemeToggle,
  user = null,
  onOpenLogin,
  onLogout,
  savedChatsCount = 0,
  onOpenSavedChats,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (menu: MenuKey) => {
    if (menuTimeout) clearTimeout(menuTimeout);
    setActiveMenu(menu);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 200);
    setMenuTimeout(timeout);
  };

  const closeMenu = () => {
    if (menuTimeout) clearTimeout(menuTimeout);
    setActiveMenu(null);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface-raised/95 backdrop-blur-md">
      {/* Top Government Strip */}
      <div className="border-b border-border/50 bg-navy-deep px-4 py-1.5 text-xs text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/emblem_india_white.png" alt="Emblem of India" className="h-5 w-auto object-contain" />
            <span className="font-semibold tracking-wide text-white/95">
              Government of India
            </span>
            <span className="text-white/40">|</span>
            <span className="text-white/90 hidden sm:inline">
              Ministry of Consumer Affairs, Food &amp; Public Distribution
            </span>
            <span className="text-white/40 hidden md:inline">|</span>
            <span className="text-white/70 hidden md:inline text-[11px]">
              भारत के मानक, गुणवत्ता के प्रतीक
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-white/80">
            <span className="hidden md:inline hover:underline cursor-pointer">
              Skip to main content
            </span>
            <span className="hidden md:inline text-white/40">|</span>
            <span className="hidden md:inline hover:underline cursor-pointer">
              Screen Reader Access
            </span>
            <span className="hidden md:inline text-white/40">|</span>
            <button
              onClick={onLangToggle}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Globe className="h-3 w-3" />
              <span>{lang === "hi" ? "English" : "हिंदी"}</span>
            </button>
            <button
              onClick={onThemeToggle}
              className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main App Navigation */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 gap-4">
        {/* Left: Official Government & BIS Brand */}
        <div className="flex items-center shrink-0">
          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center gap-2 text-left focus:outline-none group shrink-0"
          >
            {/* Department of Consumer Affairs Emblem & Text */}
            <img
              src="/department_consumer_affairs.png"
              alt="Department of Consumer Affairs"
              className="h-7 sm:h-8 w-auto max-w-[110px] object-contain hidden md:block"
            />
            <div className="h-6 w-px bg-border hidden md:block" />

            {/* Official Bureau of Indian Standards Logo */}
            <img
              src="/bis_logo_official.png"
              alt="Bureau of Indian Standards"
              className="h-7 sm:h-8 w-auto max-w-[125px] object-contain"
            />
            <div className="h-6 w-px bg-border pl-0.5" />

            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-sm sm:text-base font-black tracking-tight text-navy">
                BISVEDA
              </span>
              <span className="rounded bg-orange/15 px-1 py-0.2 text-[8px] font-black uppercase text-orange">
                AI
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Feature Navigation Links with Full Mega-Menus */}
        <nav className="hidden xl:flex items-center gap-0.5 rounded-xl border border-border bg-surface-alt/70 p-1 shrink-0">
          {/* Standards Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("standards")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "standards" ? null : "standards")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                pathname.startsWith("/standards") || pathname === "/compare" || activeMenu === "standards"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-blue" />
              <span>{lang === "hi" ? "मानक" : "Standards"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* Certification Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("certification")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "certification" ? null : "certification")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                pathname === "/certification" || activeMenu === "certification"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-orange" />
              <span>{lang === "hi" ? "प्रमाणीकरण" : "Certification"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* Testing Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("testing")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "testing" ? null : "testing")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                pathname === "/testing" || activeMenu === "testing"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 text-success" />
              <span>{lang === "hi" ? "परीक्षण" : "Testing"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* Resources Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("resources")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "resources" ? null : "resources")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeMenu === "resources"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-blue" />
              <span>{lang === "hi" ? "संसाधन" : "Resources"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* e-Services Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("eservices")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "eservices" ? null : "eservices")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                pathname === "/consumer" || pathname === "/documents" || pathname === "/admin" || activeMenu === "eservices"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-orange" />
              <span>{lang === "hi" ? "ई-सेवाएं" : "e-Services"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* Knowledge Base (Manuals & STI) */}
          <button
            onClick={() => {
              closeMenu();
              onTabChange?.("knowledge" as any);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "knowledge"
                ? "bg-surface-raised text-navy shadow-xs border border-border"
                : "text-ink-soft hover:text-navy"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-orange" />
            <span>{lang === "hi" ? "ज्ञानकोष" : "Knowledge Base"}</span>
          </button>

          {/* About BIS Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter("about")}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleMouseEnter(activeMenu === "about" ? null : "about")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                pathname === "/about" || pathname === "/quality" || activeMenu === "about"
                  ? "bg-surface-raised text-navy shadow-xs border border-border"
                  : "text-ink-soft hover:text-navy"
              }`}
            >
              <Info className="h-3.5 w-3.5 text-ink-soft" />
              <span>{lang === "hi" ? "बीआईएस परिचय" : "About BIS"}</span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>
          </div>

          {/* Direct Link: Contact Us */}
          <Link
            href="/contact"
            onClick={closeMenu}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              pathname === "/contact"
                ? "bg-surface-raised text-navy shadow-xs border border-border"
                : "text-ink-soft hover:text-navy"
            }`}
          >
            <Phone className="h-3.5 w-3.5 text-success" />
            <span>{lang === "hi" ? "संपर्क" : "Contact Us"}</span>
          </Link>
        </nav>

        {/* Right Action Controls: Profile / Saved / Lang / Theme */}
        <div className="flex items-center gap-2">
          {/* Saved Chats Trigger (Available to all, with local persistence for guests & sync for logged in) */}
          {onOpenSavedChats && (
            <button
              onClick={onOpenSavedChats}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt shadow-xs transition-colors"
              title="Saved Research Chats & Dossiers"
            >
              <Bookmark className="h-3.5 w-3.5 text-orange" />
              <span className="hidden sm:inline">Saved</span>
              {typeof savedChatsCount === "number" && savedChatsCount > 0 && (
                <span className="rounded-full bg-orange px-1.5 py-0.2 text-[9px] font-black text-white">
                  {savedChatsCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile or Login Trigger */}
          {user ? (
            <div className="flex items-center gap-2 border-r border-border pr-2">
              <div
                onClick={onOpenLogin}
                className="cursor-pointer flex items-center gap-2 bg-surface-alt px-2.5 py-1.5 rounded-xl border border-border hover:border-navy transition-all"
                title="Click to switch persona / profile"
              >
                <div className={`h-2 w-2 rounded-full ${user.role === "employee" ? "bg-orange animate-pulse" : "bg-success"}`} />
                <div className="text-left">
                  <span className="text-xs font-black text-navy block leading-tight">{user.name}</span>
                  <span className="text-[10px] text-ink-faint block leading-none capitalize">
                    {user.role === "employee" ? "BIS Officer" : user.role === "manufacturer" ? "MSME Maker" : "Consumer"}
                  </span>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-ink-faint hover:text-orange p-1.5 rounded-lg hover:bg-surface-alt transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            onOpenLogin && (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-1.5 text-xs font-bold text-white hover:bg-navy-deep shadow-xs transition-all mr-1"
              >
                <User className="h-3.5 w-3.5 text-orange" />
                <span>Log In / Sign In</span>
              </button>
            )
          )}

          {onLangToggle && (
            <button
              onClick={onLangToggle}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt shadow-xs"
              title="Toggle Language"
            >
              <Globe className="h-3.5 w-3.5 text-blue" />
              <span>{lang === "hi" ? "English" : "हिंदी"}</span>
            </button>
          )}

          {onThemeToggle && (
            <button
              onClick={onThemeToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-ink-soft hover:text-navy shadow-xs"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="h-4 w-4 text-orange" /> : <Moon className="h-4 w-4 text-navy" />}
            </button>
          )}
        </div>
      </div>

      {/* FULL MEGA-MENU FLYOUT CONTAINERS */}
      {activeMenu && (
        <div
          className="absolute left-0 top-full w-full border-b border-border bg-surface-raised shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50"
          onMouseEnter={() => handleMouseEnter(activeMenu)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="mx-auto max-w-7xl px-6 py-6">
            {/* 1. STANDARDS MEGA-MENU (Direct Match to User Screenshot) */}
            {activeMenu === "standards" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  {/* Column 1: Discover Standards */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Discover Standards
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link
                          href="/standards"
                          onClick={closeMenu}
                          className="flex items-center justify-between text-ink hover:text-navy font-bold group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">Find an Indian Standard</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards"
                          onClick={closeMenu}
                          className="flex items-center justify-between text-ink hover:text-navy font-bold group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">Browse Standards</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?filter=product"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Standards by Product
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?filter=industry"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Standards by Industry
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?filter=material"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Standards by Material
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* Column 2: Understand Standards */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Understand Standards
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link
                          href="/standards/is-2347"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Standard Explorer (IS 2347 Passport)
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/compare"
                          onClick={closeMenu}
                          className="flex items-center justify-between text-ink hover:text-navy font-bold group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">Compare Standards</span>
                          <span className="rounded bg-success/20 px-1.5 py-0.2 text-[9px] font-black text-success">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?tab=amendments"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Standards Versions & Amendments
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?tab=related"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Related Standards
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?tab=referenced"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Referenced Standards
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/standards?tab=clauses"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Clauses & Requirements
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* Column 3: Standards Intelligence */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Standards Intelligence
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link
                          href="/?q=Domestic+pressure+cookers"
                          onClick={closeMenu}
                          className="flex items-center justify-between text-ink hover:text-navy font-bold group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">Ask about a Standard</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/?q=where+can+i+make+water+bottles"
                          onClick={closeMenu}
                          className="flex items-center justify-between text-ink hover:text-navy font-bold group"
                        >
                          <span className="group-hover:translate-x-0.5 transition-transform">Find Relevant Standards</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/?q=Why+is+IS+15410+relevant"
                          onClick={closeMenu}
                          className="block text-ink-soft hover:text-navy transition-colors"
                        >
                          Why is this Standard Relevant?
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Bottom Callout Banner (Matching User's Second Screenshot Exactly) */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-navy/20 bg-blue/5 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">Can&apos;t find the right standard?</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Describe your product or requirement and explore potentially relevant BIS standards.
                    </p>
                  </div>
                  <Link
                    href="/?q=Find+relevant+standards+for+my+product"
                    onClick={closeMenu}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
                  >
                    <span>Find Relevant Standards</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* 2. CERTIFICATION MEGA-MENU */}
            {activeMenu === "certification" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Conformity Schemes
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="font-bold text-ink hover:text-navy flex items-center justify-between">
                          <span>Scheme-I (ISI Mark) — Domestic</span>
                          <span className="rounded bg-orange/15 px-1.5 py-0.2 text-[9px] font-black text-orange">QCO</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Scheme-II (CRS) — Electronics & IT Goods
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Scheme-IV (Hallmarking) — Gold & Silver 916
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          FMCS — Foreign Manufacturers Scheme
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Application & Process
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="font-bold text-ink hover:text-navy flex items-center justify-between">
                          <span>Scheme Route Wizard</span>
                          <span className="rounded bg-success/20 px-1.5 py-0.2 text-[9px] font-black text-success">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/forms/form-i" onClick={closeMenu} className="font-bold text-navy hover:text-orange flex items-center justify-between">
                          <span>Schedule II Form 1 Statutory Drafter</span>
                          <span className="rounded bg-orange/20 px-1.5 py-0.2 text-[9px] font-black text-orange">NEW</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Simplified Option (30-day Grant of License)
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Factory Audit & Surveillance Protocol
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Concessions & MSME
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="font-bold text-navy flex items-center justify-between">
                          <span>80% MSME Marking Fee Concession</span>
                          <span className="rounded bg-orange/20 px-1.5 py-0.2 text-[9px] font-black text-orange">SUBSIDY</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          51% Women Entrepreneur Concession
                        </Link>
                      </li>
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Annual Minimum Marking Fee Schedule
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-orange/20 bg-orange/5 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">Check Certification Route</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Determine the exact statutory route, required forms, factory audit checklist, and MSME fee concessions.
                    </p>
                  </div>
                  <Link
                    href="/certification"
                    onClick={closeMenu}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-orange px-4 py-2 text-xs font-bold text-white hover:bg-orange/90 transition-all shadow-xs"
                  >
                    <span>Launch Scheme Wizard</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* 3. TESTING MEGA-MENU */}
            {activeMenu === "testing" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Laboratory Network
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="font-bold text-ink hover:text-navy flex items-center justify-between">
                          <span>Geocoded Lab Locator & Proximity Map</span>
                          <span className="rounded bg-success/20 px-1.5 py-0.2 text-[9px] font-black text-success">45+ LABS</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          BIS Central & Regional Laboratories
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          NABL Accredited Partner Labs (LRS)
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Sample Dispatch & TAT Tracking
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Testing Methods & STI
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Scheme of Testing & Inspection (STI) Rules
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Statutory Test Methods & Standard Equipment
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Independent Surveillance Batch Testing
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Parameters & Limits
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Thermal Shock & Burst Testing Limits
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Chemical Migration & Heavy Metal Limits
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Electrical Insulation & EMC Validation
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-success/20 bg-success/5 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">Explore Testing Information</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Find accredited test labs, statutory methods, and testing parameters for compliance across India.
                    </p>
                  </div>
                  <Link
                    href="/testing"
                    onClick={closeMenu}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
                  >
                    <span>Open Lab Locator</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* 4. RESOURCES MEGA-MENU */}
            {activeMenu === "resources" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Statutory Orders & QCOs
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link
                          href="/updates"
                          onClick={closeMenu}
                          className="font-bold text-navy hover:text-orange flex items-center justify-between"
                        >
                          <span>What&apos;s New &amp; Gazette Feed</span>
                          <span className="rounded bg-orange/20 px-1.5 py-0.2 text-[9px] font-black text-orange">LIVE</span>
                        </Link>
                      </li>
                      <li>
                        <a
                          href="https://www.bis.gov.in/product-certification/products-under-compulsory-certification/"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-ink hover:text-navy flex items-center justify-between"
                        >
                          <span>Quality Control Orders (QCOs)</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://egazette.gov.in" target="_blank" rel="noreferrer" className="text-ink-soft hover:text-navy flex items-center justify-between">
                          <span>Ministry Gazette Notifications</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://www.bis.gov.in" target="_blank" rel="noreferrer" className="text-ink-soft hover:text-navy flex items-center justify-between">
                          <span>DPIIT Standard Mandates</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Legal Acts & Regulations
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <a href="https://www.bis.gov.in" target="_blank" rel="noreferrer" className="text-ink-soft hover:text-navy flex items-center justify-between">
                          <span>Bureau of Indian Standards Act 2016</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://www.bis.gov.in" target="_blank" rel="noreferrer" className="text-ink-soft hover:text-navy flex items-center justify-between">
                          <span>Conformity Assessment Regulations 2018</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://www.bis.gov.in" target="_blank" rel="noreferrer" className="text-ink-soft hover:text-navy flex items-center justify-between">
                          <span>Consumer Protection Act 2019 Alignment</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Downloads & Templates
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/certification" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Schedule II Form 1 Statutory Application
                        </Link>
                      </li>
                      <li>
                        <Link href="/testing" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Scheme of Testing & Inspection (STI) Formats
                        </Link>
                      </li>
                      <li>
                        <Link href="/documents" onClick={closeMenu} className="font-bold text-orange hover:text-navy flex items-center justify-between">
                          <span>Tender Specification Scanner</span>
                          <span className="rounded bg-orange/20 px-1 text-[9px] font-black text-orange">TOOL</span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface-alt/50 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">Authoritative Statutory Grounding</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Every standard citation in BISVEDA links directly to the official Gazette of India or BIS central servers.
                    </p>
                  </div>
                  <a
                    href="https://www.bis.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-xs"
                  >
                    <span>Visit BIS Portal</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* 5. E-SERVICES MEGA-MENU */}
            {activeMenu === "eservices" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Statutory Portals
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <a href="https://www.manakonline.in" target="_blank" rel="noreferrer" className="font-bold text-navy hover:underline flex items-center justify-between">
                          <span>Manak Online (manakonline.in)</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://www.crsbis.in/BIS/" target="_blank" rel="noreferrer" className="font-bold text-navy hover:underline flex items-center justify-between">
                          <span>CRSBIS Portal (crsbis.in)</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <a href="https://www.services.bis.gov.in" target="_blank" rel="noreferrer" className="font-bold text-navy hover:underline flex items-center justify-between">
                          <span>BIS Services Portal (services.bis.gov.in)</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Digital Utilities
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/consumer" onClick={closeMenu} className="font-bold text-navy hover:text-blue flex items-center justify-between">
                          <span>Consumer Mark Verifier (CM/L & HUID)</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">SCAN</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/documents" onClick={closeMenu} className="font-bold text-navy hover:text-blue flex items-center justify-between">
                          <span>Tender Specification Review Console</span>
                          <span className="rounded bg-orange/20 px-1.5 py-0.2 text-[9px] font-black text-orange">AUDIT</span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Enforcement & Public Safety
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <a
                          href="https://www.bis.gov.in/consumer-overview/online-complaint-registration/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-soft hover:text-navy flex items-center justify-between"
                        >
                          <span>File Misuse / Spurious Mark Complaint</span>
                          <ExternalLink className="h-3 w-3 text-ink-faint" />
                        </a>
                      </li>
                      <li>
                        <Link href="/quality" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Statutory System Quality & Uptime Metrics
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-blue/20 bg-blue/5 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">Online Public License Search</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Verify licensee operational status, grant dates, and valid factory locations on Manak Online.
                    </p>
                  </div>
                  <a
                    href="https://www.manakonline.in"
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
                  >
                    <span>Launch Manak Online</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* 6. ABOUT BIS MEGA-MENU */}
            {activeMenu === "about" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-border">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Statutory Mandate
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/about" onClick={closeMenu} className="font-bold text-navy hover:underline">
                          The National Standards Body of India
                        </Link>
                      </li>
                      <li>
                        <Link href="/about" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Core Objectives & International Harmonization
                        </Link>
                      </li>
                      <li>
                        <Link href="/about" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Consumer Protection & Product Safety
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Intelligence Engine Architecture
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/about" onClick={closeMenu} className="font-bold text-navy hover:underline">
                          BISVEDA Sovereign AI Principles
                        </Link>
                      </li>
                      <li>
                        <Link href="/about" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Exact-First Alphanumeric Short-Circuit Policy
                        </Link>
                      </li>
                      <li>
                        <Link href="/about" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Clause-Level Merkle Hash Evidence Proofs
                        </Link>
                      </li>
                      <li>
                        <Link href="/quality" onClick={closeMenu} className="font-bold text-blue hover:underline flex items-center justify-between">
                          <span>Quality Dashboard & Benchmark Integrity</span>
                          <span className="rounded bg-blue/15 px-1.5 py-0.2 text-[9px] font-black text-blue">METRICS</span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-ink-faint">
                      Contact & Directory
                    </h3>
                    <ul className="space-y-2 text-xs">
                      <li>
                        <Link href="/contact" onClick={closeMenu} className="font-bold text-navy hover:underline">
                          BIS Headquarters, Manak Bhavan, New Delhi
                        </Link>
                      </li>
                      <li>
                        <Link href="/contact" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Regional & Branch Office Directory
                        </Link>
                      </li>
                      <li>
                        <Link href="/contact" onClick={closeMenu} className="text-ink-soft hover:text-navy">
                          Consumer Grievance Redressal
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-navy/20 bg-surface-alt/50 p-4">
                  <div>
                    <h4 className="text-xs font-black text-navy">BISVEDA Sovereign Compliance Platform</h4>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      Empowering Indian industry and MSMEs with instant, grounded, and tamper-proof standard intelligence.
                    </p>
                  </div>
                  <Link
                    href="/about"
                    onClick={closeMenu}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
                  >
                    <span>Read System Overview</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
