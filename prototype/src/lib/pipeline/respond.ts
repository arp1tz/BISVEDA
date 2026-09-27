/**
 * BISVEDA V9 — Stage 12: Response Contract (lib/pipeline/respond.ts)
 * 
 * Defines the single, unified BisvedaResponse contract consumed by the UI and API.
 * Emits real stage events (understand, search, check, write).
 */

import { Source } from "./package";

export interface BisvedaResponse {
  conversation_id: string;
  kind: "answer" | "clarify" | "refusal" | "smalltalk";
  language: string;                           // 'en' | 'hi' | 'hinglish'
  grounding: "verified" | "partial" | "none";
  answer?: {
    headline: string;
    points: string[];
    next_steps: string[];
  };
  primary_standard?: { id: string; title: string };
  qco?: {
    status: "mandatory" | "notified_not_in_force" | "unknown";
    order_title?: string;
    effective_on?: string;
    source: string;
  };
  standards?: Array<{
    id: string;
    title: string;
    class: "applies" | "may_apply" | "related";
    why: string;
    source: string;
  }>;
  certification?: {
    scheme_name: string;
    steps: Array<{ text: string; source: string }>;
  } | null;
  labs?: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    distance_km?: number;
    lat?: number;
    lng?: number;
    detail_url?: string;
    source: string;
  }> | null;
  sources: Source[];
  clarify?: {
    question: string;
    options: Array<{ label: string; value: string }>;
  };
  refusal?: {
    reason: "out_of_scope" | "not_in_sources" | "gibberish" | "blocked";
    message: string;
    next_steps: Array<{ text: string; url?: string }>;
  };
  visual_evidence?: {
    product_guess?: string;
    label_text?: string;
    licence_number?: string;
    isi_mark_seen?: boolean | "unclear";
  };
  follow_ups: string[];                       // 0–3 suggestions built from what package can answer
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
  search: "Searching official BIS sources",
  check: "Checking certification rules",
  write: "Writing a clear answer",
};

/**
 * Builds realistic, package-grounded follow-up suggestions.
 */
export function buildFollowUps(
  primaryStd?: { id: string; title: string } | null,
  hasLabs?: boolean,
  hasScheme?: boolean
): string[] {
  const followUps: string[] = [];
  if (!primaryStd) return followUps;

  if (hasLabs) {
    followUps.push(`Which labs can test ${primaryStd.id}?`);
  }
  if (hasScheme) {
    followUps.push(`What are the certification steps for ${primaryStd.id}?`);
  }
  followUps.push(`What is the scope of ${primaryStd.id}?`);

  return followUps.slice(0, 3);
}
