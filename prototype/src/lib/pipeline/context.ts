/**
 * BISVEDA V9 — Stage 3: Context Resolver (lib/pipeline/context.ts)
 * 
 * Manages conversation-scoped state strictly keyed by conversation_id.
 * Enforces:
 *  - Topic Shift Detection: Clears active_standards when product shifts (fixes B1)
 *  - Follow-up Inheritance: Passes active_product & active_standards if follow-up names no product
 *  - Strict Isolation: Zero leakage from global variables or localStorage
 */

export interface ConversationTurn {
  query: string;
  response?: any;
}

export interface ConversationContext {
  conversationId: string;
  activeProduct: string | null;
  activeStandards: string[]; // Canonical IDs e.g. ['IS 4151']
  topicShiftDetected: boolean;
  isFollowUp: boolean;
}

const KNOWN_PRODUCT_TERMS = [
  "helmet",
  "helmets",
  "pressure cooker",
  "cooker",
  "toy",
  "toys",
  "packaged drinking water",
  "mineral water",
  "water bottle",
  "gold jewellery",
  "jewellery",
  "hallmark",
  "power bank",
  "lithium ion",
  "battery",
  "sariya",
  "tmt",
  "steel reinforcement",
  "cement",
  "plywood",
  "gas stove",
];

function extractProductFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const p of KNOWN_PRODUCT_TERMS) {
    if (lower.includes(p)) return p;
  }
  return null;
}

export function resolveContext(
  conversationId: string,
  query: string,
  history: ConversationTurn[] = []
): ConversationContext {
  let activeProduct: string | null = null;
  let activeStandards: string[] = [];

  // Extract entities from previous turns
  if (history && history.length > 0) {
    for (const turn of history) {
      const prevProduct = extractProductFromText(turn.query);
      if (prevProduct) activeProduct = prevProduct;

      // Extract standards shown in previous response (support BisvedaResponse and legacy format)
      if (turn.response) {
        const pStd =
          turn.response.primary_standard?.id ||
          turn.response.primaryStandard?.id ||
          turn.response.primaryStandard;
        if (pStd) {
          activeStandards = [pStd];
        }
        if (turn.response.standards && Array.isArray(turn.response.standards)) {
          const stdIds = turn.response.standards.map((s: any) => s.id || s);
          if (stdIds.length > 0) {
            activeStandards = Array.from(new Set([...activeStandards, ...stdIds]));
          }
        }
      }
    }
  }

  // If no product text but active standards exist, deduce product from standard
  if (!activeProduct && activeStandards.length > 0) {
    if (activeStandards.some((s) => s.includes("4151") || s.includes("2925"))) activeProduct = "helmet";
    else if (activeStandards.some((s) => s.includes("2347"))) activeProduct = "pressure cooker";
    else if (activeStandards.some((s) => s.includes("9873") || s.includes("15644"))) activeProduct = "toys";
    else if (activeStandards.some((s) => s.includes("14543"))) activeProduct = "packaged drinking water";
    else if (activeStandards.some((s) => s.includes("1417"))) activeProduct = "gold jewellery";
    else if (activeStandards.some((s) => s.includes("16046"))) activeProduct = "power bank";
    else if (activeStandards.some((s) => s.includes("1786") || s.includes("2062"))) activeProduct = "sariya";
  }

  const currentProduct = extractProductFromText(query);
  let topicShiftDetected = false;
  let isFollowUp = false;

  if (currentProduct) {
    if (activeProduct && activeProduct !== currentProduct) {
      // Topic Shift! Reset active standards and update active product
      topicShiftDetected = true;
      activeStandards = [];
      activeProduct = currentProduct;
    } else {
      activeProduct = currentProduct;
    }
  } else if (activeProduct || activeStandards.length > 0) {
    // Current query does not name a product, but previous conversation has one
    isFollowUp = true;
  }

  return {
    conversationId,
    activeProduct,
    activeStandards,
    topicShiftDetected,
    isFollowUp,
  };
}
