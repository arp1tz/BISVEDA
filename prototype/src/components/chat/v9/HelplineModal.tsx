"use client";

import React, { useState } from "react";
import {
  PhoneCall,
  X,
  CheckCircle2,
  AlertCircle,
  PhoneForwarded,
  ShieldCheck,
  Headphones,
  Loader2,
  Volume2,
} from "lucide-react";

interface HelplineModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
}

export function HelplineModal({ isOpen, onClose, initialPhone = "" }: HelplineModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ phone: string; message: string; caller_id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers, spaces, and hyphens
    const val = e.target.value.replace(/[^\d\s-]/g, "");
    setPhoneNumber(val);
    if (error) setError(null);
  };

  const handleTriggerCall = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phoneNumber.replace(/\D/g, "");

    // Validate 10 digits
    if (digitsOnly.length < 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/helpline/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          source: "chat_modal",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate helpline call.");
      }

      setSuccessData({
        phone: data.phone,
        message: data.message || "You will receive a call shortly.",
        caller_id: data.caller_id,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setPhoneNumber("");
    setError(null);
  };

  const isValidNumber = phoneNumber.replace(/\D/g, "").length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {successData ? (
          /* Success Screen: Call Dispatched */
          <div className="text-center py-4 space-y-4">
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" />
              <div className="relative h-16 w-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                <PhoneForwarded className="h-8 w-8 animate-bounce" />
              </div>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Call request queued</span>
              </span>
              <h3 className="text-lg font-bold text-[#0B2A4A]">You will receive a call shortly!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Calling <strong className="text-slate-900 font-mono text-sm">{successData.phone}</strong> from our official BISVEDA helpline number <strong className="text-[#0B2A4A] font-mono font-bold">{successData.caller_id || "09513886363"}</strong>.
                Please keep your mobile phone nearby and answer when it rings.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1.5 text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-[#0B2A4A]">
                <Volume2 className="h-3.5 w-3.5 text-[#E8710A]" />
                <span>What to expect on the call:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                <li className="font-semibold text-amber-800">Answer the call and press any key (e.g. 1) to connect to BISVEDA AI.</li>
                <li>BISVEDA AI Assistant will greet you in Hindi or English.</li>
                <li>Speak naturally: ask about Indian Standards, ISI marks, or hallmarking.</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#0B2A4A] text-white text-xs font-bold hover:bg-[#081e36] transition-colors shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Call Request Form */
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#0B2A4A]/5 border border-[#0B2A4A]/10 text-[#0B2A4A] flex items-center justify-center shrink-0">
                <Headphones className="h-6 w-6 text-[#E8710A]" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#E8710A]">
                  Direct voice assistance
                </span>
                <h3 className="text-base font-bold text-[#0B2A4A]">
                  Talk with BISVEDA on Call
                </h3>
                <p className="text-xs text-slate-500">
                  Receive an instant callback from our official AI voice helpline.
                </p>
              </div>
            </div>

            <form onSubmit={handleTriggerCall} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your Mobile Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-semibold text-xs text-slate-500 font-mono">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    maxLength={14}
                    className="w-full pl-16 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white transition-colors"
                    autoFocus
                    required
                  />
                  {isValidNumber && (
                    <CheckCircle2 className="absolute right-3 h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enter 10-digit mobile number. We do not spam or store your number.
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#0B2A4A] hover:bg-[#081e36] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#E8710A]" />
                      <span>Initiating Outbound Call…</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-4 w-4 text-[#E8710A]" />
                      <span>Call me now, receive a call shortly</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Bureau of Indian Standards Official AI</span>
              </span>
              <span>Available 24x7</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
