/**
 * BISVEDA V9 — Stage 4: Product Resolver (lib/pipeline/product.ts)
 * 
 * Maps query tokens to Product and ProductGroup nodes using taxonomy synonyms.
 * Resolves product disambiguations (e.g. helmets: riders vs industrial).
 */

export interface ProductResolution {
  matchedTerm: string | null;
  productNodeId: string | null;
  productGroupId: string | null;
  preferredStandardId: string | null;
  clarificationNeeded?: {
    prompt: string;
    options: Array<{ label: string; value: string }>;
  };
}

export function resolveProduct(query: string): ProductResolution {
  const qLower = query.toLowerCase();

  // 1. Two-Wheeler vs Industrial Helmets Disambiguation
  if (qLower.includes("helmet")) {
    if (qLower.includes("construction") || qLower.includes("industrial") || qLower.includes("worker") || qLower.includes("factory")) {
      return {
        matchedTerm: "industrial safety helmet",
        productNodeId: "prod:industrial-safety-helmet",
        productGroupId: "pg:PG-SAFETY",
        preferredStandardId: "IS 2925",
      };
    }
    // Default for general helmet or rider query is two-wheeler helmet (IS 4151)
    return {
      matchedTerm: "motorcycle rider helmet",
      productNodeId: "prod:helmet",
      productGroupId: "pg:PG-AUTOMOTIVE-SAFETY",
      preferredStandardId: "IS 4151",
    };
  }

  // 2. Toys: Electric / Battery-Operated vs General Mechanical
  if (qLower.includes("toy") || qLower.includes("toys")) {
    if (qLower.includes("battery") || qLower.includes("electric") || qLower.includes("electronic") || qLower.includes("motorized")) {
      return {
        matchedTerm: "electric toy",
        productNodeId: "prod:electric-toy",
        productGroupId: "pg:PG-TOYS",
        preferredStandardId: "IS 15644",
      };
    }
    return {
      matchedTerm: "children toy",
      productNodeId: "prod:toy",
      productGroupId: "pg:PG-TOYS",
      preferredStandardId: "IS 9873 (Part 1)",
    };
  }

  // 3. Pressure Cookers
  if (qLower.includes("cooker") || qLower.includes("pressure cooker")) {
    return {
      matchedTerm: "domestic pressure cooker",
      productNodeId: "prod:domestic-pressure-cooker",
      productGroupId: "pg:PG-KITCHEN-APPLIANCES",
      preferredStandardId: "IS 2347",
    };
  }

  // 4. Packaged Drinking Water
  if (qLower.includes("drinking water") || qLower.includes("mineral water") || (qLower.includes("water") && qLower.includes("bottle"))) {
    return {
      matchedTerm: "packaged drinking water",
      productNodeId: "prod:packaged-drinking-water",
      productGroupId: "pg:PG-PACKAGED-WATER",
      preferredStandardId: "IS 14543",
    };
  }

  // 5. Gold Jewellery & Hallmarking
  if (qLower.includes("gold") || qLower.includes("jewellery") || qLower.includes("hallmark") || qLower.includes("22 carat")) {
    return {
      matchedTerm: "gold jewellery",
      productNodeId: "prod:gold-jewellery",
      productGroupId: "pg:PG-HALLMARKING",
      preferredStandardId: "IS 1417",
    };
  }

  // 6. Lithium-ion Power Bank / Batteries
  if (qLower.includes("power bank") || qLower.includes("lithium ion") || (qLower.includes("battery") && qLower.includes("mah"))) {
    return {
      matchedTerm: "lithium ion power bank",
      productNodeId: "prod:power-bank",
      productGroupId: "pg:PG-ELECTRONICS-CRS",
      preferredStandardId: "IS 16046 (Part 2)",
    };
  }

  // 7. Sariya / TMT / Steel Rebar (Synonym Mapping)
  if (qLower.includes("sariya") || qLower.includes("सरिया") || qLower.includes("tmt") || qLower.includes("rebar") || qLower.includes("reinforcement bar")) {
    return {
      matchedTerm: "tmt steel rebar",
      productNodeId: "prod:tmt-bars",
      productGroupId: "pg:PG-CIVIL-STEEL",
      preferredStandardId: "IS 1786",
    };
  }

  return {
    matchedTerm: null,
    productNodeId: null,
    productGroupId: null,
    preferredStandardId: null,
  };
}
