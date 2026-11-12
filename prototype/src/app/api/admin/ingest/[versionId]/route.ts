/**
 * BISVEDA — officer decision on a staged version (R2.7, ARCHITECTURE.md §5).
 *
 * POST { action: "publish" | "reject", reason?: string }
 *  - publish: the previous published edition of the same document becomes
 *    superseded, this one becomes published (and so searchable), and
 *    index_state is bumped so every running store reloads.
 *  - reject: status rejected; chunks stay stored but are never searchable.
 * Both write an audit_log row. Only a staged version can be decided.
 * User identity comes with R6 (signed sessions, officer role); until then
 * audit rows have no user_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db/client";
import { invalidateStoreCache } from "@/lib/kb/store";

export const runtime = "nodejs";

class DecisionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (action !== "publish" && action !== "reject") {
    return NextResponse.json({ error: 'action must be "publish" or "reject".' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) {
    return NextResponse.json({ error: "Unknown version." }, { status: 404 });
  }

  try {
    const result = await tx(async (client) => {
      const cur = await client.query<{ id: string; document_id: string; kind: string; status: string }>(
        `SELECT id, document_id, kind, status FROM document_versions WHERE id = $1 FOR UPDATE`,
        [versionId],
      );
      const v = cur.rows[0];
      if (!v) throw new DecisionError("Unknown version.", 404);
      if (v.status !== "staged") {
        throw new DecisionError(`Only a staged version can be ${action === "publish" ? "published" : "rejected"} (this one is ${v.status}).`, 409);
      }

      if (action === "reject") {
        await client.query(`UPDATE document_versions SET status = 'rejected' WHERE id = $1`, [versionId]);
        await client.query(
          `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.reject', 'document_version', $1, $2, $3)`,
          [versionId, JSON.stringify({ status: "staged" }), JSON.stringify({ status: "rejected", reason })],
        );
        return { status: "rejected", superseded: [] as string[] };
      }

      if (v.kind !== "edition") throw new DecisionError("Publishing amendments is not supported yet.", 409);

      const chunkCount = await client.query<{ n: string }>(`SELECT count(*) AS n FROM chunks WHERE version_id = $1`, [versionId]);
      if (Number(chunkCount.rows[0].n) === 0) throw new DecisionError("This version has no chunks; it cannot be published.", 409);

      // The previous edition must leave 'published' first (one_published_edition unique index).
      const prev = await client.query<{ id: string }>(
        `UPDATE document_versions SET status = 'superseded', superseded_at = now()
          WHERE document_id = $1 AND kind = 'edition' AND status = 'published' AND id <> $2
        RETURNING id`,
        [v.document_id, versionId],
      );
      await client.query(`UPDATE document_versions SET status = 'published', published_at = now() WHERE id = $1`, [versionId]);
      await client.query(`UPDATE index_state SET version = version + 1, changed_at = now() WHERE id = 1`);
      await client.query(
        `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.publish', 'document_version', $1, $2, $3)`,
        [
          versionId,
          JSON.stringify({ status: "staged" }),
          JSON.stringify({ status: "published", superseded: prev.rows.map((r) => r.id), reason }),
        ],
      );
      return { status: "published", superseded: prev.rows.map((r) => r.id) };
    });

    if (result.status === "published") invalidateStoreCache();
    return NextResponse.json({ version_id: versionId, ...result });
  } catch (err: any) {
    if (err instanceof DecisionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[ingest] decision failed:", err);
    return NextResponse.json({ error: "The decision could not be saved. Check the server log." }, { status: 500 });
  }
}
