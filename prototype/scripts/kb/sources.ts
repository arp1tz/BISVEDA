/**
 * BISVEDA — Knowledge base source registry (P1.1)
 *
 * The full, closed list of documents the knowledge base is built from.
 * Every entry's `file` must exist under "example docs uploaded by employees/".
 * Nothing outside this list is ever cited — see CLAUDE.md's hard rules.
 *
 * Built from `download_manifest.json` in that folder, plus the Form I template
 * (added by hand; it has no manifest entry).
 */

import type { SourceDoc, ExcludedDoc } from "./types";

export const DOCS_DIR = "example docs uploaded by employees";

export const SOURCES: SourceDoc[] = [
  {
    doc_id: "is-4151",
    standard_id: "IS 4151",
    title: "Protective Helmets for Motorcycle Riders — Specification (Third Revision)",
    year: 1993,
    domain: "helmets",
    file: "IS_4151_Protective_Helmets_for_Motorcycle_Riders_Specification_(Third_Revision).pdf",
    source_url: "https://archive.org/download/gov.law.is.4151.1993/is.4151.1993.pdf",
  },
  {
    doc_id: "is-2925",
    standard_id: "IS 2925",
    title: "Specification for Industrial Safety Helmets (Second Revision)",
    year: 1984,
    domain: "helmets",
    file: "IS_2925_Specification_for_Industrial_Safety_Helmets_(Second_Revision).pdf",
    source_url: "https://archive.org/download/gov.law.is.2925.1984/is.2925.1984.pdf",
  },
  {
    doc_id: "is-15644",
    standard_id: "IS 15644",
    title: "Safety of Electric Toys",
    year: 2006,
    domain: "toys",
    file: "IS_15644_Safety_of_Electric_toys.pdf",
    source_url: "https://archive.org/download/gov.in.is.15644.2006/is.15644.2006.pdf",
  },
  {
    doc_id: "is-9873-1",
    standard_id: "IS 9873 (Part 1)",
    title: "Safety Requirements for Toys, Part 1: Safety Aspects Related to Mechanical and Physical Properties",
    year: 2012,
    domain: "toys",
    file: "IS_9873_1_Safety_Requirements_for_Toys,_Part_1_Safety_Aspects_related_to_Mechanical_and_Physical_Properties.pdf",
    source_url: "https://archive.org/download/gov.in.is.9873.1.2012/is.9873.1.2012.pdf",
  },
  {
    doc_id: "is-9873-3",
    standard_id: "IS 9873 (Part 3)",
    title: "Safety Requirements for Toys, Part 3: Migration of Certain Elements",
    year: 1999,
    domain: "toys",
    file: "IS_9873_3_Safety_Requirements_for_Toys,_Part_3_Migration_of_Certain_Elements.pdf",
    source_url: "https://archive.org/download/gov.in.is.9873.3.1999/is.9873.3.1999.pdf",
  },
  {
    doc_id: "is-1417",
    standard_id: "IS 1417",
    title: "Gold and Gold Alloys, Jewellery/Artefacts — Fineness and Marking",
    year: 1999,
    domain: "gold",
    file: "IS_1417_Gold_and_Gold_Alloys,_JewelleryArtefacts_Fineness_and_Marking.pdf",
    source_url: "https://archive.org/download/gov.in.is.1417.1999/is.1417.1999.pdf",
  },
  {
    doc_id: "is-1418",
    standard_id: "IS 1418",
    title: "Determination of Gold in Gold Bullion, Gold Alloys and Gold Jewellery/Artefacts — Cupellation (Fire Assay) Method",
    year: 2009,
    domain: "gold",
    file: "IS_1418_Determination_of_Gold_in_Gold_Bullion,_Gold_Alloys_and_Gold_JewelleryArtefacts_Cupellation_(Fire_Assay)_Method.pdf",
    source_url: "https://archive.org/download/gov.in.is.1418.2009/is.1418.2009.pdf",
  },
  {
    doc_id: "is-15820",
    standard_id: "IS 15820",
    title: "General Requirement for Competence of Assaying and Hallmarking Centres",
    year: 2009,
    domain: "gold",
    file: "IS_15820_General_requirement_for_competence_of_assaying_and_hallmarking_centres.pdf",
    source_url: "https://archive.org/download/gov.in.is.15820.2009/is.15820.2009.pdf",
  },
  {
    doc_id: "form-i-jeweller",
    standard_id: "FORM-I",
    title: "Form I — Application for Grant of Certificate of Registration to Jewellers for Sale of Hallmarked Articles",
    domain: "forms",
    file: "Form I Application for Grant of Certificateof Registration to Jewellers For Sale of Hallmarked Article.pdf",
  },
];

/**
 * Documents present in the folder but deliberately not ingested, with the
 * reason. Checked by scripts/kb/build.ts, which fails loudly if a file in
 * the folder is neither in SOURCES nor here (nothing gets in silently).
 */
export const EXCLUDED: ExcludedDoc[] = [
  {
    file: "IS_4151_Specification_for_protective_helmets_for_scooter_and_motorcycle_riders.pdf",
    reason:
      "Duplicate scan of the same edition (IS 4151:1993, reaffirmed 2008) as is-4151. " +
      "Measured: 44,988 extracted chars / 0 tables vs. the kept scan's 46,824 chars / 1 table. Keeping the higher-fidelity scan only.",
  },
  {
    file: "download_manifest.json",
    reason: "Provenance manifest, not a knowledge document.",
  },
];
