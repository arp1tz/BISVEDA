"use client";

import React, { useState, useMemo } from "react";
import { MapPin, Navigation, Map as MapIcon, ExternalLink, Compass } from "lucide-react";
import { LabsMap } from "./LabsMap";

export interface LabItem {
  id: string;
  name: string;
  city: string;
  state: string;
  distance_km?: number;
  lat?: number;
  lng?: number;
  detail_url?: string;
  source: string;
}

interface LabsListProps {
  labs?: LabItem[] | null;
  onRequestLocation?: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

// Haversine formula to compute distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function LabsList({ labs, onRequestLocation, userLocation }: LabsListProps) {
  const [showMap, setShowMap] = useState(false);

  // Compute distances & sort when userLocation is present
  const sortedLabs = useMemo(() => {
    if (!labs || labs.length === 0) return [];
    if (!userLocation) return labs;

    return [...labs]
      .map((lab) => {
        let dist = lab.distance_km;
        if (dist === undefined && typeof lab.lat === "number" && typeof lab.lng === "number") {
          dist = calculateDistanceKm(userLocation.lat, userLocation.lng, lab.lat, lab.lng);
        }
        return { ...lab, distance_km: dist };
      })
      .sort((a, b) => {
        const distA = a.distance_km ?? Infinity;
        const distB = b.distance_km ?? Infinity;
        return distA - distB;
      });
  }, [labs, userLocation]);

  if (!labs || labs.length === 0) {
    return (
      <div className="space-y-2 p-2 text-xs">
        <p className="text-[#64748B] italic">No accredited laboratories found for this standard in our records.</p>
        {onRequestLocation && (
          <button
            type="button"
            onClick={onRequestLocation}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#0B2A4A] hover:bg-[#E5E7EB] font-medium transition-colors cursor-pointer"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Use my location</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[#64748B] font-medium flex items-center gap-1.5">
          <span>{sortedLabs.length} Recognised {sortedLabs.length === 1 ? "Laboratory" : "Laboratories"}</span>
          {userLocation && (
            <span className="text-[#228f4a] font-semibold text-[11px]">(Sorted by distance)</span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {onRequestLocation && (
            <button
              type="button"
              onClick={onRequestLocation}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
                userLocation
                  ? "bg-[#228f4a]/10 border-[#228f4a] text-[#228f4a]"
                  : "border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] text-[#0B2A4A]"
              }`}
              title={userLocation ? "Location active" : "Find labs closest to your location"}
            >
              <Navigation className="h-3 w-3" />
              <span>{userLocation ? "Location active" : "Near me"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
              showMap
                ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                : "border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] text-[#0F172A]"
            }`}
          >
            <MapIcon className="h-3 w-3" />
            <span>{showMap ? "Hide map" : "Show map"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Preview with Pins */}
      {showMap && (
        <div className="my-2">
          <LabsMap labs={sortedLabs} userLocation={userLocation} />
        </div>
      )}

      {/* Lab List */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {sortedLabs.map((lab, idx) => (
          <div
            key={lab.id || idx}
            className="p-2.5 rounded-lg border border-[#E5E7EB] bg-white flex items-start justify-between gap-2 shadow-2xs hover:border-[#0B2A4A]/30 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0B2A4A]/5 text-[#0B2A4A]">
                  #{idx + 1}
                </span>
                <h4 className="font-semibold text-xs text-[#0F172A] truncate">{lab.name}</h4>
              </div>
              <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 shrink-0 text-[#64748B]" />
                <span>
                  {lab.city}, {lab.state}
                </span>
                {lab.distance_km !== undefined && (
                  <span className="font-bold text-[#E8710A] ml-1">
                    · {lab.distance_km.toFixed(1)} km away
                  </span>
                )}
              </p>
            </div>

            {lab.detail_url && (
              <a
                href={lab.detail_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#0B2A4A] hover:underline p-1 shrink-0 inline-flex items-center gap-0.5 text-[11px]"
                title="View LIMS Lab Detail"
              >
                <span>LIMS</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
