import type { ApplicabilityState, StandardRecord } from "./types";

export interface AdjudicatedClause {
  sid: string;
  clauseNumber?: string;
  clauseTitle?: string;
  verbatimText: string;
  authorityLevel: "AUTHORITATIVE";
  standardNumber: string;
  sourceUrl?: string;
}

export interface ApplicabilityAssessment {
  state: ApplicabilityState;
  reason: string;
  isMandatoryQco: boolean;
  orderReference?: string;
  ministry?: string;
  penalProvision?: string;
  schemeName: string;
  isMsmeEligible: boolean;
  msmeSubsidyPercent: number;
  citableClauses: AdjudicatedClause[];
}

/**
 * Pre-Generation Evidence Adjudicator (Axiom A13, Spec §33):
 * Runs deterministically before any text generation to establish:
 * 1. Statutory applicability state (Direct, Potential, Related, Material Mismatch)
 * 2. Mandatory Quality Control Order (QCO) status and Section 29 penal liability
 * 3. Applicable BIS Certification Scheme and MSME 80% fee subsidies
 * 4. Pre-approved citable evidence ledger [S1, S2, ...] for Trust Gate validation
 */
export function assessApplicability(
  standard: StandardRecord,
  query: string,
  relevanceScore: number
): ApplicabilityAssessment {
  const q = query.toLowerCase();
  const stdNum = standard.standard_number.toUpperCase();
  const title = standard.full_title.toLowerCase();
  const scope = standard.scope.toLowerCase();

  // 1. Material Mismatch Checks
  const hasStainlessSteelInQuery = q.includes("stainless steel") || q.includes("stainless-steel") || q.includes("ss ");
  const hasAluminiumInQuery = q.includes("aluminium") || q.includes("aluminum");
  const hasPlasticInQuery = q.includes("plastic") || q.includes("pet ");

  const standardIsAluminium =
    title.includes("aluminium") ||
    scope.includes("aluminium only") ||
    (standard.materials?.some((m) => m.toLowerCase().includes("aluminium")) &&
      !standard.materials?.some((m) => m.toLowerCase().includes("stainless steel")));

  const standardIsStainlessSteel =
    title.includes("stainless steel") ||
    standard.materials?.some((m) => m.toLowerCase().includes("stainless steel"));

  const standardIsPlastic =
    title.includes("plastics") ||
    title.includes("polyethylene") ||
    title.includes("pet") ||
    standard.materials?.some((m) => m.toLowerCase().includes("pet"));

  if (hasStainlessSteelInQuery && standardIsAluminium) {
    return createAdjudication(
      standard,
      "MATERIAL_MISMATCH",
      `Related standard for the product category, but strictly specifies aluminium alloys rather than the specified stainless steel.`,
      false
    );
  }

  if (hasAluminiumInQuery && standardIsStainlessSteel && !title.includes("domestic pressure cooker")) {
    return createAdjudication(
      standard,
      "MATERIAL_MISMATCH",
      `Standard applies strictly to stainless steel grades; does not cover aluminium fabrication.`,
      false
    );
  }

  if (hasStainlessSteelInQuery && standardIsPlastic) {
    return createAdjudication(
      standard,
      "MATERIAL_MISMATCH",
      `Standard governs polymer/PET plastic containers, incompatible with stainless steel fabrication.`,
      false
    );
  }

  // 2. Container vs Potable Liquid Disambiguation
  const isBottleContainerQuery =
    q.includes("water bottle") ||
    q.includes("bottle") ||
    q.includes("flask") ||
    q.includes("thermos") ||
    q.includes("canister");

  const isLiquidWaterStandard =
    stdNum.includes("14543") ||
    stdNum.includes("13428") ||
    stdNum.includes("10500");

  if (isBottleContainerQuery && isLiquidWaterStandard) {
    return createAdjudication(
      standard,
      "RELATED",
      `Governs the chemical, physical, and microbiological quality of packaged potable water liquid, not the manufacturing specifications of the container itself.`,
      false
    );
  }

  // 3. High Relevance & Direct Product Family Match
  if (relevanceScore >= 0.75) {
    const isDirectMatch =
      standard.keywords.some((k) => q.includes(k.toLowerCase())) ||
      q.includes(stdNum.toLowerCase()) ||
      (hasStainlessSteelInQuery && stdNum.includes("17526")) ||
      (q.includes("pressure cooker") && stdNum.includes("2347")) ||
      (q.includes("helmet") && stdNum.includes("4151")) ||
      (q.includes("battery") && stdNum.includes("16046")) ||
      (q.includes("hallmark") && stdNum.includes("1417"));

    if (isDirectMatch) {
      return createAdjudication(
        standard,
        "DIRECTLY_APPLICABLE",
        `Direct statutory standard legally governing this exact product specification, safety criteria, and mandatory BIS mark.`,
        true
      );
    }

    return createAdjudication(
      standard,
      "POTENTIALLY_APPLICABLE",
      `Substantial technical overlap with query scope; verify exact product classification and nominal dimensions.`,
      true
    );
  }

  // 4. Moderate Relevance
  if (relevanceScore >= 0.45) {
    return createAdjudication(
      standard,
      "POTENTIALLY_APPLICABLE",
      `Covers allied product variants or referenced testing methodologies applicable to this product category.`,
      false
    );
  }

  // 5. Low Relevance
  return createAdjudication(
    standard,
    "RELATED",
    `Allied reference standard providing general material specifications or test procedures.`,
    false
  );
}

function createAdjudication(
  standard: StandardRecord,
  state: ApplicabilityState,
  reason: string,
  isDirect: boolean
): ApplicabilityAssessment {
  const stdNum = standard.standard_number.toUpperCase();
  const isMandatory = standard.mandatory_qco ?? true;

  // Determine QCO legal order & issuing ministry
  let orderReference = `Quality Control Order for ${standard.standard_number}`;
  let ministry = "Ministry of Consumer Affairs / DPIIT";

  if (stdNum.includes("17526")) {
    orderReference = "Cookware, Utensils and Canisters for Liquid and Solid Foodstuffs (Quality Control) Order, 2023 [S.O. 3634(E)]";
    ministry = "Department for Promotion of Industry and Internal Trade (DPIIT), Ministry of Commerce & Industry";
  } else if (stdNum.includes("2347")) {
    orderReference = "Domestic Pressure Cooker (Quality Control) Order, 2020 [S.O. 776(E)]";
    ministry = "Department for Promotion of Industry and Internal Trade (DPIIT)";
  } else if (stdNum.includes("14543") || stdNum.includes("13428")) {
    orderReference = "Food Safety and Standards (Packaging and Labelling) Regulations & Mandatory BIS Scheme-I";
    ministry = "Ministry of Health and Family Welfare (FSSAI) & Ministry of Consumer Affairs";
  } else if (stdNum.includes("16046") || stdNum.includes("15885")) {
    orderReference = "Electronics and Information Technology Goods (Requirement for Compulsory Registration) Order";
    ministry = "Ministry of Electronics and Information Technology (MeitY)";
  } else if (stdNum.includes("4151")) {
    orderReference = "Helmet for Riders of Two-Wheeler Motor Vehicles (Quality Control) Order";
    ministry = "Ministry of Road Transport and Highways (MoRTH)";
  } else if (stdNum.includes("1417")) {
    orderReference = "Hallmarking of Gold Jewellery and Gold Artefacts Order, 2020";
    ministry = "Department of Consumer Affairs, Ministry of Consumer Affairs, Food & Public Distribution";
  } else if (stdNum.includes("1786") || stdNum.includes("2062")) {
    orderReference = "Steel and Steel Products (Quality Control) Order";
    ministry = "Ministry of Steel";
  }

  // Section 29 Penal Provision
  const penalProvision =
    "Section 29 of the Bureau of Indian Standards Act, 2016: Any person contravening mandatory QCO provisions is punishable with imprisonment for a term up to two years, or fine not less than ₹2,00,000 extending up to ₹5,00,000 (or up to 10 times value of goods), or both.";

  // Scheme Determination
  let schemeName = "Scheme-I (ISI Mark Certification)";
  if (stdNum.includes("16046") || stdNum.includes("15885")) {
    schemeName = "Scheme-II (Compulsory Registration Scheme - CRS)";
  } else if (stdNum.includes("1417")) {
    schemeName = "Mandatory Hallmarking Scheme (6-Digit HUID)";
  }

  // Pre-approved citable evidence clauses
  const citableClauses: AdjudicatedClause[] = (standard.key_testing_parameters || []).map(
    (param, idx) => {
      const clauseMatch = param.match(/\(Clause\s*([\d\.]+)\):/i);
      const clauseNum = clauseMatch ? clauseMatch[1] : undefined;
      const titleMatch = param.split(":")[0]?.trim();

      return {
        sid: `S${idx + 1}`,
        clauseNumber: clauseNum,
        clauseTitle: titleMatch,
        verbatimText: param,
        authorityLevel: "AUTHORITATIVE" as const,
        standardNumber: standard.standard_number,
        sourceUrl: standard.document_url,
      };
    }
  );

  return {
    state,
    reason,
    isMandatoryQco: isMandatory,
    orderReference,
    ministry,
    penalProvision,
    schemeName,
    isMsmeEligible: true,
    msmeSubsidyPercent: 80,
    citableClauses,
  };
}
