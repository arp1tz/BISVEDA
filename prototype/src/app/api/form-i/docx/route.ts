import { NextRequest, NextResponse } from "next/server";
import { buildFormIDocx } from "@/lib/tools/form_i_docx";
import { getFormISchema } from "@/lib/tools/form_i";

export const runtime = "nodejs";

/** POST { fields } -> editable Form I draft as .docx (P13.2). Only known schema keys are written. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = body && typeof body.fields === "object" && body.fields ? (body.fields as Record<string, unknown>) : {};

  const allowed = new Set(getFormISchema().map((f) => f.key));
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (allowed.has(k) && typeof v === "string") fields[k] = v.slice(0, 1000);
  }

  const buf = await buildFormIDocx(fields);
  const slug = (fields.name_of_jeweller || "jeweller").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "jeweller";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Form_I_draft_${slug}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
