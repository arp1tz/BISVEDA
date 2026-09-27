"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  UserCheck,
  ArrowLeft,
  Building2,
  FileCheck2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EmployeePipeline } from "@/components/employee/EmployeePipeline";
import { LoginModal, type UserProfile } from "@/components/auth/LoginModal";
import { loadStoredUser, saveStoredUser } from "@/lib/chat-storage";

export default function AdminIngestionPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    setMounted(true);
  }, []);

  const handleLogin = (newUser: UserProfile) => {
    setUser(newUser);
    saveStoredUser(newUser);
    setIsLoginOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    saveStoredUser(null);
  };

  const isOfficer = user?.role === "employee";

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-faint mb-4">
          <Link href="/" className="hover:text-navy hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">Officer Ingestion Console</span>
        </div>

        {mounted && isOfficer ? (
          /* Authenticated Employee Dashboard Pipeline */
          <div className="space-y-4">
            <div className="rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-orange animate-ping" />
                <span className="text-xs font-bold text-navy">
                  Authenticated Officer Session: <strong>{user?.name}</strong> ({user?.designation || "BIS Officer"} • {user?.committee || "Sectional Committee"})
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs font-bold text-danger hover:underline"
              >
                Sign Out of Officer Console
              </button>
            </div>

            <EmployeePipeline user={user!} />
          </div>
        ) : (
          /* Official Government Restricted Access Guard */
          <div className="max-w-2xl mx-auto my-12 rounded-3xl border border-border bg-surface-raised p-8 shadow-xl text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-orange/10 border border-orange/20 text-orange">
              <Lock className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-surface px-3 py-1 text-xs font-bold text-navy">
                <ShieldAlert className="h-3.5 w-3.5 text-orange" />
                <span>Restricted Sectional Committee Console</span>
              </div>
              <h1 className="text-2xl font-black text-navy tracking-tight">
                BIS Officer Ingestion & Regulatory Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft max-w-lg mx-auto leading-relaxed">
                The Ingestion Pipeline, Gazette QCO Staging, and Sectional Committee Air-Gapped Review are restricted to authorized Bureau of Indian Standards personnel.
              </p>
            </div>

            <div className="rounded-2xl border border-blue/20 bg-blue/5 p-4 text-left text-xs text-navy space-y-2 max-w-lg mx-auto">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4 text-blue" />
                <span>Public Access Policy</span>
              </div>
              <p className="text-ink-soft leading-normal">
                No login is required to search Indian Standards, calculate MSME concessions, locate accredited labs, or inspect helmet photos. All public research tools are available on the home landing page.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-orange hover:bg-orange/90 px-6 py-3 text-xs font-black text-white shadow-md transition-all"
              >
                <UserCheck className="h-4 w-4" />
                <span>Sign In as BIS Officer</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-xs"
              >
                <span>Return to Public Home</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Login Modal opened directly on the employee tab */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        initialTab="employee"
      />
    </div>
  );
}
