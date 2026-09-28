/**
 * BISVEDA — Language helpers (lib/i18n.ts, P11.1)
 *
 * Language tags are BCP-47-ish: "en", "hi", "mr", "ta" for native script, and
 * "hi-Latn" / "mr-Latn" when an Indic language is typed in Roman letters.
 *
 * Static UI-ish strings (greeting, refusals, follow-ups) are hand-written for
 * English, Hindi and Marathi. Every other language goes through one cached
 * fast-model translation. A translation is rejected (English is kept) if it
 * introduces a number that is not in the source, so figures can never drift.
 */

import { groqChat } from "./llm";
import { parseLanguageTag, toAsciiDigits, ScriptKind } from "./pipeline/normalize";

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  ur: "Urdu",
  as: "Assamese",
};

const NATIVE_SCRIPT_NAMES: Record<string, string> = {
  hi: "Devanagari",
  mr: "Devanagari",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Gurmukhi",
  or: "Odia",
  ur: "Urdu (Nastaliq/Arabic)",
  as: "Assamese (Bengali-Assamese)",
};

export function baseLanguage(tag: string | undefined): string {
  return parseLanguageTag(tag).language;
}

export function isEnglish(tag: string | undefined): boolean {
  return baseLanguage(tag) === "en";
}

/** Normalizes whatever the LLM returned ("Marathi", "mr", "mr-Latn", script "roman") into our tag. */
export function coerceLanguageTag(language: unknown, script: unknown, fallback = "en"): string {
  if (typeof language !== "string" || !language.trim()) return fallback;
  const raw = language.trim().toLowerCase();
  const byName = Object.entries(LANGUAGE_NAMES).find(([, name]) => name.toLowerCase() === raw)?.[0];
  const base = byName || raw.split(/[-_]/)[0];
  if (!/^[a-z]{2,3}$/.test(base)) return fallback;
  if (base === "en") return "en";
  const roman = /latn|roman|latin/i.test(raw) || (typeof script === "string" && /roman|latin/i.test(script));
  return roman ? `${base}-Latn` : base;
}

/** Instruction line for answer prompts. */
export function languageInstruction(tag: string | undefined): string {
  const { language, script } = parseLanguageTag(tag);
  if (language === "en") return "English";
  const name = LANGUAGE_NAMES[language] || language;
  if (script === "roman") {
    return `${name}, written in Roman letters (transliterated, exactly the way the user typed it — e.g. Hinglish)`;
  }
  return `${name}, written in ${NATIVE_SCRIPT_NAMES[language] || "its native"} script`;
}

// ── Hand-written strings (native script) ───────────────────────────────────

type Table = { en: string; hi: string; mr: string };

const STATIC: Record<string, Table> = {
  greeting: {
    en: "Hello! I am BISVEDA. I can help you find Indian Standards, check if BIS certification is mandatory, and locate recognized testing laboratories. Which product are you asking about?",
    hi: "नमस्ते! मैं BISVEDA हूँ। आप भारतीय मानकों (Indian Standards), BIS प्रमाणीकरण (Certification) या परीक्षण प्रयोगशालाओं (Testing Labs) के बारे में पूछ सकते हैं। आप किस उत्पाद के बारे में जानना चाहते हैं?",
    mr: "नमस्कार! मी BISVEDA आहे. मी तुम्हाला भारतीय मानके (Indian Standards) शोधण्यास, BIS प्रमाणन अनिवार्य आहे का ते तपासण्यास आणि मान्यताप्राप्त चाचणी प्रयोगशाळा शोधण्यास मदत करू शकतो. तुम्ही कोणत्या उत्पादनाबद्दल विचारत आहात?",
  },
  out_of_scope: {
    en: "This inquiry is outside the scope of the Bureau of Indian Standards (BIS) and Indian Standards. BISVEDA provides guidance on product standards, mandatory Quality Control Orders (QCOs), certification schemes, and recognized testing laboratories.",
    hi: "यह प्रश्न भारतीय मानक ब्यूरो (BIS) और भारतीय मानकों के दायरे से बाहर है। BISVEDA उत्पाद मानकों, अनिवार्य गुणवत्ता नियंत्रण आदेशों (QCO), प्रमाणन योजनाओं और मान्यताप्राप्त परीक्षण प्रयोगशालाओं के बारे में मार्गदर्शन देता है।",
    mr: "हा प्रश्न भारतीय मानक ब्युरो (BIS) आणि भारतीय मानकांच्या कक्षेबाहेरचा आहे. BISVEDA उत्पादन मानके, अनिवार्य गुणवत्ता नियंत्रण आदेश (QCO), प्रमाणन योजना आणि मान्यताप्राप्त चाचणी प्रयोगशाळा यांबद्दल मार्गदर्शन करते.",
  },
  gibberish: {
    en: "The entered text does not appear to be a recognizable query. Please ask about a product, standard, or BIS certification service.",
    hi: "दर्ज किया गया पाठ समझ में आने योग्य प्रश्न नहीं लगता। कृपया किसी उत्पाद, मानक या BIS प्रमाणन सेवा के बारे में पूछें।",
    mr: "टाकलेला मजकूर ओळखता येईल असा प्रश्न वाटत नाही. कृपया एखादे उत्पादन, मानक किंवा BIS प्रमाणन सेवेबद्दल विचारा.",
  },
  not_in_sources: {
    en: "We couldn't find this in the documents we hold.",
    hi: "हमारे पास मौजूद दस्तावेज़ों में इसका उत्तर नहीं मिला।",
    mr: "आमच्याकडे असलेल्या दस्तऐवजांमध्ये हे आढळले नाही.",
  },
  covers: {
    en: "Our knowledge base currently covers:",
    hi: "हमारा ज्ञान-आधार अभी इन मानकों को कवर करता है:",
    mr: "आमचा ज्ञानसंचय सध्या पुढील मानके समाविष्ट करतो:",
  },
  fu_helmet: {
    en: "Which standard applies to motorcycle helmets?",
    hi: "दोपहिया हेलमेट के लिए कौन सा मानक है?",
    mr: "दुचाकी हेल्मेटसाठी कोणते मानक लागू आहे?",
  },
  fu_gold: {
    en: "What are the gold hallmarking grades?",
    hi: "सोने की शुद्धता और हॉलमार्किंग कैसे जांचें?",
    mr: "सोन्याची शुद्धता आणि हॉलमार्किंग कसे तपासावे?",
  },
  fu_labs: {
    en: "Where is the nearest BIS testing lab?",
    hi: "निकटतम BIS परीक्षण लैब खोजें",
    mr: "जवळची BIS चाचणी प्रयोगशाळा शोधा",
  },
  helpline_prompt: {
    en: "Connect directly with the official BISVEDA Voice Helpline over phone.",
    hi: "आप BISVEDA वॉयस हेल्पलाइन से सीधे फोन पर बात कर सकते हैं।",
    mr: "तुम्ही BISVEDA व्हॉइस हेल्पलाइनशी थेट फोनवर बोलू शकता.",
  },
  helpline_text: {
    en: "### 📞 BISVEDA Voice Helpline Assistance\n\nYou can speak directly with our AI voice assistant over telephone regarding Indian Standards, ISI mark verification, QCO requirements, or testing laboratories.\n\nPlease enter your **10-digit mobile number** below — you will receive a call shortly.",
    hi: "### 📞 BISVEDA वॉयस हेल्पलाइन सहायता\n\nआप भारतीय मानकों, ISI मार्क सत्यापन, QCO अनिवार्यताओं अथवा परीक्षण प्रयोगशालाओं के संबंध में सीधे फोन कॉल पर हमारे AI वॉयस सहायक से बात कर सकते हैं।\n\nकृपया नीचे अपना **10-अंकीय मोबाइल नंबर** दर्ज करें — आपको कुछ ही क्षणों में कॉल प्राप्त होगी।",
    mr: "### 📞 BISVEDA व्हॉइस हेल्पलाइन सहाय्य\n\nभारतीय मानके, ISI मार्क पडताळणी, QCO आवश्यकता किंवा चाचणी प्रयोगशाळा यांबाबत तुम्ही आमच्या AI व्हॉइस सहाय्यकाशी थेट फोन कॉलवर बोलू शकता.\n\nकृपया खाली तुमचा **10-अंकी मोबाइल नंबर** टाका — तुम्हाला थोड्याच वेळात कॉल येईल.",
  },
};

export type StaticKey = keyof typeof STATIC;

const cache = new Map<string, string>();

const REVERSE = new Map<string, string>(Object.entries(STATIC).map(([k, row]) => [row.en, k]));

function handWritten(key: string, language: string): string | undefined {
  const row = STATIC[key];
  if (!row) return undefined;
  if (language === "hi") return row.hi;
  if (language === "mr") return row.mr;
  return undefined;
}

function digitRuns(s: string): string[] {
  return toAsciiDigits(s).match(/\d+/g) || [];
}

/** True when `translated` introduces no digit run that `source` doesn't contain. */
function numbersPreserved(source: string, translated: string): boolean {
  const allowed = new Set(digitRuns(source));
  return digitRuns(translated).every((d) => allowed.has(d));
}

/**
 * Translates `text` into the user's language/script. Returns the original text if the
 * language is English, the LLM is unavailable, or the translation fails the number check.
 */
export async function translateTo(text: string, tag: string | undefined, hintKey?: string): Promise<string> {
  const { language, script } = parseLanguageTag(tag);
  if (language === "en" || !text.trim()) return text;

  const native = handWritten(hintKey ?? REVERSE.get(text) ?? "", language);
  if (native && script === "native") return native;

  const cacheKey = `${language}|${script}|${text}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  if (!process.env.GROQ_API_KEY) return script === "native" ? native || text : text;

  try {
    const out = await groqChat(
      [
        {
          role: "system",
          content:
            `You translate short product-guidance text into ${languageInstruction(tag)}. ` +
            "Keep markdown structure (headings, bullets, bold), URLs, [S#] labels, IS standard numbers, digits and product/scheme names (BIS, ISI, HUID, QCO, Form I, Manak Online, BIS Care, CM/L) unchanged. " +
            "Names of people, firms, places, laboratories and addresses stay exactly as written. Do not add or remove information. " +
            (script === "roman" ? "Use ONLY Latin letters a-z — never any native-script characters. " : "") +
            "Output the translation only.",
        },
        { role: "user", content: text },
      ],
      { model: "chat", temperature: 0, maxTokens: 1800, timeoutMs: 20000 }
    );
    const cleaned = out.trim();
    // A Roman-letters request must come back in Roman letters only (no stray native-script words).
    const scriptOk = script !== "roman" || !/[ऀ-෿؀-ۿ]/.test(cleaned);
    if (cleaned.length > 0 && scriptOk && numbersPreserved(text, cleaned)) {
      cache.set(cacheKey, cleaned);
      return cleaned;
    }
  } catch (err) {
    console.warn("[i18n] translation failed, keeping fallback:", err instanceof Error ? err.message : err);
  }
  return script === "native" ? native || text : text;
}

/** Returns the hand-written / translated version of a static string. */
export async function tStatic(key: StaticKey, tag: string | undefined): Promise<string> {
  return translateTo(STATIC[key].en, tag, key);
}

export async function translateMany(texts: string[], tag: string | undefined): Promise<string[]> {
  if (isEnglish(tag)) return texts;
  return Promise.all(texts.map((t) => translateTo(t, tag)));
}

export type { ScriptKind };
