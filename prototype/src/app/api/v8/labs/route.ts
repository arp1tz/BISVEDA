/**
 * GET /api/v8/labs
 * §5.2, §21.3 | Spec ref: v8 architecture bis veda.txt
 *
 * Recognized Laboratory Directory with Haversine PIN-code distance calculation.
 */

import { NextRequest, NextResponse } from "next/server";
import labsData from "../../../../../data/laboratories.json";
import pinCentroidsData from "../../../../../data/pin_centroids.json";
import type { LaboratoryRecord } from "@/lib/types";

const labs = labsData as unknown as LaboratoryRecord[];
const pinCentroids: Record<string, { city: string; state: string; lat: number; lng: number }> =
  pinCentroidsData as any;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLng = ((lng2 - lng1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLng / 2.0) *
      Math.sin(dLng / 2.0);
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return Math.round(r * c * 10) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isQuery = searchParams.get("is")?.toUpperCase().trim();
  const pinQuery = searchParams.get("pin")?.trim();
  const stateQuery = searchParams.get("state")?.toLowerCase().trim();
  const radiusKm = parseFloat(searchParams.get("radius_km") || "0");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  let filtered = [...labs];

  // 1. Filter by Standard if provided
  if (isQuery) {
    const cleanIs = isQuery.split(":")[0].replace(/\s+/g, "");
    filtered = filtered.filter((l) => {
      const scopeMatches = (l.testing_scope || []).some((std: string) =>
        std.replace(/\s+/g, "").toUpperCase().includes(cleanIs)
      );
      const recognizedMatches = (l.recognized_standards || []).some((std: string) =>
        std.replace(/\s+/g, "").toUpperCase().includes(cleanIs)
      );
      return scopeMatches || recognizedMatches;
    });
  }

  // 2. Filter by State if provided
  if (stateQuery) {
    filtered = filtered.filter((l) =>
      l.state?.toLowerCase().includes(stateQuery)
    );
  }

  // 3. Distance calculation if PIN provided
  let userCoords: { lat: number; lng: number; city: string; state: string } | null = null;
  if (pinQuery && pinCentroids[pinQuery]) {
    userCoords = pinCentroids[pinQuery];
  }

  interface LabWithDistance extends LaboratoryRecord {
    distance_km?: number;
    has_exact_coordinates: boolean;
  }

  const results: LabWithDistance[] = filtered.map((l) => {
    let distance: number | undefined;
    const hasCoords = typeof l.lat === "number" && typeof l.lng === "number";

    if (userCoords && hasCoords) {
      distance = haversineKm(userCoords.lat, userCoords.lng, l.lat, l.lng);
    }

    return {
      ...l,
      distance_km: distance,
      has_exact_coordinates: hasCoords,
    };
  });

  // Filter by radius if requested and distance is available
  let finalResults = results;
  if (userCoords && radiusKm > 0) {
    finalResults = finalResults.filter(
      (l) => l.distance_km !== undefined && l.distance_km <= radiusKm
    );
  }

  // Sort by distance if user coords available, otherwise alphabetical
  if (userCoords) {
    finalResults.sort((a, b) => {
      if (a.distance_km === undefined && b.distance_km === undefined) return 0;
      if (a.distance_km === undefined) return 1;
      if (b.distance_km === undefined) return -1;
      return a.distance_km - b.distance_km;
    });
  } else {
    finalResults.sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({
    total_found: finalResults.length,
    user_location: userCoords,
    returned: finalResults.slice(0, limit).length,
    labs: finalResults.slice(0, limit),
  });
}
