/**
 * BISVEDA — Assaying & Hallmarking Centre (AHC) directory connector (P1.9)
 *
 * Source: Manak Online's public AHC list
 * (https://www.manakonline.in/MANAK/AHCListForWebsite), which returns the
 * entire national list (~1,600+ centres) as one server-rendered table with
 * no pagination.
 *
 * We geocode by (district, state) via OSM Nominatim, once per unique pair
 * (not once per centre — many centres share a district), at 1 request/second
 * with an on-disk cache. A centre whose district/state we can't confidently
 * parse, or that Nominatim can't find, is kept with lat/lng: null — listed,
 * never plotted at a guessed point.
 *
 * Usage: npm run dir:ahc  (from prototype/)
 */

import fs from "fs";
import path from "path";
import type { AhcRecord } from "./types";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const CACHE_DIR = path.join(PROTOTYPE_ROOT, "data", "directory", ".cache");
const OUT_DIR = path.join(PROTOTYPE_ROOT, "data", "directory");
const LIST_URL = "https://www.manakonline.in/MANAK/AHCListForWebsite";
const RETRIEVED_AT = new Date().toISOString();

const STATES = [
  "ANDAMAN & NICOBAR", "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR",
  "CHANDIGARH", "CHHATTISGARH", "DADRA & NAGAR HAVELI", "DAMAN & DIU", "DELHI",
  "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR",
  "JHARKHAND", "KARNATAKA", "KERALA", "LADAKH", "LAKSHADWEEP",
  "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM",
  "NAGALAND", "ODISHA", "PONDICHERY", "PUNJAB", "RAJASTHAN", "SIKKIM",
  "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTARAKHAND", "UTTAR PRADESH",
  "WEST BENGAL",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchListHtml(): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, "ahc-list.html");
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf-8");

  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (BISVEDA prototype knowledge-base builder)" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`GET ${LIST_URL} -> HTTP ${res.status}`);
  const html = await res.text();
  fs.writeFileSync(cacheFile, html, "utf-8");
  return html;
}

interface RawAhcRow {
  slNo: string;
  recognitionNo: string;
  validity: string;
  name: string;
  addressRaw: string;
  metals: string;
  tel: string;
  email: string;
  status: string;
}

function parseAhcRows(html: string): RawAhcRow[] {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const bodyMatch = noComments.match(/<tbody[^>]*>([\s\S]*)<\/tbody>/i);
  const body = bodyMatch ? bodyMatch[1] : noComments;
  const rowChunks = body.split(/<tr>/i).slice(1);

  const rows: RawAhcRow[] = [];
  const skipped: number[] = [];

  rowChunks.forEach((chunk, idx) => {
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = tdRe.exec(chunk)) !== null) tds.push(m[1]);

    if (tds.length < 4) {
      skipped.push(idx);
      return;
    }

    const [col1, col2, col3, col4] = tds;
    const labelRe = /<label[^>]*>([\s\S]*?)<\/label>/g;
    const col2Labels: string[] = [];
    let lm: RegExpExecArray | null;
    while ((lm = labelRe.exec(col2)) !== null) col2Labels.push(stripHtml(lm[1]));

    const recognitionNo = (col2Labels[0] || "").replace(/^Recognition No\.:\s*/i, "");
    const validity = (col2Labels[1] || "").replace(/^Validity:\s*/i, "");
    const name = col2Labels[2] || "";
    const addressRaw = col2Labels[3] || "";
    const metals = (col2Labels[4] || "").replace(/^Recognized for\s*/i, "");

    const telMatch = col3.match(/Tel:\s*([^<]*)/i);
    const emailMatch = col3.match(/Email:\s*([^<]*)/i);

    rows.push({
      slNo: stripHtml(col1),
      recognitionNo,
      validity,
      name,
      addressRaw,
      metals,
      tel: telMatch ? stripHtml(telMatch[1]) : "",
      email: emailMatch ? stripHtml(emailMatch[1]) : "",
      status: stripHtml(col4),
    });
  });

  if (rowChunks.length > 0 && skipped.length > rowChunks.length * 0.5) {
    throw new Error(
      `Manak Online AHC page structure looks different from what we verified: ${skipped.length}/${rowChunks.length} rows failed to parse. Stopping rather than writing bad data.`
    );
  }

  return rows;
}

/** Splits the free-text address into {address, district, state, pin}. Never guesses a state/pin that isn't literally present. */
function parseAddress(raw: string): { address: string; district?: string; state?: string; pin?: string } {
  const pinMatch = raw.match(/(\d{6})\s*$/);
  const pin = pinMatch ? pinMatch[1] : undefined;
  const withoutPin = pin ? raw.slice(0, raw.lastIndexOf(pin)) : raw;
  const parts = withoutPin.split(",").map((p) => p.trim()).filter(Boolean);

  let state: string | undefined;
  let stateIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const found = STATES.find((s) => parts[i].toUpperCase() === s || parts[i].toUpperCase().includes(s));
    if (found) {
      state = found;
      stateIdx = i;
      break;
    }
  }

  const district = stateIdx > 0 ? parts[stateIdx - 1] : undefined;
  const address = stateIdx >= 0 ? parts.slice(0, stateIdx - (district ? 1 : 0)).join(", ") : withoutPin.trim();

  return { address, district, state, pin };
}

interface GeoResult {
  lat: number;
  lng: number;
}

async function geocode(query: string): Promise<GeoResult | null> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, "geo-" + encodeURIComponent(query) + ".json");
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    return cached; // may be null (a previously-failed lookup, cached so we don't retry every run)
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BISVEDA-prototype/1.0 (educational hackathon project)" },
      signal: AbortSignal.timeout(15000),
    });
    let result: GeoResult | null = null;
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
    fs.writeFileSync(cacheFile, JSON.stringify(result), "utf-8");
    return result;
  } catch {
    fs.writeFileSync(cacheFile, JSON.stringify(null), "utf-8");
    return null;
  } finally {
    await sleep(1000); // Nominatim usage policy: max 1 request/second
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("BISVEDA — AHC Directory Build (Manak Online)");
  console.log("=".repeat(70));

  const html = await fetchListHtml();
  const rows = parseAhcRows(html);
  console.log(`Parsed ${rows.length} AHC rows.\n`);

  const parsedAddresses = rows.map((r) => parseAddress(r.addressRaw));
  const geocodableQueries = new Set<string>();
  parsedAddresses.forEach((a) => {
    if (a.district && a.state) geocodableQueries.add(`${a.district}, ${a.state}, India`);
    else if (a.state) geocodableQueries.add(`${a.state}, India`);
  });

  console.log(`Geocoding ${geocodableQueries.size} unique district/state pairs via Nominatim (1 req/s, cached)...`);
  const geoCache = new Map<string, GeoResult | null>();
  let geocoded = 0;
  for (const q of geocodableQueries) {
    geoCache.set(q, await geocode(q));
    geocoded++;
    if (geocoded % 25 === 0) process.stdout.write(`\r  ${geocoded}/${geocodableQueries.size}`);
  }
  process.stdout.write(`\r  ${geocoded}/${geocodableQueries.size}\n`);

  const records: AhcRecord[] = rows.map((row, i) => {
    const addr = parsedAddresses[i];
    let geo: GeoResult | null = null;
    let geocodeQuality: AhcRecord["geocode"] = "none";
    if (addr.district && addr.state) {
      geo = geoCache.get(`${addr.district}, ${addr.state}, India`) || null;
      if (geo) geocodeQuality = "district";
    }
    if (!geo && addr.state) {
      geo = geoCache.get(`${addr.state}, India`) || null;
      if (geo) geocodeQuality = "district"; // state-level fallback, still an approximation, not a guess beyond the data
    }

    return {
      recognition_no: row.recognitionNo,
      name: row.name,
      address: addr.address,
      district: addr.district,
      state: addr.state,
      pin: addr.pin,
      metals: row.metals,
      contact: [row.tel, row.email].filter(Boolean).join(" / "),
      status: row.status,
      validity: row.validity,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      geocode: geocodeQuality,
      source_url: LIST_URL,
      retrieved_at: RETRIEVED_AT,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "ahc.json"), JSON.stringify(records, null, 2), "utf-8");

  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
  console.log(`Total AHCs: ${records.length}`);
  console.log(`  Operative: ${records.filter((r) => /operative/i.test(r.status)).length}`);
  console.log(`  Geocoded:  ${records.filter((r) => r.lat != null).length}`);
  console.log(`  Not geocoded: ${records.filter((r) => r.lat == null).length}`);
}

main().catch((err) => {
  console.error("\nAHC DIRECTORY BUILD FAILED:", err.message || err);
  process.exit(1);
});
