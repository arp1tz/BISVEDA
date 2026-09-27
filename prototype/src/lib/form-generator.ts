/**
 * BISVEDA Layer 5 — Form-I & Schedule-II Application Generator (V7 §10.14 & V8 §10.14)
 * Generates official BIS Form-V / Schedule-II Grant of Licence application drafts
 * with MSME 80% fee concessions and Annex A in-house test equipment checklists.
 */

import type { FormDraftData } from "./types";
import kbData from "../../data/knowledge_base.json";

interface FormGeneratorInput {
  standardNumber: string;
  productTitle: string;
  scheme?: string;
  isMsme?: boolean;
}

export function generateFormDraft({
  standardNumber,
  productTitle,
  scheme = "Scheme-I (ISI Mark)",
  isMsme = true,
}: FormGeneratorInput): FormDraftData {
  const stdNum = standardNumber.toUpperCase().trim();
  const chunks = (kbData as any).chunks || [];

  // Match in-house test equipment from knowledge base if available
  const matchedChunks = chunks.filter((c: any) =>
    c.standard_number.includes(stdNum.replace(/[^0-9]/g, ""))
  );

  let equipmentList: string[] = [];
  const annexAChunk = matchedChunks.find((c: any) => c.section_title?.includes("Annex A") || c.chunk_id?.includes("annex_a"));
  if (annexAChunk && annexAChunk.subsections) {
    equipmentList = annexAChunk.subsections.map((s: any) => s.title);
  }

  // Fallback realistic testing equipment if not directly matched
  if (equipmentList.length === 0) {
    if (stdNum.includes("4151")) {
      equipmentList = [
        "Impact Absorption Drop-Tower Test Rig (Hemispherical & Flat Anvils, IS 4151 Clause 9.2)",
        "Retention System Dynamic Extension Rig & Chin Strap Deflection Dial (Clause 9.3)",
        "Chin Strap Micro-Slip and Abrasion Test Apparatus (Clause 9.3.4)",
        "Environmental Conditioning Chambers (High Temp 50°C, Low Temp -10°C, Water Immersion)",
        "Headforms conforming to IS 7692 (Sizes A, E, J, M, O)",
        "Visor Optical Distortion Spectrophotometer & Impact Projection Rig",
      ];
    } else if (stdNum.includes("2347")) {
      equipmentList = [
        "Hydrostatic Bursting Pressure Test Bench (Up to 1.5 MPa / 15 bar, IS 2347 Clause 8.2)",
        "Operating Pressure Manometer Rig (30 kPa to 150 kPa range)",
        "Safety Valve & Fusible Plug Pressure Release Test Chamber (Clause 8.4)",
        "Thermal Shock & Dry Heat Resistance Chamber",
        "Lid Handle Impact Resistance & Deflection Rig",
        "Internal Capacity Gravimetric Measuring Apparatus",
      ];
    } else if (stdNum.includes("1293")) {
      equipmentList = [
        "Temperature-Rise Test Bench with Multi-Point Thermocouples (IS 1293 Clause 16)",
        "Socket-Outlet Shutter Resistance & Withdrawal Force Test Rig (Clause 13.8)",
        "High-Voltage Dielectric Withstand Tester (2000V AC RMS, Clause 17)",
        "Tracking Resistance & Glow-Wire Test Apparatus (Clause 28)",
        "Mechanical Endurance Cycling Bench (10,000 cycles at rated current)",
      ];
    } else {
      equipmentList = [
        "Calibrated Dimensional Measurement System (Vernier, Micrometers, Thickness Gauges)",
        "Environmental Conditioning Chamber (Temperature & Humidity Controlled)",
        "Mechanical Strength & Tensile/Compression Testing Bench",
        "Electrical Insulation Resistance & Dielectric Breakdown Tester",
      ];
    }
  }

  const baseFee = 33000; // Base: ₹1,000 app + ₹7,000 audit + ₹25,000 marking fee
  const concessionFee = isMsme ? Math.round(baseFee * 0.2) : baseFee; // 80% concession for MSMEs

  return {
    formType: "SCHEDULE_II_FORM_I",
    standardNumber: stdNum,
    productTitle,
    scheme,
    msmeEligible: isMsme,
    concessionPercent: isMsme ? 80 : 0,
    estimatedBaseFee: baseFee,
    concessionFee,
    requiredDocuments: [
      "Proof of Legal Identity of Factory (GST Registration / Factory Licence)",
      "Valid Udyam Registration Certificate (for 80% MSME Fee Subsidy)",
      "Process Flowchart of Manufacturing from Raw Material to Finished Goods",
      "List of In-House Testing Equipment with NABL Calibration Certificates (Annex A)",
      "Qualification details of Factory Quality Control In-Charge (STI Table 1)",
      "Signed Undertaking for Compliance to Scheme of Inspection and Testing (SIT)",
    ],
    inHouseTestEquipment: equipmentList,
    submissionPortal: "https://www.manakonline.in",
  };
}
