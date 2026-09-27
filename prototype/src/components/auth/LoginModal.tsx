"use client";

import React, { useState } from "react";
import { X, ShieldCheck, UserCheck, Building2, KeyRound, Sparkles, ArrowRight, Lock } from "lucide-react";

export interface UserProfile {
  id: string;
  name: string;
  role: "manufacturer" | "consumer" | "employee";
  organization?: string;
  designation?: string;
  committee?: string;
  udyamNumber?: string;
  email: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
  initialTab?: "citizen" | "employee";
}

export function LoginModal({ isOpen, onClose, onLogin, initialTab = "citizen" }: LoginModalProps) {
  const [tab, setTab] = useState<"citizen" | "employee">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sync tab if initialTab changes
  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handleDemoLogin = (profile: UserProfile) => {
    onLogin(profile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-raised shadow-2xl overflow-hidden">
        {/* Header Header */}
        <div className="border-b border-border bg-navy px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised/10 border border-white/20">
                <ShieldCheck className="h-6 w-6 text-orange" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">BISVEDA Portal Access</h3>
                <p className="text-xs text-white/70">Sign In to Save Chats & Unlock Personalized Portals</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Role Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1 border border-white/10">
            <button
              onClick={() => setTab("citizen")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                tab === "citizen"
                  ? "bg-surface-raised text-navy shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Building2 className="h-4 w-4 text-orange" />
              <span>Citizen / MSME Maker</span>
            </button>
            <button
              onClick={() => setTab("employee")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                tab === "employee"
                  ? "bg-surface-raised text-navy shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <UserCheck className="h-4 w-4 text-blue" />
              <span>BIS Officer / Employee</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {tab === "citizen" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-orange/20 bg-orange/5 p-3 text-xs text-navy flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-orange mt-0.5 shrink-0" />
                <p>
                  No login is required to search standards or ask questions. Sign in below to <strong>save your chat dossiers</strong> across sessions, link your <strong>Udyam MSME number</strong>, and download pre-filled Schedule II Form 1 drafts.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft">Email or Udyam Registration Number</label>
                <input
                  type="text"
                  placeholder="e.g. UDYAM-DL-01-002341 or rajesh@steelcraft.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-soft">Password / OTP</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <button
                onClick={() =>
                  handleDemoLogin({
                    id: "user-mfg-01",
                    name: "Rajesh Kumar",
                    role: "manufacturer",
                    organization: "SteelCraft Appliances Pvt Ltd",
                    udyamNumber: "UDYAM-DL-01-002341",
                    email: email || "rajesh@steelcraft.in",
                  })
                }
                className="w-full rounded-xl bg-navy py-3 text-sm font-bold text-white hover:bg-navy-deep shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Enter Manufacturer Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* 1-Click Fast Profiles */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-ink-soft uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-orange" />
                  <span>1-Click Test Personas</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleDemoLogin({
                        id: "user-msme",
                        name: "Rajesh Sharma",
                        role: "manufacturer",
                        organization: "SteelCraft MSME",
                        udyamNumber: "UDYAM-MH-02-004512",
                        email: "rajesh@steelcraft.in",
                      })
                    }
                    className="p-3 text-left rounded-xl border border-border hover:border-orange hover:bg-orange/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-navy group-hover:text-orange">MSME Maker</span>
                      <span className="text-[10px] bg-orange/15 text-orange font-bold px-1.5 py-0.5 rounded">80% Subsidy</span>
                    </div>
                    <p className="text-[11px] text-ink-soft mt-1">Stainless Steel Cookers & Flasks</p>
                  </button>

                  <button
                    onClick={() =>
                      handleDemoLogin({
                        id: "user-consumer",
                        name: "Priya Sen",
                        role: "consumer",
                        organization: "Consumer Voice India",
                        email: "priya.sen@consumer.org",
                      })
                    }
                    className="p-3 text-left rounded-xl border border-border hover:border-blue hover:bg-blue/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-navy group-hover:text-blue">Consumer</span>
                      <span className="text-[10px] bg-blue/15 text-blue font-bold px-1.5 py-0.5 rounded">Citizen</span>
                    </div>
                    <p className="text-[11px] text-ink-soft mt-1">HUID & ISI Mark Authenticator</p>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue/20 bg-blue/5 p-3 text-xs text-navy flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-blue mt-0.5 shrink-0" />
                <p>
                  BIS Officer portal gives access to the <strong>Document Ingestion Pipeline</strong>, Sectional Committee drafting, and QCO publishing tools.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft">Gov NIC Email or Employee ID</label>
                <input
                  type="text"
                  placeholder="e.g. ak.verma@bis.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-soft">Sectional Committee Assignment</label>
                <select className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                  <option>MED 32 — Domestic Utensils & Appliances</option>
                  <option>CED 02 — Cement & Concrete</option>
                  <option>CED 54 — Structural Steel</option>
                  <option>FAD 14 — Packaged Water & Beverages</option>
                  <option>ETD 14 — Plugs, Sockets & Accessories</option>
                  <option>LITD 07 — Electronics & IT Products (CRS)</option>
                  <option>CED 22 — Protective Equipment & Helmets</option>
                </select>
              </div>

              <button
                onClick={() =>
                  handleDemoLogin({
                    id: "emp-verma",
                    name: "Dr. A. K. Verma",
                    role: "employee",
                    designation: "Scientist-D / Member Secretary",
                    committee: "MED 32",
                    email: email || "ak.verma@bis.gov.in",
                  })
                }
                className="w-full rounded-xl bg-orange py-3 text-sm font-bold text-white hover:bg-orange-deep shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Enter Officer Ingestion Console</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* 1-Click Officer Personas */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-ink-soft uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-orange" />
                  <span>1-Click Officer Demo Access</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleDemoLogin({
                        id: "emp-verma",
                        name: "Dr. A. K. Verma",
                        role: "employee",
                        designation: "Scientist-D / Member Secretary",
                        committee: "MED 32 (Domestic Appliances)",
                        email: "ak.verma@bis.gov.in",
                      })
                    }
                    className="p-3 text-left rounded-xl border border-border hover:border-navy hover:bg-navy/5 transition-all group"
                  >
                    <span className="text-xs font-black text-navy group-hover:text-blue block">Dr. A. K. Verma</span>
                    <span className="text-[10px] text-ink-soft block mt-0.5">Scientist-D (MED 32)</span>
                    <span className="text-[10px] text-orange font-bold block mt-1">Standards Ingestion</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDemoLogin({
                        id: "emp-meenakshi",
                        name: "S. Meenakshi",
                        role: "employee",
                        designation: "Joint Director (Labs)",
                        committee: "OSL (Testing Laboratories)",
                        email: "meenakshi.s@bis.gov.in",
                      })
                    }
                    className="p-3 text-left rounded-xl border border-border hover:border-navy hover:bg-navy/5 transition-all group"
                  >
                    <span className="text-xs font-black text-navy group-hover:text-blue block">S. Meenakshi</span>
                    <span className="text-[10px] text-ink-soft block mt-0.5">Joint Director (Labs)</span>
                    <span className="text-[10px] text-blue font-bold block mt-1">Lab Accreditation</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
