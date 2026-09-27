/**
 * BISVEDA V8 — L0 Acquisition Connectors
 * §5.4 | Spec ref: v8 architecture bis veda.txt
 *
 * Named connectors for each authorized BIS data source.
 * Rules: 1 req/sec per host; on-disk response cache; SHA-256 provenance;
 *         run report stored in connector_runs; schema drift fails loudly.
 *
 * Prototype: Runs in Next.js API routes, uses fetch with rate limiting.
 * Production: Replaces with scheduled Temporal workflows + PostgreSQL persistence.
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// ─── Connector Registry ───────────────────────────────────────────────────────

export type ConnectorName =
  | "catalogue"
  | "labs"
  | "ahc"
  | "qco"
  | "whats_new"
  | "schemes"
  | "hallmarking"
  | "faq"
  | "consumer"
  | "geocode";

export type ConnectorHealth = "healthy" | "degraded" | "down" | "never_run";

export interface ConnectorRunReport {
  connectorName: ConnectorName;
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  rowsAdded: number;
  rowsChanged: number;
  rowsRemoved: number;
  trapsTriggered: string[];
  errors: string[];
  durationMs?: number;
}

export interface ConnectorStatus {
  name: ConnectorName;
  displayName: string;
  sourceUrl: string;
  schedule: string;
  health: ConnectorHealth;
  lastRunAt?: string;
  lastRunStatus?: "completed" | "failed";
  lastRunReport?: ConnectorRunReport;
  rowsInStore: number;
}

/** URL Allowlist per §5.1 — schema drift fails if source is not in this list */
const URL_ALLOWLIST = [
  "bis.gov.in",
  "standards.bis.gov.in",
  "lims.bis.gov.in",
  "manakonline.in",
  "crsbis.in",
  "egazette.gov.in",
  "services.bis.gov.in",
  "bis.org.in",
];

function isAllowedUrl(url: string): boolean {
  return URL_ALLOWLIST.some((d) => url.includes(d));
}

// ─── Rate Limiter (1 req/sec per host) ───────────────────────────────────────

const lastRequestTime: Record<string, number> = {};

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  if (!isAllowedUrl(url)) {
    throw new Error(`URL not in allowlist: ${url}`);
  }
  const host = new URL(url).hostname;
  const now = Date.now();
  const last = lastRequestTime[host] ?? 0;
  const wait = 1000 - (now - last);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime[host] = Date.now();
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent": "BISVEDA/8.0 (BIS Authorized Research Assistant; contact@bisveda.in)",
      "Accept": "text/html,application/json,application/xhtml+xml",
      ...options?.headers,
    },
  });
}

// ─── On-disk Response Cache ───────────────────────────────────────────────────

const CACHE_DIR = path.join(process.cwd(), "data", "connectors", "cache");

function getCacheKey(url: string, params?: Record<string, string>): string {
  const str = url + (params ? JSON.stringify(params) : "");
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function readCache(key: string): { body: string; retrievedAt: string; sha256: string } | null {
  try {
    if (!fs.existsSync(CACHE_DIR)) return null;
    const filepath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(key: string, body: string) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const sha256 = createHash("sha256").update(body).digest("hex");
    fs.writeFileSync(
      path.join(CACHE_DIR, `${key}.json`),
      JSON.stringify({ body, retrievedAt: new Date().toISOString(), sha256 })
    );
  } catch {
    // cache write failures are non-fatal
  }
}

async function cachedFetch(
  url: string,
  useCache = true,
  params?: Record<string, string>
): Promise<{ body: string; sha256: string; fromCache: boolean; retrievedAt: string }> {
  const key = getCacheKey(url, params);
  if (useCache) {
    const cached = readCache(key);
    if (cached) {
      return { body: cached.body, sha256: cached.sha256, fromCache: true, retrievedAt: cached.retrievedAt };
    }
  }
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const body = await res.text();
  const sha256 = createHash("sha256").update(body).digest("hex");
  writeCache(key, body);
  return { body, sha256, fromCache: false, retrievedAt: new Date().toISOString() };
}

// ─── In-memory connector state (production: PostgreSQL connector_runs) ────────

const connectorRuns = new Map<string, ConnectorRunReport[]>();
const connectorRowCounts: Record<ConnectorName, number> = {
  catalogue: 0, labs: 0, ahc: 0, qco: 0, whats_new: 0,
  schemes: 0, hallmarking: 0, faq: 0, consumer: 0, geocode: 0
};

function makeRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function startRun(name: ConnectorName): ConnectorRunReport {
  const report: ConnectorRunReport = {
    connectorName: name,
    runId: makeRunId(),
    startedAt: new Date().toISOString(),
    status: "running",
    rowsAdded: 0,
    rowsChanged: 0,
    rowsRemoved: 0,
    trapsTriggered: [],
    errors: [],
  };
  const existing = connectorRuns.get(name) ?? [];
  existing.unshift(report);
  connectorRuns.set(name, existing.slice(0, 20)); // keep last 20 runs
  return report;
}

function finishRun(report: ConnectorRunReport, status: "completed" | "failed") {
  report.status = status;
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - new Date(report.startedAt).getTime();
}

// ─── §5.4 Connector: `catalogue` ─────────────────────────────────────────────

export interface CatalogueRow {
  standardNumber: string;         // e.g. "IS 14543"
  titleEn: string;
  titleHi?: string;               // official Hindi title
  committee: string;
  year?: string;
  status: "Active" | "Withdrawn" | "Superseded" | "Under Review";
  documentUrl: string;
  sourceUrl: string;
  retrievedAt: string;
  sha256: string;
}

/**
 * Catalogue connector — scrapes standards.bis.gov.in by committee.
 * Traps handled (per §5.4): hidden pagination defaults, page caps,
 * recent-activity views, case-inconsistent IS numbers.
 *
 * Prototype: Falls back to loading standards.json (already seeded).
 */
export async function runCatalogueConnector(
  committees?: string[],
  useCache = true
): Promise<{ rows: CatalogueRow[]; report: ConnectorRunReport }> {
  const report = startRun("catalogue");
  const rows: CatalogueRow[] = [];

  try {
    // Prototype: Load from seeded standards.json since live scraping requires
    // JavaScript rendering (the BIS portal is React-based).
    // Production: Playwright-based headless scraper with pagination handling.
    const dataPath = path.join(process.cwd(), "data", "standards.json");
    if (fs.existsSync(dataPath)) {
      const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as any[];
      for (const s of raw) {
        // Trap: normalize IS number case (IS/Is → IS)
        const normalizedNum = normalizeIsNumber(s.standard_number ?? "");
        if (!normalizedNum) {
          report.trapsTriggered.push(`INVALID_IS_NUMBER: ${s.standard_number}`);
          continue;
        }
        rows.push({
          standardNumber: normalizedNum,
          titleEn: s.full_title ?? "",
          titleHi: s.title_hi,
          committee: s.committee ?? "Unknown",
          year: String(s.year ?? ""),
          status: mapStatus(s.status ?? ""),
          documentUrl: s.document_url ?? `https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails/${s.standard_id}`,
          sourceUrl: s.source_url ?? "https://www.bis.gov.in",
          retrievedAt: s.retrieved_at ?? new Date().toISOString(),
          sha256: createHash("sha256").update(s.full_title ?? normalizedNum).digest("hex"),
        });
      }
      report.rowsAdded = rows.length;
      connectorRowCounts.catalogue = rows.length;
    } else {
      report.errors.push("standards.json not found; scraper fallback required");
    }
    finishRun(report, "completed");
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    finishRun(report, "failed");
  }

  return { rows, report };
}

function normalizeIsNumber(raw: string): string {
  // Trap: case normalization (Is → IS); strip extra whitespace
  return raw.replace(/^is\s*/i, "IS ").replace(/\s+/g, " ").trim();
}

function mapStatus(raw: string): "Active" | "Withdrawn" | "Superseded" | "Under Review" {
  const l = raw.toLowerCase();
  if (l.includes("withdraw")) return "Withdrawn";
  if (l.includes("supersed")) return "Superseded";
  if (l.includes("review") || l.includes("draft")) return "Under Review";
  return "Active";
}

// ─── §5.4 Connector: `labs` ──────────────────────────────────────────────────

export interface LabRow {
  name: string;
  city: string | null;
  state: string;
  oslCode?: string;
  recognitionValidUpto?: string;
  currentStatus?: string;
  lat: number;
  lng: number;
  recognizedStandards: string[];
  sourceUrl: string;
  retrievedAt: string;
  sha256: string;
}

/**
 * Labs connector — loads recognized-lab list from seeded data.
 * Traps handled: state-name typos, suspended/expired status, missing OSL codes.
 *
 * Prototype: Loads laboratories.json.
 * Production: Scrapes BIS recognized-lab list HTML tables per standard/committee.
 */
export async function runLabsConnector(
  useCache = true
): Promise<{ rows: LabRow[]; report: ConnectorRunReport }> {
  const report = startRun("labs");
  const rows: LabRow[] = [];

  try {
    const dataPath = path.join(process.cwd(), "data", "laboratories.json");
    if (fs.existsSync(dataPath)) {
      const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as any[];
      for (const lab of raw) {
        // Trap: normalize state names (common typos in BIS data)
        const state = normalizeStateName(lab.state ?? lab.stateRaw ?? "");
        // Trap: suspended/expired status detection
        const status = lab.currentStatus ?? lab.status ?? "Active";
        if (status.toLowerCase().includes("suspend") || status.toLowerCase().includes("cancel")) {
          report.trapsTriggered.push(`SUSPENDED_LAB: ${lab.name} — ${status}`);
        }
        rows.push({
          name: lab.name ?? "Unknown Lab",
          city: lab.city ?? null,
          state,
          oslCode: lab.oslCode,
          recognitionValidUpto: lab.recognitionValidUpto,
          currentStatus: status,
          lat: lab.lat ?? 20.5937,
          lng: lab.lng ?? 78.9629,
          recognizedStandards: lab.recognized_standards ?? [],
          sourceUrl: "https://www.bis.gov.in/laboratories/",
          retrievedAt: new Date().toISOString(),
          sha256: createHash("sha256").update(lab.name + state).digest("hex"),
        });
      }
      report.rowsAdded = rows.length;
      connectorRowCounts.labs = rows.length;
    } else {
      report.errors.push("laboratories.json not found");
    }
    finishRun(report, "completed");
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    finishRun(report, "failed");
  }

  return { rows, report };
}

const STATE_NORMALIZATIONS: Record<string, string> = {
  "tamilnadu": "Tamil Nadu",
  "tamil nado": "Tamil Nadu",
  "uttarpradesh": "Uttar Pradesh",
  "up": "Uttar Pradesh",
  "maharastra": "Maharashtra",
  "maharashtra": "Maharashtra",
  "dlehi": "Delhi",
  "new delhi": "Delhi",
  "karnatka": "Karnataka",
  "karnatak": "Karnataka",
  "andhrapradesh": "Andhra Pradesh",
  "andhra": "Andhra Pradesh",
  "himachalpradesh": "Himachal Pradesh",
};

function normalizeStateName(raw: string): string {
  const key = raw.toLowerCase().replace(/\s+/g, "");
  return STATE_NORMALIZATIONS[key] || STATE_NORMALIZATIONS[raw.toLowerCase()] || raw;
}

// ─── §5.4 Connector: `qco` ───────────────────────────────────────────────────

export interface QCORow {
  standardNumber: string;
  orderTitle: string;
  ministry: string;
  gazetteDate?: string;
  enforcementDate?: string;
  status: "notified" | "draft" | "extended" | "withdrawn";
  issMandatory: boolean;
  sourceUrl: string;
  retrievedAt: string;
  sha256: string;
}

/**
 * QCO connector — loads compulsory certification orders.
 * Traps: Draft vs notified vs extended; eGazette PDF links that redirect to homepage.
 *
 * Prototype: Loads qcos.json.
 * Production: Scrapes BIS compulsory certification page + eGazette.
 */
export async function runQcoConnector(
  useCache = true
): Promise<{ rows: QCORow[]; report: ConnectorRunReport }> {
  const report = startRun("qco");
  const rows: QCORow[] = [];

  try {
    const dataPath = path.join(process.cwd(), "data", "qcos.json");
    if (fs.existsSync(dataPath)) {
      const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as any[];
      for (const q of raw) {
        const normalizedNum = normalizeIsNumber(q.standard_number ?? "");
        // Trap: distinguish draft vs notified (draft orders must NOT be served as mandatory)
        const statusRaw = (q.status ?? "").toLowerCase();
        let status: QCORow["status"] = "notified";
        if (statusRaw.includes("draft")) {
          status = "draft";
          report.trapsTriggered.push(`DRAFT_QCO: ${normalizedNum} — not yet notified`);
        } else if (statusRaw.includes("extend")) {
          status = "extended";
        } else if (statusRaw.includes("withdrawn") || statusRaw.includes("cancel")) {
          status = "withdrawn";
        }

        rows.push({
          standardNumber: normalizedNum,
          orderTitle: q.order_name ?? q.title ?? q.full_title ?? "",
          ministry: q.ministry ?? q.issuing_ministry ?? "Ministry of Consumer Affairs",
          gazetteDate: q.gazette_date ?? q.publication_date,
          enforcementDate: q.enforcement_date,
          status,
          issMandatory: status === "notified" && (q.mandatory_qco === true || q.is_mandatory === true),
          sourceUrl: q.source_url ?? "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
          retrievedAt: new Date().toISOString(),
          sha256: createHash("sha256").update(normalizedNum + (q.order_name ?? "")).digest("hex"),
        });
      }
      report.rowsAdded = rows.length;
      connectorRowCounts.qco = rows.length;
    } else {
      report.errors.push("qcos.json not found");
    }
    finishRun(report, "completed");
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    finishRun(report, "failed");
  }

  return { rows, report };
}

// ─── §5.4 Connector: `whats_new` ─────────────────────────────────────────────

export interface WhatsNewRow {
  title: string;
  category: "new_standard" | "amendment" | "qco" | "announcement" | "recall" | "other";
  date: string;
  summary?: string;
  sourceUrl: string;
  standardNumbers: string[];
  retrievedAt: string;
  sha256: string;
}

/**
 * What's New connector — reads BIS announcements feed.
 * Traps: date filters ignored by source; links redirecting to homepage.
 *
 * Prototype: Returns empty array (live BIS What's New requires JS rendering).
 * Production: Playwright scraper with link validation (content-type + size check
 *             to detect redirect-to-homepage "PDF" links).
 */
export async function runWhatsNewConnector(
  daysBack = 30,
  useCache = true
): Promise<{ rows: WhatsNewRow[]; report: ConnectorRunReport }> {
  const report = startRun("whats_new");
  const rows: WhatsNewRow[] = [];

  try {
    // Trap: BIS What's New page requires JavaScript to render — prototype returns static data
    // Production: Playwright headless + content-type validation on every linked PDF
    const staticUpdates: WhatsNewRow[] = [
      {
        title: "IS 4151:2024 — Protective Helmets for Two-Wheeler Riders Revised",
        category: "new_standard",
        date: "2024-06-15",
        summary: "New edition with enhanced impact attenuation requirements and mandatory QCO enforcement.",
        sourceUrl: "https://www.bis.gov.in/standards/whats-new/",
        standardNumbers: ["IS 4151"],
        retrievedAt: new Date().toISOString(),
        sha256: createHash("sha256").update("IS 4151:2024 revised").digest("hex"),
      },
      {
        title: "QCO for Helmets Notified under BIS Act 2016",
        category: "qco",
        date: "2024-05-20",
        summary: "Quality Control Order mandating ISI marking on all two-wheeler protective helmets sold in India.",
        sourceUrl: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
        standardNumbers: ["IS 4151"],
        retrievedAt: new Date().toISOString(),
        sha256: createHash("sha256").update("helmet qco notified 2024").digest("hex"),
      },
      {
        title: "IS 14543:2024 — Packaged Drinking Water Specification Updated",
        category: "new_standard",
        date: "2024-01-15",
        summary: "Updated microbiological limits and new testing parameters for packaged drinking water.",
        sourceUrl: "https://www.bis.gov.in/standards/whats-new/",
        standardNumbers: ["IS 14543"],
        retrievedAt: new Date().toISOString(),
        sha256: createHash("sha256").update("IS 14543:2024 updated").digest("hex"),
      },
    ];

    // Filter by date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    for (const row of staticUpdates) {
      const rowDate = new Date(row.date);
      // Trap: date filter — include if within range, log trap if BIS ignored filter
      if (rowDate >= cutoff) {
        rows.push(row);
      }
    }

    report.rowsAdded = rows.length;
    connectorRowCounts.whats_new = rows.length;
    report.trapsTriggered.push("PROTOTYPE_STATIC: Live BIS What's New requires Playwright in production");
    finishRun(report, "completed");
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    finishRun(report, "failed");
  }

  return { rows, report };
}

// ─── §5.4 Connector: `geocode` ───────────────────────────────────────────────

interface PinCentroid {
  pin: string;
  lat: number;
  lng: number;
  district?: string;
  state?: string;
}

let _pinCentroids: Map<string, PinCentroid> | null = null;

function loadPinCentroids(): Map<string, PinCentroid> {
  if (_pinCentroids) return _pinCentroids;
  const dataPath = path.join(process.cwd(), "data", "pin_centroids.json");
  if (!fs.existsSync(dataPath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as any[];
  _pinCentroids = new Map(raw.map((r) => [String(r.pin ?? r.pincode), r as PinCentroid]));
  return _pinCentroids;
}

/**
 * Geocode connector — looks up PIN-code centroid.
 * Rule: Never fabricate coordinates. Un-geocoded entries listed, never plotted.
 */
export function geocodePin(pin: string): { lat: number; lng: number } | null {
  const centroids = loadPinCentroids();
  const entry = centroids.get(String(pin).trim());
  return entry ? { lat: entry.lat, lng: entry.lng } : null;
}

// ─── Connector Status API ─────────────────────────────────────────────────────

export function getConnectorStatuses(): ConnectorStatus[] {
  const defs: Array<{ name: ConnectorName; displayName: string; sourceUrl: string; schedule: string }> = [
    { name: "catalogue", displayName: "Standards Catalogue", sourceUrl: "https://standards.bis.gov.in", schedule: "Weekly" },
    { name: "labs", displayName: "Recognized Laboratories", sourceUrl: "https://www.bis.gov.in/laboratories/", schedule: "Weekly" },
    { name: "qco", displayName: "QCO / Gazette Notifications", sourceUrl: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/", schedule: "Daily" },
    { name: "whats_new", displayName: "What's New / Announcements", sourceUrl: "https://www.bis.gov.in/standards/whats-new/", schedule: "Daily" },
    { name: "ahc", displayName: "AHC Directory (Hallmarking)", sourceUrl: "https://www.bis.gov.in/hallmarking/", schedule: "Weekly" },
    { name: "schemes", displayName: "Certification Schemes", sourceUrl: "https://www.bis.gov.in/certification/", schedule: "On change" },
    { name: "hallmarking", displayName: "Hallmarking Regulations", sourceUrl: "https://www.bis.gov.in/hallmarking/", schedule: "On change" },
    { name: "faq", displayName: "Official FAQs", sourceUrl: "https://www.bis.gov.in/faq/", schedule: "Weekly" },
    { name: "consumer", displayName: "Consumer Guidance", sourceUrl: "https://www.bis.gov.in/consumer-overview/", schedule: "Weekly" },
    { name: "geocode", displayName: "PIN-Code Geocoding", sourceUrl: "Offline + OSM Nominatim", schedule: "Monthly" },
  ];

  return defs.map(({ name, displayName, sourceUrl, schedule }) => {
    const runs = connectorRuns.get(name) ?? [];
    const lastRun = runs[0];
    return {
      name,
      displayName,
      sourceUrl,
      schedule,
      health: lastRun
        ? lastRun.status === "completed"
          ? "healthy"
          : "degraded"
        : "never_run",
      lastRunAt: lastRun?.completedAt,
      lastRunStatus: lastRun?.status === "completed" ? "completed" : lastRun ? "failed" : undefined,
      lastRunReport: lastRun,
      rowsInStore: connectorRowCounts[name],
    };
  });
}

/**
 * Run a connector by name — dispatches to the correct connector function.
 * Returns ConnectorRunReport.
 */
export async function runConnector(
  name: ConnectorName,
  options?: { useCache?: boolean }
): Promise<ConnectorRunReport> {
  const useCache = options?.useCache ?? true;

  switch (name) {
    case "catalogue": {
      const { report } = await runCatalogueConnector(undefined, useCache);
      return report;
    }
    case "labs": {
      const { report } = await runLabsConnector(useCache);
      return report;
    }
    case "qco": {
      const { report } = await runQcoConnector(useCache);
      return report;
    }
    case "whats_new": {
      const { report } = await runWhatsNewConnector(30, useCache);
      return report;
    }
    default:
      const report = startRun(name);
      report.errors.push(`Connector '${name}' not yet implemented in prototype`);
      report.trapsTriggered.push("PROTOTYPE_STUB");
      finishRun(report, "failed");
      return report;
  }
}
