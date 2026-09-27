/**
 * BISVEDA Layer 0 — Data Governance, Source Authority & Registry (V7 §5 & V8 §5)
 * Defines Authoritative BIS Ingestion Connectors, Knowledge Tiers (A/B/C),
 * and Official Statutory Deep-Link Endpoints.
 */

export type KnowledgeTier = "A" | "B" | "C";

export interface AuthoritativeSource {
  id: string;
  name: string;
  authorityType: "CENTRAL_GAZETTE" | "BIS_PORTAL" | "MINISTRY_ORDER" | "NABL_ACCREDITED";
  baseUrl: string;
  description: string;
  tier: KnowledgeTier;
  deepLinkTemplate: (entityId: string) => string;
}

export const AUTHORITATIVE_SOURCES: Record<string, AuthoritativeSource> = {
  gazette_qco: {
    id: "gazette_qco",
    name: "Official Gazette Compulsory QCO Orders",
    authorityType: "CENTRAL_GAZETTE",
    baseUrl: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en",
    description: "Statutory orders issued under Section 16 of the BIS Act, 2016 mandating compulsory ISI marks.",
    tier: "B",
    deepLinkTemplate: () => "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en",
  },
  manak_online: {
    id: "manak_online",
    name: "Manak Online (e-BIS Portal)",
    authorityType: "BIS_PORTAL",
    baseUrl: "https://www.manakonline.in",
    description: "Official digital portal for Product Certification Scheme-I licensing and surveillance.",
    tier: "B",
    deepLinkTemplate: () => "https://www.manakonline.in",
  },
  crs_portal: {
    id: "crs_portal",
    name: "Compulsory Registration Scheme (CRS Portal)",
    authorityType: "BIS_PORTAL",
    baseUrl: "https://www.crsbis.in/BIS/",
    description: "Scheme-II portal for IT, electronics, and solar PV goods compliance under MeitY and MNRE.",
    tier: "B",
    deepLinkTemplate: () => "https://www.crsbis.in/BIS/",
  },
  national_standards: {
    id: "national_standards",
    name: "BIS National Standards Portal",
    authorityType: "BIS_PORTAL",
    baseUrl: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/",
    description: "National repository for standard specifications, amendments, and scope declarations.",
    tier: "A",
    deepLinkTemplate: (id: string) => `https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails/${encodeURIComponent(id)}`,
  },
  complaints_portal: {
    id: "complaints_portal",
    name: "BIS Official Consumer Complaints & Vigilance",
    authorityType: "BIS_PORTAL",
    baseUrl: "https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en",
    description: "Grievance redressal portal for reporting counterfeit ISI marks and substandard goods.",
    tier: "B",
    deepLinkTemplate: () => "https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en",
  },
  nabl_directory: {
    id: "nabl_directory",
    name: "National Accreditation Board for Testing Laboratories (NABL)",
    authorityType: "NABL_ACCREDITED",
    baseUrl: "https://nabl-india.org/",
    description: "Apex accreditation board certifying ISO/IEC 17025 conformity for testing facilities.",
    tier: "B",
    deepLinkTemplate: () => "https://nabl-india.org/",
  },
};

/**
 * Returns deep-link to verified authoritative government source.
 */
export function getAuthoritativeSourceUrl(sourceId: string, entityId: string = ""): string {
  const source = AUTHORITATIVE_SOURCES[sourceId];
  if (!source) return "https://www.bis.gov.in";
  return source.deepLinkTemplate(entityId);
}
