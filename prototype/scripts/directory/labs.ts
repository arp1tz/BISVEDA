/**
 * BISVEDA — Labs directory connector (P1.8)
 *
 * Source: BIS LIMS "Search by IS Number" (https://lims.bis.gov.in/home/search_is_number/),
 * which supports `?is_number__doc_no=<number>` as a plain GET filter and returns
 * every recognised lab whose scope includes that standard, with Lab Name + OSL Code.
 *
 * We query it once per KB standard's base IS number, join the results to the
 * existing `prototype/data/laboratories.json` (a real BIS OSL list, kept from
 * before the P0 cleanup) by OSL code for city/state/lat/lng, and write
 * data/directory/labs.json.
 *
 * Crawl rules: 1 request/second, on-disk HTML cache (re-runs are free), every
 * record keeps `source_url` + `retrieved_at`, and the run fails loudly if the
 * page's structure no longer matches what we verified by hand.
 *
 * Usage: npm run dir:labs  (from prototype/)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "../kb/env";
loadEnv();

import { SOURCES } from "../kb/sources";
import type { LabRecord, LabScopeEntry } from "./types";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const CACHE_DIR = path.join(PROTOTYPE_ROOT, "data", "directory", ".cache");
const OUT_DIR = path.join(PROTOTYPE_ROOT, "data", "directory");
const LABS_SEED_PATH = path.join(PROTOTYPE_ROOT, "data", "laboratories.json");
const SEARCH_BASE = "https://lims.bis.gov.in/home/search_is_number/";
const RETRIEVED_AT = new Date().toISOString();

// Base IS document numbers to query. "9873" covers both Part 1 and Part 3 —
// which part a given scope row belongs to is decided from its own text.
const QUERY_NUMBERS = ["4151", "2925", "15644", "9873", "1417", "1418", "15820"];

/** Maps a base doc number + the row's own IS-number/product text to one of our canonical standard ids. */
function resolveStandardId(docNo: string, isNumberRaw: string, product: string): string | null {
  if (docNo === "9873") {
    const text = `${isNumberRaw} ${product}`.toLowerCase();
    if (/part\s*1\b/.test(text) || /mechanical/.test(text) || /physical propert/.test(text)) {
      return "IS 9873 (Part 1)";
    }
    if (/part\s*3\b/.test(text) || /migration/.test(text)) {
      return "IS 9873 (Part 3)";
    }
    return null; // can't tell which part — don't guess
  }
  const known = SOURCES.find((s) => s.standard_id.replace(/\D/g, "") === docNo);
  return known ? known.standard_id : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithCache(url: string): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, encodeURIComponent(url) + ".html");
  if (fs.existsSync(cacheFile)) {
    return fs.readFileSync(cacheFile, "utf-8");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (BISVEDA prototype knowledge-base builder)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`);
  }
  const html = await res.text();
  fs.writeFileSync(cacheFile, html, "utf-8");
  await sleep(1000); // 1 request/second
  return html;
}

interface RawSearchRow {
  labName: string;
  oslCode: string;
  isNumberRaw: string;
  product: string;
  grade: string;
  validityRaw: string;
  remark: string;
}

function stripHtml(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses the "Search by IS Number" results table. The page's HTML is
 * malformed in places (some cells close with `</th>` instead of `</td>`,
 * and there is a large legacy testing-charges modal embedded inside each
 * row) — see scripts/directory/README-lims-html-notes.md in the plan for
 * how this was verified. Column order for this global search view is:
 * S.No, Lab Name, OSL Code, Indian Standard No., Product, Grade, Charges
 * (+ nested modal), Validity Date, Remark — and Validity/Remark are always
 * the last two real (non-comment) cells in a row, however big the modal is.
 */
function parseSearchRows(html: string): RawSearchRow[] {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const rowChunks = noComments.split(/<tr\s+id="tr_\d+"/).slice(1);

  const rows: RawSearchRow[] = [];
  const skipped: number[] = [];

  rowChunks.forEach((chunk, idx) => {
    const cellRe = /<td[^>]*>([\s\S]*?)<\/(?:td|th)>/g;
    const cells: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(chunk)) !== null) {
      cells.push(m[1]);
    }
    if (cells.length < 8) {
      skipped.push(idx);
      return;
    }
    rows.push({
      labName: stripHtml(cells[1]),
      oslCode: stripHtml(cells[2]),
      isNumberRaw: stripHtml(cells[3]),
      product: stripHtml(cells[4]),
      grade: stripHtml(cells[5]),
      validityRaw: stripHtml(cells[cells.length - 2]),
      remark: stripHtml(cells[cells.length - 1]),
    });
  });

  if (rowChunks.length > 0 && skipped.length > rowChunks.length * 0.5) {
    throw new Error(
      `LIMS search page structure looks different from what we verified: ${skipped.length}/${rowChunks.length} rows failed to parse. Stopping rather than writing bad data.`
    );
  }

  return rows;
}

interface SeedLab {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  currentStatus?: string;
  recognitionValidUpto?: string;
}

function loadSeedLabs(): Map<string, SeedLab> {
  const raw: SeedLab[] = JSON.parse(fs.readFileSync(LABS_SEED_PATH, "utf-8"));
  const byOsl = new Map<string, SeedLab>();
  for (const lab of raw) byOsl.set(lab.id, lab);
  return byOsl;
}

async function main() {
  console.log("=".repeat(70));
  console.log("BISVEDA — Labs Directory Build (BIS LIMS)");
  console.log("=".repeat(70));

  const seedLabs = loadSeedLabs();
  console.log(`Seed lab list: ${seedLabs.size} labs (OSL-keyed).\n`);

  const byOsl = new Map<string, LabRecord>();

  for (const docNo of QUERY_NUMBERS) {
    const url = `${SEARCH_BASE}?is_number__doc_no=${docNo}`;
    process.stdout.write(`[${docNo}] fetching ${url} ...`);
    const html = await fetchWithCache(url);
    const rows = parseSearchRows(html);
    process.stdout.write(` ${rows.length} rows.\n`);

    for (const row of rows) {
      const standardId = resolveStandardId(docNo, row.isNumberRaw, row.product);
      if (!standardId) continue; // e.g. an IS 9873 row we couldn't attribute to Part 1 or Part 3

      let lab = byOsl.get(row.oslCode);
      if (!lab) {
        const seed = seedLabs.get(row.oslCode);
        lab = {
          id: row.oslCode,
          name: seed?.name || row.labName,
          city: seed?.city,
          state: seed?.state,
          lat: seed?.lat,
          lng: seed?.lng,
          geocode: seed?.lat != null ? "city-centroid" : "none",
          current_status: seed?.currentStatus,
          recognition_valid_upto: seed?.recognitionValidUpto,
          standards_in_scope: [],
          scope: [],
          source_url: url,
          retrieved_at: RETRIEVED_AT,
        };
        byOsl.set(row.oslCode, lab);
      }

      if (!lab.standards_in_scope.includes(standardId)) {
        lab.standards_in_scope.push(standardId);
      }
      const scopeEntry: LabScopeEntry = {
        standard_id: standardId,
        is_number_raw: row.isNumberRaw,
        product: row.product,
        grade: row.grade,
        validity_raw: row.validityRaw,
        remark: row.remark,
      };
      lab.scope.push(scopeEntry);
    }
  }

  const labs = Array.from(byOsl.values()).sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "labs.json"), JSON.stringify(labs, null, 2), "utf-8");

  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
  console.log(`Labs with at least one KB standard in scope: ${labs.length}`);
  const geocoded = labs.filter((l) => l.geocode === "city-centroid").length;
  console.log(`  geocoded (city centroid): ${geocoded}`);
  console.log(`  not geocoded: ${labs.length - geocoded}`);
  const byStd = new Map<string, number>();
  for (const lab of labs) for (const s of lab.standards_in_scope) byStd.set(s, (byStd.get(s) || 0) + 1);
  for (const [std, count] of Array.from(byStd.entries()).sort()) {
    console.log(`  ${std.padEnd(20)} ${count} labs`);
  }
}

main().catch((err) => {
  console.error("\nLABS DIRECTORY BUILD FAILED:", err.message || err);
  process.exit(1);
});
