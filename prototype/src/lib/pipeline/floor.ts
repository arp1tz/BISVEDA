/**
 * BISVEDA V9 — Stage 7: Floor Check (lib/pipeline/floor.ts)
 * 
 * Compares the best signal (top semantic similarity or exact/taxonomy hit)
 * against the calibrated floor threshold loaded from data/calibration.json.
 * 
 * If below floor: returns refusal_not_in_sources with official routes.
 */

import fs from "fs";
import path from "path";
import { FusedResults } from "./fuse";
import { MultiStoreRetrievalResult } from "./retrieve";

export interface FloorCheckResult {
  passed: boolean;
  signalScore: number;
  threshold: number;
  reason?: "not_in_sources";
  refusalMessage?: string;
  officialRoutes?: Array<{ text: string; url?: string }>;
}

let cachedThreshold: number | null = null;

export function getCalibratedThreshold(): number {
  if (cachedThreshold !== null) return cachedThreshold;

  const candidatePaths = [
    path.resolve(process.cwd(), "data/calibration.json"),
    path.resolve(process.cwd(), "../data/calibration.json"),
    path.resolve(__dirname, "../../../data/calibration.json"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (typeof data.threshold === "number") {
          cachedThreshold = data.threshold;
          return data.threshold;
        }
      } catch {}
    }
  }

  // Safe fallback if calibration file is absent
  cachedThreshold = 0.45;
  return 0.45;
}

export function checkRelevanceFloor(
  fused: FusedResults,
  raw: MultiStoreRetrievalResult
): FloorCheckResult {
  const threshold = getCalibratedThreshold();

  // 1. Exact or Taxonomy/Graph hits ALWAYS pass
  if (raw.exactHits.length > 0 || raw.graphHits.length > 0) {
    return {
      passed: true,
      signalScore: 1.0,
      threshold,
    };
  }

  // 2. Best semantic chunk similarity among top 5
  let maxSimilarity = 0;
  for (const c of fused.rankedChunks.slice(0, 5)) {
    if (c.similarity && c.similarity > maxSimilarity) {
      maxSimilarity = c.similarity;
    }
  }

  if (maxSimilarity >= threshold) {
    return {
      passed: true,
      signalScore: maxSimilarity,
      threshold,
    };
  }

  // 3. Below Floor -> Out-of-Corpus Refusal
  return {
    passed: false,
    signalScore: maxSimilarity,
    threshold,
    reason: "not_in_sources",
    refusalMessage: "I couldn't find this in the official BIS sources I have in this prototype.",
    officialRoutes: [
      {
        text: "Search the official BIS Standards Catalogue (Know Your Standards portal)",
        url: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails",
      },
      {
        text: "National Consumer Helpline (NCH): Dial 1915 or visit consumerhelpline.gov.in",
        url: "https://consumerhelpline.gov.in/",
      },
      {
        text: "BIS Care Portal & Mobile App",
        url: "https://www.bis.gov.in/",
      },
    ],
  };
}
