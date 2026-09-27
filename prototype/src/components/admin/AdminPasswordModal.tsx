"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";

interface AdminPasswordModalProps {
  isOpen: boolean;
  onSuccess: (user: any) => void;
  onCancel?: () => void;
}

export function AdminPasswordModal({
  isOpen,
  onSuccess,
  onCancel,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the staff password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem("bisveda_staff_auth", "true");
        onSuccess(data.user);
      } else {
        setError(data.error || "Incorrect password. Default: bisveda2026");
      }
    } catch (err) {
      setError("Unable to connect to authorization server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0B2A4A]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Staff Authorization Required
            </h2>
            <p className="text-xs text-slate-500">
              Knowledge Console governance & regulatory controls
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Staff Access Password
            </label>
            <input
              type="password"
              placeholder="Enter password (default: bisveda2026)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0B2A4A] focus:outline-none focus:ring-1 focus:ring-[#0B2A4A]"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Back to Site
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#071D33] disabled:opacity-50"
            >
              <span>{loading ? "Verifying..." : "Authorize Access"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
