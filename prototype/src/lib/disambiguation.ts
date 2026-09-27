import disambigData from "../../data/disambiguation.json";
import type { DisambiguationResult } from "./types";

interface RuleEntry {
  term: string;
  question: string;
  options: {
    label: string;
    standard: string;
    category: string;
    icon?: string;
  }[];
}

const rules: Record<string, RuleEntry> = disambigData as Record<string, RuleEntry>;

/**
 * Pre-RAG Ambiguity Trap:
 * Catches polysemous or generic queries before running retrieval.
 * Returns structured disambiguation chips to present to the user.
 */
export function checkAmbiguity(rawQuery: string): DisambiguationResult {
  const query = rawQuery.trim().toLowerCase();

  // If the query already specifies an exact IS number, bypass disambiguation
  if (/is\s*\d{1,5}/i.test(query)) {
    return { isAmbiguous: false };
  }

  // Check each polysemous term key
  for (const [key, rule] of Object.entries(rules)) {
    const keyLower = key.toLowerCase();
    
    // Check if query is just the key or very short general phrase containing the key
    const isExactMatch = query === keyLower;
    const isPluralMatch = query === keyLower + "s";
    const isShortQuery = query.split(/\s+/).length <= 4;
    const containsKey = new RegExp(`\\b${keyLower}\\b`, "i").test(query);

    // If query has the broad term without a distinguishing adjective/standard
    if ((isExactMatch || isPluralMatch) || (isShortQuery && containsKey && !hasSpecificModifiers(query, keyLower))) {
      return {
        isAmbiguous: true,
        term: rule.term,
        question: rule.question,
        options: rule.options,
      };
    }
  }

  return { isAmbiguous: false };
}

function hasSpecificModifiers(query: string, key: string): boolean {
  // If the user already specified "stainless steel bottle", "exhaust fan", "ppc cement" etc.
  const specificSubstrings = [
    "stainless steel", "vacuum", "insulated", "drinking water", "mineral water",
    "ceiling", "exhaust", "table fan", "pedestal", "opc", "ppc", "slag",
    "pressure cooker", "electric", "cpvc", "upvc", "hdpe", "galvanized"
  ];
  return specificSubstrings.some((sub) => query.includes(sub));
}
