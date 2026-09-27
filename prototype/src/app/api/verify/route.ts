import { NextRequest, NextResponse } from "next/server";
import standardsData from "../../../../data/standards.json";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = (body.type || "cml").toLowerCase();
    const code = (body.code || "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Identification code is required" }, { status: 400 });
    }

    if (type === "cml" || type === "isi") {
      const cleanDigits = code.replace(/[^0-9]/g, "");
      const isValidShape = cleanDigits.length >= 7 && cleanDigits.length <= 8;

      if (!isValidShape) {
        return NextResponse.json({
          valid: false,
          type: "cml",
          code: code ? `CM/L-${cleanDigits}` : "",
          message: cleanDigits.length > 0
            ? "Invalid CM/L format: BIS Standard Mark Certification Licence numbers strictly contain 7 or 8 numeric digits."
            : "No licence number found in the photo.",
        });
      }

      const formattedCml = `CM/L-${cleanDigits}`;
      return NextResponse.json({
        valid: true,
        type: "cml",
        code: formattedCml,
        status: "FORMAT_VALID",
        message: `Licence number read from the label: ${formattedCml}. Check it on the BIS Care app or Manak Online.`,
        verificationNote: "BIS licence validity and operative status can only be confirmed in real-time via the official BIS Care mobile app or Manak Online (https://www.manakonline.in).",
        verificationSource: "Bureau of Indian Standards Central Manakonline Registry",
      });
    }

    if (type === "huid") {
      const isValidHuid = /^[A-Z0-9]{6}$/.test(code);
      if (!isValidHuid) {
        return NextResponse.json({
          valid: false,
          type: "huid",
          code,
          message: code
            ? "Invalid HUID format: Hallmarking Unique Identification (HUID) consists of 6 alphanumeric characters."
            : "No HUID found in the photo.",
        });
      }

      return NextResponse.json({
        valid: true,
        type: "huid",
        code,
        status: "FORMAT_VALID",
        message: `HUID read from the article: ${code}. Check it on the BIS Care app or Manak Online.`,
        standard: "IS 1417 (Gold Hallmarking)",
        verificationNote: "Hallmarking purity and assaying centre verification requires querying the Central BIS Hallmarking Portal or BIS Care app.",
      });
    }

    if (type === "standard") {
      const standards = standardsData as any[];
      const match = standards.find(
        (s) =>
          s.standard_number.toLowerCase().includes(code.toLowerCase()) ||
          (s.full_title && s.full_title.toLowerCase().includes(code.toLowerCase()))
      );

      if (!match) {
        return NextResponse.json({
          valid: false,
          type: "standard",
          code,
          message: `Standard '${code}' was not found in the official BIS active catalog.`,
        });
      }

      return NextResponse.json({
        valid: true,
        type: "standard",
        code: match.standard_number,
        title: match.full_title,
        year: match.year,
        mandatory_qco: match.mandatory_qco,
        scheme: match.scheme,
        document_url: match.document_url,
      });
    }

    return NextResponse.json({ error: "Unsupported verification type" }, { status: 400 });
  } catch (error: any) {
    console.error("Verification API error:", error);
    return NextResponse.json({ error: "Failed to verify identification code" }, { status: 500 });
  }
}
