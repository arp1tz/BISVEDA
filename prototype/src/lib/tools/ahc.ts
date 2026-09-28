/**
 * BISVEDA — Assaying and Hallmarking Centres (AHC) Tool (src/lib/tools/ahc.ts, P5.2)
 *
 * Queries official Manak Online AHC directory from data/directory/ahc.json.
 * Filters for status "Operative" only, sorts by distance or district/state/city match,
 * and returns the top 10 centres for map and list presentation.
 *
 * Real data only: never fabricates centres or locations.
 */

import { getAllAhcs } from "../kb/store";
import type { AhcRecord } from "../kb/types";

export interface FindAhcOptions {
  city?: string;
  district?: string;
  state?: string;
  location?: { lat: number; lng: number };
}

export interface FindAhcResult {
  ahcs: AhcRecord[];
  totalFound: number;
  retrievedNote: string;
  textPrefix: string;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function cleanStr(s?: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Finds up to 10 operative BIS-recognised Assaying and Hallmarking Centres.
 */
export function findAhc(options: FindAhcOptions): FindAhcResult {
  const all = getAllAhcs();
  // Filter status Operative only
  const operative = all.filter(
    (a) => a.status && a.status.trim().toLowerCase() === "operative"
  );

  const cityQuery = cleanStr(options.city || options.district);
  const stateQuery = cleanStr(options.state);

  let scored = [...operative];

  if (options.location && typeof options.location.lat === "number" && typeof options.location.lng === "number") {
    const userLat = options.location.lat;
    const userLng = options.location.lng;

    scored.sort((a, b) => {
      const distA = a.lat !== null && a.lng !== null ? haversineDistanceKm(userLat, userLng, a.lat, a.lng) : 999999;
      const distB = b.lat !== null && b.lng !== null ? haversineDistanceKm(userLat, userLng, b.lat, b.lng) : 999999;
      return distA - distB;
    });
  } else if (cityQuery || stateQuery) {
    scored.sort((a, b) => {
      const aDist = cleanStr(a.district);
      const bDist = cleanStr(b.district);
      const aState = cleanStr(a.state);
      const bState = cleanStr(b.state);
      const aAddr = cleanStr(a.address);
      const bAddr = cleanStr(b.address);

      let scoreA = 0;
      let scoreB = 0;

      if (cityQuery) {
        if (aDist === cityQuery) scoreA += 100;
        else if (aDist.includes(cityQuery) || cityQuery.includes(aDist)) scoreA += 50;
        else if (aAddr.includes(cityQuery)) scoreA += 30;

        if (bDist === cityQuery) scoreB += 100;
        else if (bDist.includes(cityQuery) || cityQuery.includes(bDist)) scoreB += 50;
        else if (bAddr.includes(cityQuery)) scoreB += 30;
      }

      if (stateQuery) {
        if (aState === stateQuery) scoreA += 40;
        else if (aState.includes(stateQuery) || stateQuery.includes(aState)) scoreA += 20;

        if (bState === stateQuery) scoreB += 40;
        else if (bState.includes(stateQuery) || stateQuery.includes(bState)) scoreB += 20;
      }

      return scoreB - scoreA;
    });
  }

  const top10 = scored.slice(0, 10);
  const retrievedDate = top10[0]?.retrieved_at
    ? top10[0].retrieved_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const locLabel = options.city || options.district || options.state || "India";
  const retrievedNote = `BIS-recognised Operative Assaying and Hallmarking Centres in/near ${locLabel} (Manak Online, retrieved ${retrievedDate}).`;
  const textPrefix = `Here are official BIS-recognised Operative Assaying and Hallmarking Centres (AHCs) retrieved from Manak Online:`;

  return {
    ahcs: top10,
    totalFound: scored.length,
    retrievedNote,
    textPrefix,
  };
}
