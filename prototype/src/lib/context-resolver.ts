/**
 * BISVEDA Conversational Context Resolver
 * §6.7 & Phase 5: Real Conversation Memory
 *
 * Tracks active product entities, standards, and parameters across conversational turns.
 * Resolves anaphora ("iska fee kitna hai?", "tell me about this") and incremental
 * parameter refinements ("1 litre, stainless steel 304") without making the user repeat context.
 */

export interface ChatTurn {
  role: "user" | "assistant" | string;
  content: string;
}

export interface ResolvedContext {
  originalQuery: string;
  resolvedQuery: string;
  isFollowUp: boolean;
  activeStandard?: string;
  activeProduct?: string;
  activeMaterial?: string;
  activeLocation?: string;
  activeParameters: Record<string, string>;
}

/**
 * Extracts standard codes (e.g. "IS 17526", "IS 456", "IS 2347") from text.
 */
function extractStandardCodes(text: string): string[] {
  const matches = text.match(/\bIS\s*[:\s]?\s*(\d{2,6}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?)/gi);
  if (!matches) return [];
  return matches.map((m) => m.replace(/\s+/g, " ").toUpperCase());
}

/**
 * Extracts product entities and specifications from conversational history.
 */
function extractEntitiesFromHistory(history: ChatTurn[]): {
  standards: string[];
  productKeywords: string[];
  materials: string[];
  locations: string[];
} {
  const standards: string[] = [];
  const productKeywords: string[] = [];
  const materials: string[] = [];
  const locations: string[] = [];

  const knownProducts = [
    "stainless steel water bottles",
    "stainless steel water bottle",
    "stainless steel bottles",
    "stainless steel bottle",
    "steel water bottles",
    "steel water bottle",
    "steel bottles",
    "steel bottle",
    "water bottles",
    "water bottle",
    "vacuum flasks",
    "vacuum flask",
    "pressure cookers",
    "pressure cooker",
    "motorcycle helmets",
    "motorcycle helmet",
    "safety helmets",
    "safety helmet",
    "helmets",
    "helmet",
    "gold jewellery",
    "packaged drinking water",
    "mineral water",
    "drinking water",
    "pvc cable",
    "electrical wire",
    "tmt bar",
    "lithium battery",
    "lithium ion battery",
    "cement",
    "led driver",
    "led bulb",
    "toys",
    "toy",
    "solar panel",
    "solar module",
    "distribution transformer",
    "transformer",
    "fire extinguisher",
    "medical device",
    "footwear",
    "leather footwear",
    "safety shoe",
    "shoes",
    "plywood",
    "sanitary napkin",
    "wheel rim",
    "gas cylinder",
    "lpg stove",
    "air conditioner",
    "refrigerator",
    "paints",
  ];

  const knownMaterials = [
    "stainless steel",
    "ss 304",
    "aisi 304",
    "aisi 316",
    "aluminium",
    "pet",
    "plastic",
    "copper",
    "polycarbonate",
  ];

  const knownCities = ["nagpur", "pune", "mumbai", "delhi", "lucknow", "chennai", "kolkata", "bengaluru", "hyderabad", "ahmedabad", "jaipur"];

  for (const turn of history) {
    if (!turn || typeof turn.content !== "string") continue;
    const textLower = turn.content.toLowerCase();

    // Extract standards
    const foundStds = extractStandardCodes(turn.content);
    for (const s of foundStds) {
      if (!standards.includes(s)) standards.push(s);
    }

    // Extract products
    for (const p of knownProducts) {
      if (textLower.includes(p) && !productKeywords.includes(p)) {
        productKeywords.push(p);
      }
    }

    // Extract materials
    for (const m of knownMaterials) {
      if (textLower.includes(m) && !materials.includes(m)) {
        materials.push(m);
      }
    }

    // Extract cities
    for (const c of knownCities) {
      const reg = new RegExp(`\\b${c}\\b`, "i");
      if (reg.test(textLower) && !locations.includes(c)) {
        locations.push(c);
      }
    }
  }

  return { standards, productKeywords, materials, locations };
}

/**
 * Resolves anaphoric expressions and incremental follow-up parameters.
 */
export function resolveConversationalContext(
  currentQuery: string,
  history: ChatTurn[] = []
): ResolvedContext {
  const trimmed = currentQuery.trim();
  const qLower = trimmed.toLowerCase();

  // If no history, return clean query
  if (!history || history.length === 0) {
    return {
      originalQuery: trimmed,
      resolvedQuery: trimmed,
      isFollowUp: false,
      activeParameters: {},
    };
  }

  const { standards, productKeywords, materials, locations } = extractEntitiesFromHistory(history);
  const activeStandard = standards.slice(-1)[0];
  const activeProduct = productKeywords[0];
  const activeMaterial = materials[0];
  const activeLocation = locations[0];

  // Follow-up patterns:
  // 1. Anaphora / demonstrative pronouns: "this", "it", "that", "iska", "iske"
  const hasAnaphora = /\b(?:this|that|it|these|iska|iske|iski|same|above|aforesaid)\b/i.test(trimmed);

  // 2. Short sub-questions without explicit product noun:
  // "what certification do i need?", "where can i test?", "is it mandatory?", "what is the fee?"
  const isSubQuestion =
    /^(?:what|which|how|where|is|can|show|list|give|tell|find|compare|check|explain|verify|does|do|why|are)\b/i.test(trimmed) &&
    !knownContainsProduct(trimmed) &&
    (Boolean(activeProduct) || Boolean(activeStandard));

  // 3. Incremental parameter declarations:
  // "1 litre, stainless steel 304", "capacity 500ml", "only grade 316", "nagpur"
  const isParameterRefinement =
    trimmed.split(" ").length <= 7 &&
    /\b(?:litre|liter|ml|aisi|304|316|grade|capacity|mm|kg|thickness|diameter|msme|nagpur|pune|mumbai)\b/i.test(
      trimmed
    ) &&
    !knownContainsProduct(trimmed) &&
    (Boolean(activeProduct) || Boolean(activeStandard));

  // 4. Clarification or follow-up like "tell me about this"
  const isVagueFollowUp =
    /^(?:tell me about (?:this|it)|explain (?:this|it)|details?|more info|what about (?:this|it))\b/i.test(trimmed);

  const isFollowUp = hasAnaphora || isSubQuestion || isParameterRefinement || isVagueFollowUp;

  if (!isFollowUp || (!activeProduct && !activeStandard)) {
    return {
      originalQuery: trimmed,
      resolvedQuery: trimmed,
      isFollowUp: false,
      activeStandard,
      activeProduct,
      activeMaterial,
      activeLocation,
      activeParameters: {},
    };
  }

  // Construct context-enriched rewritten query
  let enriched = trimmed;
  const contextSubject = activeProduct
    ? activeStandard
      ? `${activeProduct} under ${activeStandard}`
      : activeProduct
    : activeStandard || "";

  if (isVagueFollowUp || trimmed === "tell me about this" || trimmed === "tell me about it") {
    enriched = `Provide statutory scope, citable testing clauses, and certification requirements for ${contextSubject}`;
  } else if (hasAnaphora) {
    // Replace "this" / "it" with contextSubject
    enriched = trimmed.replace(/\b(?:this|it|that|iska|iske|iski)\b/gi, contextSubject);
  } else if (isParameterRefinement) {
    enriched = `Requirements and testing specifications for ${trimmed} ${contextSubject}`;
  } else if (isSubQuestion) {
    const qLower = trimmed.toLowerCase();
    if (/\b(?:test|clause|testing|sti|sampling|specimen|parameter|limit|rigidity)\b/i.test(qLower)) {
      enriched = `${trimmed} for ${contextSubject} (testing clauses, STI requirements, and mandatory test methods)`;
    } else if (/\b(?:where|lab|laboratory|facility|test center|nabl)\b/i.test(qLower)) {
      enriched = `${trimmed} for ${contextSubject} (recognized testing laboratories, NABL & BIS test facilities)`;
    } else if (/\b(?:mandatory|qco|order|gazette|penalty|penal|legal|compulsory|fine|imprisonment)\b/i.test(qLower)) {
      enriched = `${trimmed} for ${contextSubject} (mandatory QCO gazette notification and Section 29 legal penalties)`;
    } else if (/\b(?:fee|cost|price|subsidy|concession|discount|expense|marking fee)\b/i.test(qLower)) {
      enriched = `${trimmed} for ${contextSubject} (certification fee schedule, MSME 80% fee concession, and application charges)`;
    } else if (/\b(?:scheme|certif|licen|apply|process|procedure|form|manakonline)\b/i.test(qLower)) {
      enriched = `${trimmed} for ${contextSubject} (Scheme-I certification process, licensing procedure, and Manak Online application)`;
    } else {
      enriched = `${trimmed} for ${contextSubject}`;
    }
  }

  // If previous location was established and current query asks where to test
  if (activeLocation && /\b(?:where|lab|testing)\b/i.test(enriched) && !enriched.toLowerCase().includes(activeLocation)) {
    enriched = `${enriched} near ${activeLocation}`;
  }

  return {
    originalQuery: trimmed,
    resolvedQuery: enriched,
    isFollowUp: true,
    activeStandard,
    activeProduct,
    activeMaterial,
    activeLocation,
    activeParameters: {
      standard: activeStandard || "",
      product: activeProduct || "",
    },
  };
}

function knownContainsProduct(text: string): boolean {
  const products = [
    "bottle",
    "flask",
    "cooker",
    "helmet",
    "jewellery",
    "jewelry",
    "water",
    "cable",
    "wire",
    "cement",
    "rebar",
    "battery",
    "driver",
    "bulb",
    "toy",
    "solar",
    "panel",
    "transformer",
    "extinguisher",
    "footwear",
    "shoe",
    "plywood",
    "stove",
    "cylinder",
    "refrigerator",
    "conditioner",
    "paint",
    "napkin",
  ];
  const t = text.toLowerCase();
  return products.some((p) => t.includes(p));
}
