/**
 * BISVEDA Conversational Intent Router
 * Axiom A3 & Intent Gate Policy:
 * Fast-path (<20ms) for greetings, small talk, gratitude, and clarification traps
 * BEFORE the full research & regulatory retrieval pipeline.
 *
 * Distinguishes:
 * - GREETING / SMALL TALK -> Conversational response with starter actions
 * - GRATITUDE / THANKS -> Courteous sign-off response
 * - VAGUE QUERY -> Structured product scope clarification
 * - EXACT LOOKUP -> Deterministic identifier resolution
 * - NORMAL INFORMATION QUERY -> Standard retrieval pipeline
 * - COMPLEX RESEARCH QUERY -> Full governed compliance flow
 */

export type QueryIntent =
  | "greeting"
  | "thanks"
  | "small_talk"
  | "vague_clarification"
  | "exact_lookup"
  | "standards_query"
  | "complex_research";

export interface StarterAction {
  id: string;
  label: string;
  icon: string;
  query: string;
}

export interface ClarificationOption {
  id: string;
  label: string;
  standardNumber: string;
  description: string;
}

export interface IntentGateResult {
  intent: QueryIntent;
  isConversational: boolean;
  conversationalResponse?: string;
  starterActions?: StarterAction[];
  clarificationRequired?: boolean;
  clarificationTopic?: string;
  clarificationPrompt?: string;
  clarificationOptions?: ClarificationOption[];
  exactIdentifier?: {
    type: "IS_STANDARD" | "CML_LICENSE" | "HUID_HALLMARK" | "QCO_ORDER";
    identifier: string;
  };
}

export const STARTER_ACTIONS: StarterAction[] = [
  {
    id: "act-standard",
    label: "Find the right BIS standard",
    icon: "🔍",
    query: "Find the applicable Indian Standard for stainless steel water bottles",
  },
  {
    id: "act-qco",
    label: "Check mandatory certification requirements",
    icon: "📋",
    query: "Is BIS ISI mark certification mandatory for pressure cookers under QCO?",
  },
  {
    id: "act-labs",
    label: "Find recognized testing laboratories",
    icon: "🧪",
    query: "Find BIS recognized testing laboratories for helmets near Nagpur",
  },
  {
    id: "act-verify",
    label: "Verify an ISI / CM-L mark",
    icon: "🛡️",
    query: "How do I verify a BIS CM/L licence number and ISI mark authenticity?",
  },
  {
    id: "act-compare",
    label: "Compare standards",
    icon: "⚖️",
    query: "Compare IS 2347:2006 vs IS 2347:2017 pressure cooker standards",
  },
];

// Product disambiguation mappings for vague single-word/short queries
const VAGUE_PRODUCT_CLARIFICATIONS: Record<
  string,
  { topic: string; options: ClarificationOption[] }
> = {
  "water bottle": {
    topic: "Water Bottle",
    options: [
      {
        id: "ss-bottle",
        label: "Stainless Steel Vacuum Flask / Bottle",
        standardNumber: "IS 17526:2021",
        description: "Double-walled vacuum insulated flasks & containers under mandatory DPIIT Cookware QCO.",
      },
      {
        id: "pet-bottle",
        label: "Plastic / PET Bottle",
        standardNumber: "IS 15410:2003",
        description: "Polyethylene Terephthalate (PET) containers for packaging drinking water & liquids.",
      },
      {
        id: "packaged-water",
        label: "Packaged Drinking Water (Plant & Water)",
        standardNumber: "IS 14543:2024",
        description: "Mandatory certification for packaged drinking water manufacturing & bottling plants.",
      },
      {
        id: "glass-bottle",
        label: "Glass Bottles / Containers",
        standardNumber: "IS 1107:1986",
        description: "Glass bottles for food and beverage packaging.",
      },
    ],
  },
  bottle: {
    topic: "Bottle",
    options: [
      {
        id: "ss-bottle",
        label: "Stainless Steel Insulated Bottle / Flask",
        standardNumber: "IS 17526:2021",
        description: "Metallic vacuum insulated bottles (Scheme-I ISI mark).",
      },
      {
        id: "pet-bottle",
        label: "Plastic PET Container for Liquids",
        standardNumber: "IS 15410:2003",
        description: "Food-grade polymer containers for water packaging.",
      },
    ],
  },
  cooker: {
    topic: "Pressure Cooker",
    options: [
      {
        id: "domestic-cooker",
        label: "Domestic Pressure Cooker (Aluminium / Stainless Steel)",
        standardNumber: "IS 2347:2017",
        description: "Mandatory QCO certification covering thermal safety, burst pressure, and safety valve.",
      },
      {
        id: "electric-cooker",
        label: "Electric Rice Cooker / Multi-Cooker",
        standardNumber: "IS 302-2-15",
        description: "Safety of household electric appliances under compulsory certification.",
      },
    ],
  },
  helmet: {
    topic: "Protective Helmet",
    options: [
      {
        id: "two-wheeler-helmet",
        label: "Helmet for Two-Wheeler Riders",
        standardNumber: "IS 4151:2020",
        description: "Mandatory safety helmet for motorcycle riders under MoRTH QCO.",
      },
      {
        id: "industrial-helmet",
        label: "Industrial Safety Helmet",
        standardNumber: "IS 2925:1984",
        description: "Helmets for industrial workers and construction sites.",
      },
    ],
  },
  cement: {
    topic: "Cement",
    options: [
      {
        id: "opc-43",
        label: "Ordinary Portland Cement (43 Grade)",
        standardNumber: "IS 8112:2013",
        description: "Mandatory Scheme-I certification for civil construction cement.",
      },
      {
        id: "opc-53",
        label: "Ordinary Portland Cement (53 Grade)",
        standardNumber: "IS 12269:2013",
        description: "High-strength ordinary portland cement.",
      },
      {
        id: "ppc",
        label: "Portland Pozzolana Cement",
        standardNumber: "IS 1489 (Part 1)",
        description: "Flyash-based Portland Pozzolana cement.",
      },
    ],
  },
  wire: {
    topic: "Electrical Wire & Cable",
    options: [
      {
        id: "pvc-cables",
        label: "PVC Insulated Cables for Working Voltages up to 1100 V",
        standardNumber: "IS 694:2010",
        description: "Mandatory electrical wire standard for domestic and commercial wiring.",
      },
      {
        id: "elastomer-cables",
        label: "Elastomer Insulated Cables",
        standardNumber: "IS 9968 (Part 1)",
        description: "Heavy duty flexible cables for industrial equipment.",
      },
    ],
  },
  cable: {
    topic: "Electrical Cable",
    options: [
      {
        id: "pvc-cables",
        label: "PVC Insulated Domestic Cables",
        standardNumber: "IS 694:2010",
        description: "Mandatory QCO certification for household electrical wire.",
      },
    ],
  },
  battery: {
    topic: "Battery & Cells",
    options: [
      {
        id: "lithium-ion",
        label: "Secondary Lithium Cells & Batteries (Mobile / Portable)",
        standardNumber: "IS 16046 (Part 2):2018",
        description: "Mandatory CRS Scheme-II registration under MeitY electronics order.",
      },
      {
        id: "lead-acid",
        label: "Stationary Lead-Acid Batteries",
        standardNumber: "IS 1651:2013",
        description: "Industrial and automotive storage batteries under Scheme-I.",
      },
    ],
  },
  toy: {
    topic: "Safety of Toys",
    options: [
      {
        id: "toys-mechanical",
        label: "Mechanical & Physical Properties of Toys",
        standardNumber: "IS 9873 (Part 1):2019",
        description: "Mandatory Toys Quality Control Order covering children's play equipment.",
      },
      {
        id: "toys-chemicals",
        label: "Migration of Certain Elements in Toys",
        standardNumber: "IS 9873 (Part 3):2020",
        description: "Heavy metal toxicity testing for child safety.",
      },
    ],
  },
};

/**
 * Evaluates the query at the intent gate BEFORE any regulatory retrieval runs.
 */
export function routeConversationalIntent(query: string): IntentGateResult {
  const trimmed = query.trim();
  const qLower = trimmed.toLowerCase();
  const qClean = qLower.replace(/[?!.,;:]/g, "").replace(/\s+/g, " ").trim();

  // 1. GIBBERISH DETECTOR (<10ms)
  const isGibberish = (() => {
    if (qClean.length < 4) return false;
    // Repeated character spam (e.g. "aaaaaa", "zzzzzz")
    if (/^(.)\1{3,}$/.test(qClean)) return true;
    // Common keyboard mash sequences
    if (/^(?:asdf|ghjk|qwerty|zxcvbn|poiuy|lkjhg)/i.test(qClean)) return true;
    // Word length >= 6 with no vowels and not an official code
    if (!/\bIS\s*\d/i.test(trimmed) && !/\bCM\/?L/i.test(trimmed)) {
      const words = qClean.split(/\s+/);
      if (words.some((w) => w.length >= 6 && !/[aeiouy]/i.test(w))) {
        return true;
      }
    }
    // High non-alphanumeric symbol ratio
    const nonAlpha = qClean.replace(/[a-zA-Z0-9\s]/g, "").length;
    if (qClean.length >= 8 && nonAlpha / qClean.length > 0.45) return true;
    return false;
  })();

  if (isGibberish) {
    return {
      intent: "small_talk",
      isConversational: true,
      conversationalResponse:
        "I could not understand your query. BISVEDA provides authoritative guidance on Indian Standards (IS), mandatory Quality Control Orders (QCOs), and BIS laboratory testing.\n\nPlease enter a specific product name (e.g., *'stainless steel water bottle'*, *'motorcycle helmet'*) or an Indian Standard code (e.g., *'IS 4151'*) to proceed.",
      starterActions: STARTER_ACTIONS,
    };
  }

  // 2. GREETING & FAREWELL PATTERNS
  const greetingExact = [
    "hi",
    "hello",
    "hey",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "namaste",
    "namaskar",
    "pranam",
    "kem cho",
    "kya hal hai",
    "kya hal",
    "hi bisveda",
    "hello bisveda",
    "hey bisveda",
    "bye",
    "goodbye",
    "alvida",
    "see you",
  ];

  if (
    greetingExact.includes(qClean) ||
    /^(?:hi|hello|hey|namaste|pranam)\s+(?:there|all|team|bot|assistant|bisveda)$/i.test(qClean)
  ) {
    return {
      intent: "greeting",
      isConversational: true,
      conversationalResponse:
        "Hello! I'm **BISVEDA**, your authoritative AI assistant for Indian Standards and Bureau of Indian Standards (BIS) conformity assessment services.\n\nHow can I help you today? You can select a topic below or type your specific product query:",
      starterActions: STARTER_ACTIONS,
    };
  }

  // 3. GRATITUDE / THANKS PATTERNS
  const thanksPatterns = [
    "thanks",
    "thank you",
    "thank u",
    "thx",
    "dhanyawad",
    "shukriya",
    "many thanks",
    "thanks a lot",
    "thank you so much",
    "thanks for your help",
    "ok thanks",
    "okay thanks",
  ];

  if (thanksPatterns.includes(qClean) || /^(?:thank\s*you|thanks|dhanyawad)\b/i.test(qClean)) {
    return {
      intent: "thanks",
      isConversational: true,
      conversationalResponse:
        "You're very welcome! If you need any further assistance regarding Indian Standards, testing laboratories, mandatory Quality Control Orders (QCOs), or Scheme-I / CRS licensing, feel free to ask at any time.",
    };
  }

  // 4. SMALL TALK / IDENTITY / HELP
  if (
    [
      "who are you",
      "what is bisveda",
      "what can you do",
      "what are you",
      "help",
      "how to use",
      "how do i use this",
      "menu",
      "options",
      "what do you do",
      "aap kaun ho",
      "kya kar sakte ho",
    ].includes(qClean)
  ) {
    return {
      intent: "small_talk",
      isConversational: true,
      conversationalResponse:
        "I am **BISVEDA** (Bureau of Indian Standards Virtual Expert & Document Assistant).\n\nI assist manufacturers, MSMEs, startups, testing laboratories, and consumers with:\n- **Indian Standards Lookup:** Finding the exact IS standard for your product\n- **Regulatory Applicability:** Determining mandatory Quality Control Orders (QCOs)\n- **Certification Schemes:** Step-by-step guidance for Scheme-I (ISI Mark) and Scheme-II (CRS)\n- **Testing & Clauses:** STI testing parameters, required factory equipment, and sample sizes\n- **Recognized Labs:** Locating nearest BIS/NABL testing facilities ranked by geographic distance\n- **MSME Subsidies:** Calculating 80% application and annual fee concessions for Udyam holders",
      starterActions: STARTER_ACTIONS,
    };
  }

  // 5. EXACT IDENTIFIER CHECK (<50ms)
  // ONLY for standalone code queries like "IS 456", "IS 4151", "CM/L 1234567", "HUID ABC123".
  // Conversational questions ("tell me about IS 4151", "what are the clauses in IS 456") flow to RAG pipeline.
  const isMatch = trimmed.match(/\b(IS\s*[:\s]?\s*\d{1,5}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?)\b/i);
  const cmlMatch = trimmed.match(/\b(?:cml|cm\/l)\s*[-:]?\s*(\d{7,8})\b/i);
  const huidMatch = trimmed.match(/\b(?:huid|hallmark)\s*[-:]?\s*([A-Z0-9]{6})\b/i);

  const wordCount = trimmed.split(/\s+/).length;
  const isConversationalQuestion =
    wordCount > 3 ||
    /\b(tell|about|explain|describe|requirement|requirements|what|how|why|which|can|should|detail|details|scope|clause|clauses|test|testing|lab|fee|mandate|mandatory|qco)\b/i.test(trimmed);

  if (cmlMatch && wordCount <= 3) {
    return {
      intent: "exact_lookup",
      isConversational: false,
      exactIdentifier: {
        type: "CML_LICENSE",
        identifier: cmlMatch[1],
      },
    };
  }

  if (huidMatch && wordCount <= 3) {
    return {
      intent: "exact_lookup",
      isConversational: false,
      exactIdentifier: {
        type: "HUID_HALLMARK",
        identifier: huidMatch[1].toUpperCase(),
      },
    };
  }

  if (isMatch && !isConversationalQuestion && wordCount <= 3) {
    return {
      intent: "exact_lookup",
      isConversational: false,
      exactIdentifier: {
        type: "IS_STANDARD",
        identifier: isMatch[1].replace(/\s+/g, " ").toUpperCase(),
      },
    };
  }

  // 6. VAGUE SINGLE/DOUBLE-WORD PRODUCT CHECK
  // Single generic product terms without verbs or specifications require clarification
  const normalizedWords = qClean.split(" ").filter(Boolean);
  if (normalizedWords.length <= 2 && !isConversationalQuestion) {
    const candidateTerm = qClean;
    const clarification = VAGUE_PRODUCT_CLARIFICATIONS[candidateTerm] ||
      Object.entries(VAGUE_PRODUCT_CLARIFICATIONS).find(([key]) => candidateTerm === key || candidateTerm === `${key}s`)?.[1];

    if (clarification) {
      return {
        intent: "vague_clarification",
        isConversational: false,
        clarificationRequired: true,
        clarificationTopic: clarification.topic,
        clarificationPrompt: `To identify the governing Indian Standard and statutory certification requirements for **"${clarification.topic}"**, please select your specific product scope below:`,
        clarificationOptions: clarification.options,
      };
    }

    // Generic vague noun check
    const genericVagueNouns = ["pipe", "tube", "steel", "glass", "plastic", "food", "shoe", "iron", "bar", "valve"];
    if (genericVagueNouns.includes(qClean) || (normalizedWords.length === 1 && genericVagueNouns.some((n) => qClean.includes(n)))) {
      return {
        intent: "vague_clarification",
        isConversational: false,
        clarificationRequired: true,
        clarificationTopic: trimmed,
        clarificationPrompt: `The product scope **"${trimmed}"** covers multiple Indian Standards and manufacturing categories. Could you please specify:\n1. The exact material or substrate (e.g., mild steel, PVC, HDPE)\n2. The intended application or capacity\n3. Whether you are manufacturing, importing, or testing?`,
      };
    }
  }

  // 7. COMPLEX RESEARCH VS NORMAL STANDARDS QUERY (Full RAG Pipeline)
  const isComplex =
    (/\b(?:manufactur|factory|plant|import|msme|startup|nagpur|pune|delhi|mumbai|lucknow|chennai|hyderabad)\b/i.test(trimmed) &&
      /\b(?:mandatory|qco|scheme|certif|test|where|cost|fee)\b/i.test(trimmed)) ||
    trimmed.split(" ").length >= 10;

  return {
    intent: isComplex ? "complex_research" : "standards_query",
    isConversational: false,
  };
}
