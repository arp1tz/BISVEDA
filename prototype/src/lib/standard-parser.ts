/**
 * Standard Number & Version Parsing Utility
 * Pure client-safe and server-safe parser for Indian Standards.
 */

export interface ParsedStandard {
  rootStandard: string;
  editionYear: string;
  amendment?: string | null;
}

export function parseStandardVersion(stdNumber?: string): ParsedStandard {
  if (!stdNumber) return { rootStandard: "General Document", editionYear: "Current", amendment: null };
  const trimmed = stdNumber.trim();

  // Extract amendment if present (e.g., Amd 1, Amendment 2, (Amd 1))
  let amendment: string | null = null;
  const amdMatch = trimmed.match(/(?:amd|amendment)\.?\s*(\d+)/i);
  if (amdMatch) {
    amendment = `Amd ${amdMatch[1]}`;
  }

  // 1. Colon format: IS 4151:2015 or IS 17526:2021 (Amd 1)
  const colonMatch = trimmed.match(/^([A-Z]+\s+\d+(?:[A-Za-z0-9\/\-]+)?)\s*:\s*(\d{4})/i);
  if (colonMatch) {
    return { rootStandard: colonMatch[1].trim(), editionYear: colonMatch[2], amendment };
  }

  // 2. Parenthesis format: IS 1417 (1999) or IS 2925 (1984, Reaffirmed 1995)
  const parenMatch = trimmed.match(/^([A-Z]+\s+\d+(?:[A-Za-z0-9\/\-]+)?)\s*\(\s*(\d{4})/i);
  if (parenMatch) {
    return { rootStandard: parenMatch[1].trim(), editionYear: parenMatch[2], amendment };
  }

  // 3. General standard without year: IS 2347, IS 4151
  const generalMatch = trimmed.match(/^([A-Z]+\s+\d+(?:[A-Za-z0-9\/\-]+)?)/i);
  if (generalMatch) {
    return { rootStandard: generalMatch[1].trim(), editionYear: "Current", amendment };
  }

  return { rootStandard: trimmed, editionYear: "Current", amendment };
}
