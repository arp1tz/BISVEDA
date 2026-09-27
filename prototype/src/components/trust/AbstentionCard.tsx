"use client";

import React from "react";
import { ShieldAlert, ExternalLink, PhoneCall, HelpCircle } from "lucide-react";

interface AbstentionCardProps {
  query: string;
}

export function AbstentionCard({ query }: AbstentionCardProps) {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 text-ink shadow-xs">
      <div className="flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-navy">
              No-Guess Policy: Insufficient Authoritative Evidence
            </h3>
            <span className="rounded bg-warning/20 px-2 py-0.5 text-[10px] font-black uppercase text-warning">
              Regulated Safety Gate
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            BISVEDA could not verify an authoritative Indian Standard or Quality Control Order governing the exact queried item: <strong className="text-navy">&ldquo;{query}&rdquo;</strong> with sufficient statutory certainty (retrieval score &lt; 45% safety floor).
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            In accordance with BIS regulatory standards, this system <strong>will not guess</strong> or invent standards that could compromise public safety or legal compliance.
          </p>

          <div className="mt-4 rounded-lg bg-surface-raised p-3 border border-border">
            <p className="text-[11px] font-bold text-navy uppercase tracking-wider">
              Recommended Official Next Steps:
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-ink-soft list-disc list-inside">
              <li>
                Search the manual catalog directly on{" "}
                <a
                  href="https://www.services.bis.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue hover:underline inline-flex items-center gap-0.5"
                >
                  services.bis.gov.in <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                File a standards enquiry on{" "}
                <a
                  href="https://www.manakonline.in"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue hover:underline inline-flex items-center gap-0.5"
                >
                  Manakonline.in <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="flex items-center gap-1.5 font-bold text-orange mt-1">
                <PhoneCall className="h-3.5 w-3.5" /> Call the National BIS Toll-Free Helpline: 14434
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
