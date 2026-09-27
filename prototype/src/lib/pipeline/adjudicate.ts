/**
 * BISVEDA V9 — Stage 8: Deterministic Adjudication (lib/pipeline/adjudicate.ts)
 * 
 * Rules:
 *  - Default class is `not_applicable`. A standard must strictly earn `applies` or `may_apply`.
 *  - Max 3 applies, max 3 may_apply shown.
 *  - Primary standard = top `applies` by fused rank.
 *  - QCO status comes ONLY from approved MANDATES edges in Facts DB.
 *  - Scheme, certification steps, and labs are scoped ONLY to the primary standard (fixes B7).
 *  - Grounding: 'verified' | 'partial' | 'none'.
 */

import { graphRepo } from "../knowledge/graph-repository";
import { StandardRecord, QcoRecord, SchemeRecord, LabRecord } from "../knowledge/types";
import { FusedResults } from "./fuse";
import { ProductResolution } from "./product";
import { CanonicalIsNumber } from "./normalize";

export type StandardClass = "applies" | "may_apply" | "related" | "not_applicable";

export interface AdjudicatedStandard {
  id: string;
  title: string;
  class: StandardClass;
  why: string;
  source: string;
  record?: StandardRecord;
}

export interface AdjudicationPackage {
  primaryStandard: { id: string; title: string } | null;
  standards: AdjudicatedStandard[];
  qco: {
    status: "mandatory" | "notified_not_in_force" | "unknown";
    order_title?: string;
    effective_on?: string;
    source: string;
  } | null;
  scheme: {
    scheme_name: string;
    steps: Array<{ text: string; source: string }>;
  } | null;
  labs: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    distance_km?: number;
    lat?: number;
    lng?: number;
    detail_url?: string;
    source: string;
  }>;
  grounding: "verified" | "partial" | "none";
}

function cleanId(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function adjudicateCandidates(
  query: string,
  fused: FusedResults,
  productRes: ProductResolution,
  canonicalStandards: CanonicalIsNumber[],
  userLocation?: { lat: number; lng: number },
  activeStandardsFromContext: string[] = []
): Promise<AdjudicationPackage> {
  const queryLower = query.toLowerCase();

  // Always include preferredStandardId and exact standards at top of candidateIds
  const candidateIdsSet = new Set<string>();
  if (productRes.preferredStandardId) candidateIdsSet.add(productRes.preferredStandardId);
  for (const cs of canonicalStandards) candidateIdsSet.add(cs.id);
  for (const as of activeStandardsFromContext) candidateIdsSet.add(as);
  for (const rStd of fused.rankedStandards) candidateIdsSet.add(rStd);

  const candidateIds = Array.from(candidateIdsSet).slice(0, 10);
  const adjudicatedList: AdjudicatedStandard[] = [];

  const exactStandardIds = new Set([
    ...canonicalStandards.map((cs) => cs.id),
    ...activeStandardsFromContext,
  ]);

  for (const stdId of candidateIds) {
    const std = await graphRepo.getStandard(stdId);
    if (!std) continue;

    const stdClean = cleanId(std.id);
    const titleLower = std.title.toLowerCase();
    const scopeLower = (std.scope_text || "").toLowerCase();

    // Check exact match
    const isExact =
      exactStandardIds.has(std.id) ||
      canonicalStandards.some((cs) => cleanId(cs.id) === stdClean) ||
      activeStandardsFromContext.some((as) => cleanId(as) === stdClean);

    // Default classification is not_applicable
    let classification: StandardClass = "not_applicable";
    let why = "";

    if (isExact) {
      classification = "applies";
      why = `Exact standard match: ${std.id} active in query or conversation context.`;
    } else if (productRes.matchedTerm) {
      const term = productRes.matchedTerm.toLowerCase();
      const titleMatches = titleLower.includes(term) || term.split(" ").some((t) => t.length > 3 && titleLower.includes(t));
      const isPreferred = productRes.preferredStandardId && cleanId(productRes.preferredStandardId) === stdClean;

      if (isPreferred || titleMatches) {
        // Helmet safety disambiguation: IS 2925 should NOT apply as primary for riders
        if (cleanId("IS 2925") === stdClean && term.includes("rider")) {
          classification = "not_applicable";
        } else if (cleanId("IS 4151") === stdClean && (term.includes("industrial") || term.includes("construction") || term.includes("worker"))) {
          classification = "not_applicable";
        } else if (cleanId("IS 1417") === stdClean && !term.includes("gold") && !term.includes("hallmark")) {
          // Never apply gold jewellery for helmets or toys! (Fixes B1)
          classification = "not_applicable";
        } else if (cleanId("IS 9873") === stdClean && !term.includes("toy")) {
          // Never apply toys for non-toy products!
          classification = "not_applicable";
        } else {
          classification = "applies";
          why = isPreferred
            ? `Primary standard governing ${productRes.matchedTerm} under BIS regulatory schedule.`
            : `Covers ${productRes.matchedTerm} — matched in official standard title.`;
        }
      } else if (scopeLower.includes(term)) {
        classification = "may_apply";
        why = `May apply — technical scope includes specifications relevant to ${productRes.matchedTerm}.`;
      }
    }

    if (classification !== "not_applicable") {
      adjudicatedList.push({
        id: std.id,
        title: std.title,
        class: classification,
        why,
        source: std.source_url,
        record: std,
      });
    }
  }

  // Filter: max 3 applies, max 3 may_apply
  const appliesList = adjudicatedList.filter((s) => s.class === "applies");
  const mayApplyList = adjudicatedList.filter((s) => s.class === "may_apply");

  // If productRes.preferredStandardId is set, sort it to the front of applies
  if (productRes.preferredStandardId) {
    const prefClean = cleanId(productRes.preferredStandardId);
    appliesList.sort((a, b) => (cleanId(a.id) === prefClean ? -1 : cleanId(b.id) === prefClean ? 1 : 0));
  }

  const slicedApplies = appliesList.slice(0, 3);
  const slicedMayApply = mayApplyList.slice(0, 3);
  const finalStandards = [...slicedApplies, ...slicedMayApply];

  // Primary Standard = top applies standard by fused rank
  const primaryStd = slicedApplies[0] || slicedMayApply[0] || null;

  // Retrieve QCO, Scheme, and Labs for Primary Standard ONLY (Fixes B7)
  let qcoInfo: AdjudicationPackage["qco"] = null;
  let schemeInfo: AdjudicationPackage["scheme"] = null;
  let labInfo: AdjudicationPackage["labs"] = [];

  if (primaryStd) {
    // 1. QCOs (approved MANDATES edges)
    const qcos = await graphRepo.qcosForStandard(primaryStd.id);
    const activeQco = qcos.find((q) => q.status === "in_force");
    const futureQco = qcos.find((q) => q.status === "notified_not_in_force");

    if (activeQco) {
      qcoInfo = {
        status: "mandatory",
        order_title: activeQco.title,
        effective_on: activeQco.effective_on,
        source: activeQco.source_url,
      };
    } else if (futureQco) {
      qcoInfo = {
        status: "notified_not_in_force",
        order_title: futureQco.title,
        effective_on: futureQco.effective_on,
        source: futureQco.source_url,
      };
    } else {
      qcoInfo = {
        status: "unknown",
        source: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
      };
    }

    // 2. Scheme & Steps
    const schemes = await graphRepo.schemesForStandard(primaryStd.id);
    const primaryScheme = schemes[0] || null;
    if (primaryScheme) {
      schemeInfo = {
        scheme_name: primaryScheme.name,
        steps: primaryScheme.steps.slice(0, 4),
      };
    }

    // 3. Labs (isolated strictly to primary standard)
    const labs = await graphRepo.labsForStandard(primaryStd.id, userLocation);
    labInfo = labs.slice(0, 5).map((l) => ({
      id: l.id,
      name: l.name,
      city: l.city,
      state: l.state,
      lat: l.lat,
      lng: l.lng,
      detail_url: l.detail_url,
      source: l.source_url,
    }));
  }

  // Determine Grounding
  let grounding: "verified" | "partial" | "none" = "none";
  if (primaryStd && primaryStd.class === "applies") {
    grounding = "verified";
  } else if (primaryStd && primaryStd.class === "may_apply") {
    grounding = "partial";
  }

  return {
    primaryStandard: primaryStd ? { id: primaryStd.id, title: primaryStd.title } : null,
    standards: finalStandards,
    qco: qcoInfo,
    scheme: schemeInfo,
    labs: labInfo,
    grounding,
  };
}
