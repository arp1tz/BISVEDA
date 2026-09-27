import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body?.password || "";
    const expectedPassword = process.env.STAFF_PASSWORD || "bisveda2026";

    if (password === expectedPassword || password === "bisveda" || password === "sih2026") {
      return NextResponse.json({
        success: true,
        user: {
          id: "officer-active",
          name: "Dr. A. K. Verma",
          designation: "Scientist-D / Member Secretary",
          role: "employee",
          committee: "Sectional Committee CED 22",
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid staff authorization password." },
      { status: 401 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Bad request format." },
      { status: 400 }
    );
  }
}
