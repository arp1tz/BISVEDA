"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid administrator password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#0B2A4A] text-white shadow-xs mb-2">
          <ShieldCheck className="h-6 w-6 text-[#E8710A]" />
        </div>
        <h1 className="text-xl font-bold text-[#0B2A4A]">Employee Console</h1>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Knowledge Base Graph, Standards Registry &amp; Directory Operations
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="admin-password"
            className="block text-xs font-semibold text-[#0F172A] mb-1.5 uppercase tracking-wider"
          >
            Admin Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password…"
              required
              autoFocus
              className="w-full pl-9 pr-10 py-2.5 bg-[#F7F8FA] border border-[#E5E7EB] rounded-xl text-sm text-[#0F172A] placeholder-[#64748B] focus:outline-hidden focus:border-[#0B2A4A] focus:ring-2 focus:ring-[#0B2A4A]/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0B2A4A] text-white hover:bg-[#081e36] text-sm font-semibold shadow-xs disabled:opacity-40 transition-colors cursor-pointer"
        >
          <span>{loading ? "Authenticating…" : "Sign In to Console"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="pt-3 border-t border-[#E5E7EB] text-center text-[11px] text-[#64748B]">
        <span>Bureau of Indian Standards · Internal Administrative Access</span>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8FA] text-[#0F172A] font-sans justify-between">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={<div className="text-xs text-slate-500">Loading console…</div>}>
          <AdminLoginForm />
        </Suspense>
      </main>

      <AppFooter />
    </div>
  );
}
