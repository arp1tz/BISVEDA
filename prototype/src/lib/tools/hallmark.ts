/**
 * BISVEDA — Hallmark and Certification Mark Checking Tool (src/lib/tools/hallmark.ts, P5.3)
 *
 * Handles hallmark identification, gold purity grades, HUID format validation,
 * and CM/L licence mark format checks.
 *
 * HARD RULE: Never declare a mark, licence, or HUID "valid", "genuine", or "authentic".
 * Always present format validation results and direct the user to verify on the
 * official BIS Care app or Manak Online portal.
 */

import { validateHuid, parsePurity, normalizeCmlNumber, PurityGrade } from "../vision";
import type { HallmarkCard, MarkCard } from "../pipeline/respond";

export interface HallmarkToolInput {
  query: string;
  purityRaw?: string | null;
  huidRaw?: string | null;
  cmlRaw?: string | null;
}

export interface HallmarkToolResult {
  kind: "hallmark" | "mark" | "both";
  hallmarkCard?: HallmarkCard;
  markCard?: MarkCard;
  text: string;
  targetStandardId?: string; // e.g. "IS 1417" for purity/hallmarking
}

/**
 * Extracts and checks hallmark, purity, HUID, or CM/L identifiers from user text or vision inputs.
 */
export function processHallmarkOrMark(input: HallmarkToolInput): HallmarkToolResult | null {
  const q = input.query || "";

  // 1. Check for HUID
  let candidateHuid = input.huidRaw;
  if (!candidateHuid) {
    const huidMatch = q.match(/\b(?:HUID|huid|code|id)[:\s]*([A-Za-z0-9]{6})\b/i) ||
      q.match(/\b([A-Z0-9]{6})\b/);
    // Ignore pure words like "HELMET", "REPORT", "ONLINE"
    if (huidMatch && !/^(?:HELMET|REPORT|ONLINE|BISAPP|SEARCH|VERIFY|JAIPUR|MUMBAI)$/i.test(huidMatch[1])) {
      candidateHuid = huidMatch[1];
    }
  }

  // 2. Check for Purity
  let candidatePurity = input.purityRaw;
  if (!candidatePurity) {
    const purityMatch = q.match(/\b(24K999|23K958|22K916|21K875|18K750|14K585|9K375|999|958|916|875|750|585|375|24K|23K|22K|21K|18K|14K|9K)\b/i);
    if (purityMatch) {
      candidatePurity = purityMatch[1];
    }
  }

  // 3. Check for CM/L
  let candidateCml = input.cmlRaw;
  if (!candidateCml) {
    const cmlMatch = q.match(/\b(?:CM\/?L|licen[cs]e|licence\s*no\.?|cml)[:\s\-]*(\d{6,10})\b/i);
    if (cmlMatch) {
      candidateCml = cmlMatch[1];
    }
  }

  const parsedPurity = candidatePurity ? parsePurity(candidatePurity) : null;
  const validatedHuid = candidateHuid ? validateHuid(candidateHuid) : null;
  const normalizedCml = candidateCml ? normalizeCmlNumber(candidateCml) : null;

  if (!parsedPurity && !validatedHuid && !normalizedCml) {
    return null;
  }

  let hallmarkCard: HallmarkCard | undefined;
  let markCard: MarkCard | undefined;
  const textParts: string[] = [];

  if (parsedPurity || validatedHuid) {
    hallmarkCard = {
      purity_karat: parsedPurity?.carat,
      purity_fineness: parsedPurity?.fineness,
      huid: validatedHuid?.huid || candidateHuid || undefined,
      huid_format_valid: validatedHuid ? validatedHuid.valid : undefined,
    };

    if (parsedPurity) {
      textParts.push(
        `**Gold Purity Grade**: ${parsedPurity.standardGrade} per IS 1417 (Gold & Gold Alloys, Jewellery/Artefacts — Fineness & Marking).`
      );
    }

    if (validatedHuid) {
      if (validatedHuid.valid) {
        textParts.push(
          `**HUID Code Format**: \`${validatedHuid.huid}\` conforms to the official 6-character alphanumeric format. To verify authenticity and registration details of this jewellery piece, enter the HUID in the official **BIS Care App** under "Verify HUID".`
        );
      } else {
        textParts.push(
          `**HUID Code Format**: \`${candidateHuid}\` does not conform to the standard 6-character alphanumeric HUID format specified by BIS.`
        );
      }
    }
  }

  if (normalizedCml) {
    markCard = {
      cml_number: normalizedCml,
      note: `Licence number read: ${normalizedCml}. Verify the manufacturer's licence status on the official BIS Care app or Manak Online portal.`,
    };
    textParts.push(
      `**BIS Certification Licence**: \`${normalizedCml}\`. You can check the current operative validity, product scope, and manufacturing location on the **BIS Care App** or **Manak Online**.`
    );
  }

  const kind = hallmarkCard && markCard ? "both" : hallmarkCard ? "hallmark" : "mark";

  return {
    kind,
    hallmarkCard,
    markCard,
    text: textParts.join("\n\n"),
    targetStandardId: parsedPurity || validatedHuid ? "IS 1417" : undefined,
  };
}
