/**
 * GET  /api/v8/connectors         — list all connector statuses
 * POST /api/v8/connectors         — trigger a connector run
 * GET  /api/v8/connectors/[name]  — get last run report for a connector
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getConnectorStatuses,
  runConnector,
  ConnectorName,
} from "@/lib/ingestion/connectors";

const VALID_CONNECTORS: ConnectorName[] = [
  "catalogue", "labs", "qco", "whats_new", "ahc",
  "schemes", "hallmarking", "faq", "consumer", "geocode",
];

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") as ConnectorName | null;

  if (name) {
    if (!VALID_CONNECTORS.includes(name)) {
      return NextResponse.json({ error: `Unknown connector: ${name}` }, { status: 400 });
    }
    const statuses = getConnectorStatuses();
    const status = statuses.find((s) => s.name === name);
    return NextResponse.json(status ?? { error: "Not found" }, { status: status ? 200 : 404 });
  }

  const statuses = getConnectorStatuses();
  return NextResponse.json({ connectors: statuses });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; useCache?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name as ConnectorName | undefined;
  if (!name || !VALID_CONNECTORS.includes(name)) {
    return NextResponse.json(
      { error: `Invalid connector name. Valid: ${VALID_CONNECTORS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const report = await runConnector(name, { useCache: body.useCache ?? true });
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
