/**
 * BISVEDA — Multimodal Vision Service (src/lib/vision.ts, P4)
 *
 * Real Gemini multimodal vision extraction for uploaded product and jewellery photos.
 * Analyzes categories (helmet, toy, gold_jewellery, other_product, not_a_product, unreadable),
 * reads label text, identifies BIS marks (ISI mark, BIS hallmark), extracts IS numbers,
 * CM/L licence numbers, purity marks, and HUID codes.
 *
 * Everything returned here is `user_provided` evidence — a candidate observation,
 * never a verified fact.
 */

export type VisionCategory =
  | "helmet"
  | "toy"
  | "gold_jewellery"
  | "other_product"
  | "not_a_product"
  | "unreadable";

export interface VisionInspectionResult {
  category: VisionCategory;
  product_guess: string;
  description: string;
  label_text: string;
  is_numbers: string[];
  isi_mark_seen: boolean | "unclear";
  cml_number: string | null;
  bis_hallmark_seen: boolean | "unclear";
  purity_mark: string | null;
  huid: string | null;
  confidence_note: string;
}

/**
 * Normalizes CM/L number strictly without double prefix:
 * e.g. "CM/L No. 3112329" -> "CM/L-3112329", "3112329" -> "CM/L-3112329".
 * Must contain 7 to 10 digits.
 */
export function normalizeCmlNumber(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 10) {
    return `CM/L-${digits}`;
  }
  return null;
}

/**
 * Validates a 6-character alphanumeric Hallmarking Unique Identification (HUID) code.
 * Standard format: exactly 6 characters [A-Z0-9].
 */
export function validateHuid(raw?: string | null): { valid: boolean; huid: string | null } {
  if (!raw) return { valid: false, huid: null };
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z0-9]{6}$/.test(cleaned)) {
    return { valid: true, huid: cleaned };
  }
  return { valid: false, huid: cleaned.length > 0 ? cleaned : null };
}

export interface PurityGrade {
  carat: string;
  fineness: string;
  standardGrade: string;
}

/**
 * Parses gold purity marks per IS 1417 Table 1:
 * Recognized standard grades:
 *  - 24K: 999
 *  - 23K: 958
 *  - 22K: 916
 *  - 21K: 875
 *  - 18K: 750
 *  - 14K: 585
 *  - 9K:  375
 */
export function parsePurity(raw?: string | null): PurityGrade | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase();

  const officialGrades: Array<{ carat: string; fineness: string }> = [
    { carat: "24K", fineness: "999" },
    { carat: "23K", fineness: "958" },
    { carat: "22K", fineness: "916" },
    { carat: "21K", fineness: "875" },
    { carat: "18K", fineness: "750" },
    { carat: "14K", fineness: "585" },
    { carat: "9K", fineness: "375" },
  ];

  for (const grade of officialGrades) {
    if (
      clean.includes(`${grade.carat}${grade.fineness}`) ||
      clean.includes(`${grade.carat} ${grade.fineness}`) ||
      clean === grade.fineness ||
      clean === grade.carat ||
      clean.includes(grade.fineness)
    ) {
      return {
        carat: grade.carat,
        fineness: grade.fineness,
        standardGrade: `${grade.carat} (${grade.fineness})`,
      };
    }
  }

  // Fallback pattern matching e.g. "22KT", "916"
  const finenessMatch = clean.match(/\b(999|958|916|875|750|585|375)\b/);
  if (finenessMatch) {
    const fineness = finenessMatch[1];
    const match = officialGrades.find((g) => g.fineness === fineness);
    if (match) {
      return {
        carat: match.carat,
        fineness: match.fineness,
        standardGrade: `${match.carat} (${match.fineness})`,
      };
    }
  }

  const caratMatch = clean.match(/\b(24|23|22|21|18|14|9)\s*K(?:ARAT|T)?\b/i);
  if (caratMatch) {
    const carat = `${caratMatch[1]}K`;
    const match = officialGrades.find((g) => g.carat === carat);
    if (match) {
      return {
        carat: match.carat,
        fineness: match.fineness,
        standardGrade: `${match.carat} (${match.fineness})`,
      };
    }
  }

  return null;
}

const VISION_SYSTEM_PROMPT = `You are the Bureau of Indian Standards (BIS) computer vision inspection assistant.
Analyze this image for product compliance, labeling, and official BIS certification marks.

Return strictly a JSON object conforming to this schema:
{
  "category": "helmet" | "toy" | "gold_jewellery" | "other_product" | "not_a_product" | "unreadable",
  "product_guess": "Short concise name of product or object",
  "description": "1-2 sentence visual description of what is visible in the photo",
  "label_text": "All verbatim legible text visible on labels, stamps, engraving, or packaging",
  "is_numbers": ["Array of Indian Standard numbers found, e.g. IS 4151, IS 2925, IS 1417, IS 9873"],
  "isi_mark_seen": true | false | "unclear",
  "cml_number": "Numeric CM/L licence number (7 to 10 digits) if seen, or null",
  "bis_hallmark_seen": true | false | "unclear",
  "purity_mark": "Gold purity mark if visible (e.g. 22K916, 916, 18K750, 750), or null",
  "huid": "6-character alphanumeric Hallmarking Unique ID (HUID) if visible, or null",
  "confidence_note": "Brief note on photo clarity and mark legibility"
}

Categorization Rules:
1. "helmet": Motorcycle helmets, two-wheeler helmets, industrial safety helmets, hard hats, construction helmets.
2. "toy": Children's toys, battery/electric toys, plush toys, mechanical toys, ride-on toys.
3. "gold_jewellery": Gold jewellery, gold artefacts, coins, rings, necklaces, bangles with hallmark stamps or assay marks.
4. "other_product": Manufactured products other than helmets, toys, or gold (e.g. pressure cookers, electronics, cables, cement, water bottles).
5. "not_a_product": Scenery, animals, coffee cup, beverage, food, outdoor landscape, documents without product photos, selfies.
6. "unreadable": Severe blur, glare, pitch black, extreme distortion where nothing can be identified.

Marks:
- "isi_mark_seen": True if the BIS ISI monogram (stylized "ISI" enclosed in two rectangular shapes) is seen.
- "bis_hallmark_seen": True if the triangular BIS hallmark logo for gold jewellery is seen.
- "cml_number": Digits of CM/L licence number (usually located beneath the ISI mark).
- "huid": 6-character alphanumeric code engraved or laser-stamped on hallmarked gold jewellery.`;

/**
 * Inspects a product image via Gemini Multimodal Vision API.
 */
export async function inspectImage(
  base64Data: string,
  providedMime = "image/jpeg"
): Promise<VisionInspectionResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let mimeType = providedMime;
  const match = base64Data.match(/^data:([a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+);base64,/);
  if (match) {
    mimeType = match[1];
  }
  const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+;base64,/, "");

  const configuredModel = process.env.GEMINI_VISION_MODEL;
  // Fallbacks when GEMINI_VISION_MODEL is unset, fastest first (timed 2026-09-29: 3.5-flash-lite ~3.8 s,
  // 3.1-flash-lite ~5 s; 2.5-flash-lite and 2.5-flash return 404, so they are gone).
  const models = Array.from(
    new Set([configuredModel, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash"])
  ).filter((m): m is string => Boolean(m));

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: VISION_SYSTEM_PROMPT },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.0,
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text) as Record<string, unknown>;

          const rawCategory = String(parsed.category || "other_product").toLowerCase();
          const category: VisionCategory = [
            "helmet",
            "toy",
            "gold_jewellery",
            "other_product",
            "not_a_product",
            "unreadable",
          ].includes(rawCategory)
            ? (rawCategory as VisionCategory)
            : "other_product";

          const rawCml = parsed.cml_number ? String(parsed.cml_number) : null;
          const normalizedCml = normalizeCmlNumber(rawCml);

          const rawHuid = parsed.huid ? String(parsed.huid) : null;
          const huidCheck = validateHuid(rawHuid);

          const isNumbers = Array.isArray(parsed.is_numbers)
            ? parsed.is_numbers.map(String).filter((s) => s.trim().length > 0)
            : [];

          return {
            category,
            product_guess: String(parsed.product_guess || "Unidentified Object").trim(),
            description: String(parsed.description || "").trim(),
            label_text: String(parsed.label_text || "").trim(),
            is_numbers: isNumbers,
            isi_mark_seen:
              parsed.isi_mark_seen === true
                ? true
                : parsed.isi_mark_seen === "unclear"
                ? "unclear"
                : false,
            cml_number: normalizedCml,
            bis_hallmark_seen:
              parsed.bis_hallmark_seen === true
                ? true
                : parsed.bis_hallmark_seen === "unclear"
                ? "unclear"
                : false,
            purity_mark: parsed.purity_mark ? String(parsed.purity_mark).trim() : null,
            huid: huidCheck.huid,
            confidence_note: String(parsed.confidence_note || "").trim(),
          };
        }
      }
    } catch {
      // try fallback model
    }
  }

  return null;
}
