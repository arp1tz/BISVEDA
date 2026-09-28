/**
 * BISVEDA — Labs Finder Tool (src/lib/tools/labs.ts, P5.1)
 *
 * Queries official BIS LIMS recognised laboratories from data/directory/labs.json.
 * Filters by validity (unexpired status/recognition date), sorts by haversine distance
 * (if lat/lng is available) or city/state match, and returns the top 8 labs.
 *
 * Real data only: never fabricates lab names, addresses, or scopes.
 */

import { getAllLabs, getLabsForStandard, getStandardById } from "../kb/store";
import type { LabRecord } from "../kb/types";

export interface FindLabsOptions {
  standard?: string;
  city?: string;
  state?: string;
  location?: { lat: number; lng: number };
}

export interface FindLabsResult {
  standardId: string;
  labs: LabRecord[];
  retrievedNote: string;
  textPrefix: string;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
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

function isLabValid(lab: LabRecord): boolean {
  if (lab.current_status && lab.current_status.toLowerCase() === "expired") {
    return false;
  }
  if (lab.recognition_valid_upto) {
    const validDate = new Date(lab.recognition_valid_upto);
    if (!isNaN(validDate.getTime())) {
      const now = new Date();
      // If recognition date is in the past, filter it out
      if (validDate < now) return false;
    }
  }
  return true;
}

function cleanStr(s?: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Finds up to 8 valid BIS-recognised labs for a standard, sorted by distance or location match.
 */
export function findLabs(options: FindLabsOptions): FindLabsResult {
  let targetStandardId = options.standard ? options.standard.trim() : "";
  if (targetStandardId) {
    const resolvedStd = getStandardById(targetStandardId);
    if (resolvedStd) targetStandardId = resolvedStd.id;
  }

  let candidates: LabRecord[] = [];
  if (targetStandardId) {
    candidates = getLabsForStandard(targetStandardId);
  } else {
    candidates = getAllLabs();
  }

  // Filter unexpired validity
  const validLabs = candidates.filter(isLabValid);

  // Sorting
  const cityQuery = cleanStr(options.city);
  const stateQuery = cleanStr(options.state);

  if (options.location && typeof options.location.lat === "number" && typeof options.location.lng === "number") {
    const userLat = options.location.lat;
    const userLng = options.location.lng;

    validLabs.sort((a, b) => {
      const distA = a.lat && a.lng ? haversineDistanceKm(userLat, userLng, a.lat, a.lng) : 999999;
      const distB = b.lat && b.lng ? haversineDistanceKm(userLat, userLng, b.lat, b.lng) : 999999;
      return distA - distB;
    });
  } else if (cityQuery || stateQuery) {
    validLabs.sort((a, b) => {
      const aCity = cleanStr(a.city);
      const bCity = cleanStr(b.city);
      const aState = cleanStr(a.state);
      const bState = cleanStr(b.state);

      let scoreA = 0;
      let scoreB = 0;

      if (cityQuery) {
        if (aCity === cityQuery) scoreA += 100;
        else if (aCity.includes(cityQuery) || cityQuery.includes(aCity)) scoreA += 50;

        if (bCity === cityQuery) scoreB += 100;
        else if (bCity.includes(cityQuery) || cityQuery.includes(bCity)) scoreB += 50;
      }

      if (stateQuery) {
        if (aState === stateQuery) scoreA += 30;
        else if (aState.includes(stateQuery) || stateQuery.includes(aState)) scoreA += 15;

        if (bState === stateQuery) scoreB += 30;
        else if (bState.includes(stateQuery) || stateQuery.includes(bState)) scoreB += 15;
      }

      return scoreB - scoreA;
    });
  }

  const topLabs = validLabs.slice(0, 8);

  const retrievedDate = topLabs[0]?.retrieved_at
    ? topLabs[0].retrieved_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const stdDisplay = targetStandardId || "Indian Standards";
  const retrievedNote = `BIS-recognised labs listing ${stdDisplay} in their scope (BIS LIMS, retrieved ${retrievedDate}).`;
  const textPrefix = `Here are official BIS-recognised laboratories listing ${stdDisplay} in their scope (from BIS LIMS):`;

  return {
    standardId: targetStandardId,
    labs: topLabs,
    retrievedNote,
    textPrefix,
  };
}
