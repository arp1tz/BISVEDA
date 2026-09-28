"use client";

import React, { useState } from "react";
import {
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  PhoneForwarded,
  Headphones,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { HelplineCard } from "@/lib/pipeline/respond";

interface HelplineCallCardProps {
  card?: HelplineCard;
}

export function HelplineCallCard({ card }: HelplineCallCardProps) {
  const [phoneNumber, setPhoneNumber] = useState(card?.phone_number || "");
  const [loading, setLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "queued" | "failed">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedPhone, setConfirmedPhone] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d\s-]/g, "");
    setPhoneNumber(val);
    if (errorMsg) setErrorMsg(null);
  };

  const handleTriggerCall = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/helpline/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          source: "chat_card",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger call.");
      }

      setConfirmedPhone(data.phone || phoneNumber);
      setCallStatus("queued");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate call.");
      setCallStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#0B2A4A]/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#0B2A4A] text-white flex items-center justify-center">
            <Headphones className="h-4 w-4 text-[#E8710A]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#0B2A4A]">BISVEDA Voice Helpline Call</h4>
            <span className="text-[11px] text-slate-500">Multilingual Real-time Voice Interface</span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          24x7 Live
        </span>
      </div>

      {callStatus === "queued" ? (
        /* Queued Call Success Card */
        <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
          <div className="h-10 w-10 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center animate-bounce shadow-sm">
            <PhoneForwarded className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-900 block">
              You will receive a call shortly!
            </span>
            <span className="text-[11px] text-emerald-800 block mt-1">
              Calling <strong className="font-mono">{confirmedPhone}</strong>.
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-300 text-left flex items-center gap-2">
            <span className="text-base">📱</span>
            <span className="text-[11px] text-amber-950 font-medium">
              <strong>When you answer:</strong> BISVEDA AI will automatically greet you in Hindi and English. Speak naturally!
            </span>
          </div>
        </div>
      ) : (
        /* Input Form */
        <form onSubmit={handleTriggerCall} className="space-y-2.5">
          <p className="text-xs text-slate-700">
            Enter your 10-digit mobile number to talk directly with BISVEDA regarding standards, ISI certification, or testing labs:
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 font-semibold text-xs text-slate-500 font-mono">
                🇮🇳 +91
              </span>
              <input
                type="tel"
                placeholder="98765 43210"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
                className="w-full pl-16 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A] focus:ring-1 focus:ring-[#0B2A4A]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-2 px-4 rounded-xl bg-[#0B2A4A] hover:bg-[#081e36] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E8710A]" />
                  <span>Connecting…</span>
                </>
              ) : (
                <>
                  <PhoneCall className="h-3.5 w-3.5 text-[#E8710A]" />
                  <span>Call Me</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Official Bureau of Indian Standards Helpline • Toll-free</span>
          </div>
        </form>
      )}
    </div>
  );
}
