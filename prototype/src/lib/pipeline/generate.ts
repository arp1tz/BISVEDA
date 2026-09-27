/**
 * BISVEDA V9 — Stage 10: Slot Generator (lib/pipeline/generate.ts)
 * 
 * Strict LLM slot filling over frozen EvidencePackage.
 * Temperature: 0.1, JSON output, with deterministic evidence-only fallback.
 */

import { EvidencePackage, Source } from "./package";

export interface GeneratedProse {
  headline: string;
  points: string[];
  next_steps: string[];
}

export function generateEvidenceOnlyProse(
  pkg: EvidencePackage,
  language: string = "en"
): GeneratedProse {
  const isHindi = language === "hi";
  const pStd = pkg.primary_standard;
  const s1 = pkg.sources.find((s) => s.label === "S1")?.label || "S1";

  if (!pStd) {
    return {
      headline: isHindi
        ? "इस उत्पाद के लिए हमारे स्रोतों में कोई लागू मानक नहीं मिला।"
        : "No applicable Indian Standard found in our sources for this product.",
      points: [],
      next_steps: [],
    };
  }

  // 1. Headline
  const headline = isHindi
    ? `इस उत्पाद के लिए लागू भारतीय मानक ${pStd.id} — ${pStd.title} है [${s1}]।`
    : `The applicable Indian Standard is ${pStd.id} — ${pStd.title} [${s1}].`;

  // 2. Points from sources
  const points: string[] = [];
  for (const s of pkg.sources.slice(1, 4)) {
    if (s.kind === "fact" && s.title.includes("Quality Control Order")) {
      points.push(
        isHindi
          ? `गुणवत्ता नियंत्रण आदेश (QCO) के तहत इस मानक के लिए BIS प्रमाणीकरण अनिवार्य है [${s.label}]।`
          : `BIS certification is mandated under the Quality Control Order [${s.label}].`
      );
    } else if (s.kind === "chunk") {
      const excerpt = s.text.slice(0, 140).trim();
      points.push(`${excerpt} [${s.label}].`);
    }
  }

  if (points.length === 0) {
    points.push(
      isHindi
        ? `मानक में विनिर्दिष्ट गुणवत्ता और सुरक्षा आवश्यकताओं का पालन अनिवार्य है [${s1}]।`
        : `Manufacturing must comply with safety specifications established under ${pStd.id} [${s1}].`
    );
  }

  // 3. Next steps from scheme
  const next_steps: string[] = [];
  const schemeSource = pkg.sources.find((s) => s.title.includes("Procedure"));
  const schemeLabel = schemeSource ? schemeSource.label : s1;

  if (pkg.steps && pkg.steps.length > 0) {
    for (const step of pkg.steps.slice(0, 3)) {
      next_steps.push(`${step.text} [${schemeLabel}]`);
    }
  }

  return {
    headline,
    points,
    next_steps,
  };
}

export async function generateAnswerProse(
  question: string,
  pkg: EvidencePackage,
  language: string = "en"
): Promise<GeneratedProse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (process.env.GENERATION === "none" || (!geminiKey && !groqKey)) {
    return generateEvidenceOnlyProse(pkg, language);
  }

  const systemPrompt = `You write answers for BISVEDA, an assistant for Indian Standards and BIS certification.
You will receive: the user's question, the answer language, and an EVIDENCE PACKAGE.
Rules:
1. Use ONLY facts in the EVIDENCE PACKAGE. If a fact is not there, do not say it.
2. After every sentence that states a fact, add the label of the source it came from, like [S1] or [S1][S3].
3. Copy every number, unit, date, percentage and IS number exactly as written in the source. Never compute or round.
4. Never mention a standard that is not in the package's 'standards' list.
5. Do not say whether certification is mandatory; the package already states 'qco_status' and the UI shows it.
6. Plain language for small businesses and consumers. Short sentences. No legal jargon. No marketing words.
7. Write in ${language}. Keep IS numbers, clause numbers and [S#] labels unchanged.
Return JSON only:
{
  "headline": "one sentence, max 25 words, directly answers the question, with [S#]",
  "points": ["2 to 4 short sentences with [S#] each, the key facts"],
  "next_steps": ["0 to 4 short imperative steps with [S#] each, only if steps are in the package"]
}`;

  const userPayload = JSON.stringify({
    question,
    answer_language: language,
    package: {
      primary_standard: pkg.primary_standard,
      standards: pkg.standards,
      qco_status: pkg.qco_status,
      scheme: pkg.scheme,
      steps: pkg.steps,
      labs_count: pkg.labs_count,
      sources: pkg.sources.map((s) => ({
        label: s.label,
        title: s.title,
        text: s.text,
      })),
    },
  });

  // Call Gemini Flash Lite or Groq with temperature 0.1
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Input:\n${userPayload}` }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
              maxOutputTokens: 500,
            },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          if (parsed.headline && Array.isArray(parsed.points)) {
            return {
              headline: parsed.headline,
              points: parsed.points,
              next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
            };
          }
        }
      }
    } catch {}
  }

  // Fallback to deterministic evidence-only template
  return generateEvidenceOnlyProse(pkg, language);
}
