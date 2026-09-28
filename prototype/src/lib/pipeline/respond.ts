/**
 * BISVEDA — Response Contract (lib/pipeline/respond.ts, P3.6)
 *
 * The single, unified response contract consumed by the UI and API.
 * Replaces the old headline/points/next_steps + qco/certification/labs
 * slots (which assumed data we don't have) with a single markdown `text`
 * plus optional feature `cards` — labs/ahc/hallmark/mark/form_i are wired
 * up in P5; their shapes are reserved here so the contract doesn't change
 * again when P5 lands.
 */

import { Source } from "./package";
import type { LabRecord, AhcRecord } from "../kb/types";

export type ResponseKind = "answer" | "clarify" | "refusal" | "smalltalk" | "form_question";
export type Grounding = "verified" | "supported_inference" | "insufficient_evidence" | "none";

export interface LabsCard {
  standard_id: string;
  labs: LabRecord[];
  retrieved_note: string; // e.g. "BIS-recognised labs listing IS 4151 in scope (BIS LIMS, retrieved 2026-09-27)"
}

export interface AhcCard {
  ahcs: AhcRecord[];
}

export interface HallmarkCard {
  purity_karat?: string;
  purity_fineness?: string;
  huid?: string;
  huid_format_valid?: boolean;
}

export interface MarkCard {
  cml_number?: string;
  huid?: string;
  note: string; // e.g. "Licence number read: CM/L-3112329. Verify on the BIS Care app or Manak Online."
}

export interface FormICard {
  fields: Record<string, string>;
  missing_required: string[];
  print_url?: string;
}

export interface HelplineCard {
  phone_number?: string;
  status?: "prompt" | "queued" | "connecting" | "active";
  message?: string;
}

export interface ImageReadCard {
  category?: string;
  product_guess?: string;
  description?: string;
  label_text?: string;
  isi_mark_seen?: boolean | "unclear";
  bis_hallmark_seen?: boolean | "unclear";
  purity_mark?: string | null;
  huid?: string | null;
  cml_number?: string | null;
  confidence_note?: string;
}

export interface BisvedaResponse {
  conversation_id: string;
  kind: ResponseKind;
  language: string;
  grounding: Grounding;
  text: string; // markdown answer / clarify prompt / refusal message / smalltalk reply
  standards?: Array<{ id: string; title: string; class: string; why: string }>;
  sources: Source[];
  cards?: {
    labs?: LabsCard;
    ahc?: AhcCard;
    hallmark?: HallmarkCard;
    mark?: MarkCard;
    image?: ImageReadCard;
    form_i?: FormICard;
    helpline?: HelplineCard;
  };
  clarify?: {
    question: string;
    options: Array<{ label: string; value: string }>;
  };
  refusal?: {
    reason: "out_of_scope" | "not_in_sources" | "gibberish" | "blocked";
    message: string;
    next_steps: Array<{ text: string; url?: string }>;
  };
  follow_ups: string[];
}

export type PipelineStage = "understand" | "search" | "check" | "write";

export interface StageEvent {
  stage: PipelineStage;
  label: string;
  status: "active" | "done";
  duration_ms?: number;
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  understand: "Understanding your question",
  search: "Searching official BIS documents",
  check: "Checking the evidence",
  write: "Writing a grounded answer",
};

/** Builds realistic, package-grounded follow-up suggestions. Never suggests anything not in our KB. */
export function buildFollowUps(primaryStd?: { id: string; title: string } | null): string[] {
  if (!primaryStd) return [];
  return [`What is the scope of ${primaryStd.id}?`, `Where can I get ${primaryStd.id} tested?`].slice(0, 2);
}
