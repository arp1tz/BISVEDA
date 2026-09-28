import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password, action } = body;

    if (action === "logout") {
      const res = NextResponse.json({ ok: true, message: "Logged out" });
      res.cookies.set("bisveda_admin_auth", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    const expectedPassword = process.env.ADMIN_PASSWORD || "bisveda2026";
    if (password === expectedPassword) {
      const res = NextResponse.json({ ok: true });
      res.cookies.set("bisveda_admin_auth", "authenticated", {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
