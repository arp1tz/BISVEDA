"use client";

import React, { useState } from "react";
import { Sparkles, X, Globe, BookOpen } from "lucide-react";
import type { RecommendationResult } from "@/lib/types";

interface ExplainSimplyModalProps {
  rec: RecommendationResult | null;
  onClose: () => void;
}

export function ExplainSimplyModal({ rec, onClose }: ExplainSimplyModalProps) {
  const [lang, setLang] = useState<"en" | "hi">("en");

  if (!rec) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface-raised p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange/20 text-orange">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-black text-navy uppercase tracking-wider">
              {lang === "hi" ? "सरल भाषा में समझें" : "Explain Simply (Layman Mode)"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Language Switcher */}
        <div className="mt-3 flex justify-end">
          <div className="flex rounded-lg border border-border bg-surface-alt p-0.5 text-xs font-bold">
            <button
              onClick={() => setLang("en")}
              className={`rounded-md px-2.5 py-1 ${
                lang === "en" ? "bg-surface-raised text-navy shadow-xs" : "text-ink-soft"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang("hi")}
              className={`rounded-md px-2.5 py-1 ${
                lang === "hi" ? "bg-surface-raised text-navy shadow-xs" : "text-ink-soft"
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs leading-relaxed">
          <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
            <p className="font-bold text-navy text-sm">
              {rec.standardNumber}: {rec.title}
            </p>
          </div>

          {lang === "en" ? (
            <div className="space-y-3 text-ink-soft">
              <p>
                <strong>What does this mean for a manufacturer?</strong>
                <br />
                If you make this product in India or import it, you cannot legally sell it without a BIS licence (ISI Mark) because the government has made it compulsory by law.
              </p>
              <p>
                <strong>What tests will BIS check?</strong>
                <br />
                BIS will verify that your factory has basic equipment to test pressure/burst limits, safety valves, handle temperature, and stainless steel quality before granting you a licence.
              </p>
              <p>
                <strong>How does MSME 30-Day fast track help you?</strong>
                <br />
                If you have an Udyam certificate, you get an 80% discount on fees, and you can test your product at any approved external laboratory first to get your licence in just 30 days!
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-ink-soft">
              <p>
                <strong>निर्माता के लिए इसका क्या मतलब है?</strong>
                <br />
                यदि आप यह उत्पाद भारत में बनाते हैं या आयात करते हैं, तो सरकार के अनिवार्य आदेश (QCO) के अनुसार बिना ISI मार्क के इसे बेचना गैरकानूनी है।
              </p>
              <p>
                <strong>बीआईएस कौन सी जांच करेगा?</strong>
                <br />
                बीआईएस आपके कारखाने में यह जांचेगा कि क्या आपके पास प्रेशर लीकेज, सेफ्टी वाल्व, हैंडल का तापमान और स्टील की शुद्धता जांचने की बुनियादी लैब है।
              </p>
              <p>
                <strong>एमएसएमई को क्या छूट मिलती है?</strong>
                <br />
                उद्यम पंजीकरण वाले छोटे उद्योगों को सरकारी शुल्क में 80% की छूट मिलती है, और आप बाहरी मान्यता प्राप्त लैब से टेस्ट करवाकर केवल 30 दिनों में लाइसेंस प्राप्त कर सकते हैं!
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep"
          >
            {lang === "hi" ? "समझ गया" : "Got It"}
          </button>
        </div>
      </div>
    </div>
  );
}
