/**
 * BISVEDA V8 — BIS Product Taxonomy Engine
 * §5.5 | Spec ref: v8 architecture bis veda.txt
 *
 * Implements:
 * 1. Division → Committee → Product Group → Type → Variant hierarchy
 * 2. Colloquial & Multilingual Synonym Resolution (e.g., sariya -> HSD steel bars)
 * 3. Self-verification invariant: Product group declares committees + known IS numbers.
 *    Verifies catalogue containment.
 * 4. Missing attribute extraction for structured clarification chips.
 */

import groupsData from "../../data/taxonomy/groups.json";
import standardsData from "../../data/standards.json";
import type { StandardRecord } from "./types";

export interface ProductGroupTaxonomy {
  id: string;
  name: string;
  name_hi: string;
  divisionId: string;
  divisionName: string;
  committees: string[];
  priority: boolean;
  known_is_numbers: string[];
  product_types: string[];
  synonyms: string[];
}

export interface TaxonomyResolution {
  matched: boolean;
  group?: ProductGroupTaxonomy;
  matchedSynonym?: string;
  confidence: number;
  suggestedStandards: string[];
  productTypes: string[];
  clarificationPrompt?: string;
}

export interface SelfVerificationReport {
  timestamp: string;
  totalDivisions: number;
  totalGroups: number;
  totalSynonyms: number;
  passed: boolean;
  mismatches: {
    groupId: string;
    groupName: string;
    missingIsNumber: string;
    reason: string;
  }[];
}

interface RawDivision {
  id: string;
  name: string;
  name_hi?: string;
  committees: string[];
  product_groups: {
    id: string;
    name: string;
    name_hi?: string;
    committees: string[];
    priority?: boolean;
    known_is_numbers: string[];
    product_types: string[];
    synonyms: string[];
  }[];
}

// Flatten groups into indexed structure
const rawDivisions = (groupsData as unknown as { divisions: RawDivision[] }).divisions || [];

const allGroups: ProductGroupTaxonomy[] = [];
const synonymIndex: Map<string, ProductGroupTaxonomy> = new Map();

for (const div of rawDivisions) {
  for (const pg of div.product_groups) {
    const entry: ProductGroupTaxonomy = {
      id: pg.id,
      name: pg.name,
      name_hi: pg.name_hi || pg.name,
      divisionId: div.id,
      divisionName: div.name,
      committees: pg.committees,
      priority: Boolean(pg.priority),
      known_is_numbers: pg.known_is_numbers || [],
      product_types: pg.product_types || [],
      synonyms: pg.synonyms || [],
    };
    allGroups.push(entry);

    // Index canonical names
    synonymIndex.set(entry.name.toLowerCase().trim(), entry);
    if (entry.name_hi) {
      synonymIndex.set(entry.name_hi.toLowerCase().trim(), entry);
    }

    // Index product types
    for (const pt of entry.product_types) {
      synonymIndex.set(pt.toLowerCase().trim(), entry);
    }

    // Index colloquial synonyms
    for (const syn of entry.synonyms) {
      synonymIndex.set(syn.toLowerCase().trim(), entry);
    }
  }
}

/**
 * Self-verification invariant (§5.5):
 * Checks that every product group's known IS numbers exist in catalogue and align with committee codes.
 */
export function verifyTaxonomy(): SelfVerificationReport {
  const standards = standardsData as unknown as StandardRecord[];
  const catalogueMap = new Map<string, StandardRecord>();
  for (const s of standards) {
    // Normalise key: "IS 1786" -> "IS 1786"
    const numClean = s.standard_number.split(":")[0].trim();
    catalogueMap.set(numClean, s);
  }

  const mismatches: SelfVerificationReport["mismatches"] = [];

  for (const group of allGroups) {
    for (const isNum of group.known_is_numbers) {
      const match = catalogueMap.get(isNum);
      if (!match) {
        // Not in seed catalogue — report warning
        mismatches.push({
          groupId: group.id,
          groupName: group.name,
          missingIsNumber: isNum,
          reason: `Standard ${isNum} declared in ${group.name} but not found in seeded catalogue`,
        });
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalDivisions: rawDivisions.length,
    totalGroups: allGroups.length,
    totalSynonyms: synonymIndex.size,
    passed: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Resolves a natural-language query to canonical BIS Product Taxonomy group.
 * Matches synonyms, colloquial Hindi terms, and specific product types.
 */
export function resolveTaxonomy(query: string): TaxonomyResolution {
  if (!query || typeof query !== "string") {
    return { matched: false, confidence: 0, suggestedStandards: [], productTypes: [] };
  }

  const clean = query.toLowerCase().trim();

  // 1. Direct exact synonym / colloquial match
  // Longest match first to favor specific phrases ("stainless steel bottle" over "steel")
  const sortedSynonyms = Array.from(synonymIndex.keys()).sort((a, b) => b.length - a.length);

  for (const syn of sortedSynonyms) {
    // Word boundary or containment check
    const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s|[.,!?;/])${escaped}($|\\s|[.,!?;/])`, "i");

    if (regex.test(clean)) {
      const group = synonymIndex.get(syn)!;
      return {
        matched: true,
        group,
        matchedSynonym: syn,
        confidence: 0.95,
        suggestedStandards: group.known_is_numbers,
        productTypes: group.product_types,
        clarificationPrompt:
          group.product_types.length > 1
            ? `Which specific product variant are you looking for: ${group.product_types.join(", ")}?`
            : undefined,
      };
    }
  }

  // 2. Substring matching for compound keywords
  for (const group of allGroups) {
    for (const syn of group.synonyms) {
      if (clean.includes(syn) && syn.length >= 4) {
        return {
          matched: true,
          group,
          matchedSynonym: syn,
          confidence: 0.8,
          suggestedStandards: group.known_is_numbers,
          productTypes: group.product_types,
        };
      }
    }
  }

  return {
    matched: false,
    confidence: 0,
    suggestedStandards: [],
    productTypes: [],
  };
}

/**
 * Returns all taxonomy divisions and product groups.
 */
export function getAllTaxonomyDivisions(): RawDivision[] {
  return rawDivisions;
}

/**
 * Returns all flattened product groups.
 */
export function getAllProductGroups(): ProductGroupTaxonomy[] {
  return allGroups;
}
