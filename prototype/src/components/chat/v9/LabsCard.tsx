"use client";

import React, { useState, useMemo } from "react";
import {
  FlaskConical,
  MapPin,
  ExternalLink,
  Calendar,
  ShieldCheck,
  Navigation,
  Compass,
  Search,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import type { LabsCard as LabsCardData } from "@/lib/pipeline/respond";
import type { LabRecord } from "@/lib/kb/types";
import { LabsMap } from "./LabsMap";

interface LabsCardProps {
  card: LabsCardData;
}

// Haversine formula to compute great-circle distance between two points in km
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
  return Math.round(R * c);
}

// Known coordinates for quick manual Indian city selection
const MAJOR_INDIAN_CITIES: Record<string, { lat: number; lng: number; label: string }> = {
  delhi: { lat: 28.6139, lng: 77.209, label: "Delhi / NCR" },
  mumbai: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
  pune: { lat: 18.5204, lng: 73.8567, label: "Pune" },
  nagpur: { lat: 21.1458, lng: 79.0882, label: "Nagpur" },
  wardha: { lat: 20.7453, lng: 78.6022, label: "Wardha" },
  bengaluru: { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
  chennai: { lat: 13.0827, lng: 80.2707, label: "Chennai" },
  hyderabad: { lat: 17.385, lng: 78.4867, label: "Hyderabad" },
  kolkata: { lat: 22.5726, lng: 88.3639, label: "Kolkata" },
  ahmedabad: { lat: 23.0225, lng: 72.5714, label: "Ahmedabad" },
  jaipur: { lat: 26.9124, lng: 75.7873, label: "Jaipur" },
  lucknow: { lat: 26.8467, lng: 80.9462, label: "Lucknow" },
};

export function LabsCard({ card }: LabsCardProps) {
  const { standard_id, labs, retrieved_note } = card;

  // Location & Sorting state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  // Manual city selector toggle & query
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [manualFilter, setManualFilter] = useState("");

  // Request browser geolocation
  const handleRequestLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationName("Your Current Location");
        setGeoStatus("granted");
      },
      (err) => {
        setGeoStatus("denied");
        let msg = "Location permission denied. You can select your city manually below.";
        if (err.code === err.TIMEOUT) msg = "Location request timed out. Please select your city manually.";
        setGeoError(msg);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // Choose preset city
  const handleSelectCity = (key: string) => {
    const city = MAJOR_INDIAN_CITIES[key];
    if (!city) return;
    setUserCoords({ lat: city.lat, lng: city.lng });
    setLocationName(city.label);
    setGeoStatus("granted");
    setShowManualPicker(false);
  };

  // Clear location sort
  const handleClearLocation = () => {
    setUserCoords(null);
    setLocationName(null);
    setGeoStatus("idle");
    setGeoError(null);
    setManualFilter("");
  };

  // Processed and sorted labs
  const processedLabs = useMemo(() => {
    let result = [...labs];

    // Optional manual text filtering
    if (manualFilter.trim()) {
      const q = manualFilter.toLowerCase().trim();
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.state && l.state.toLowerCase().includes(q))
      );
    }

    // Distance calculation & sorting if coords available
    if (userCoords) {
      result = result.map((lab) => {
        let distanceKm: number | undefined;
        if (typeof lab.lat === "number" && typeof lab.lng === "number") {
          distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lng, lab.lat, lab.lng);
        }
        return {
          ...lab,
          distanceKm,
        };
      });

      result.sort((a, b) => {
        const da = (a as any).distanceKm ?? 999999;
        const db = (b as any).distanceKm ?? 999999;
        return da - db;
      });
    }

    return result;
  }, [labs, userCoords, manualFilter]);

  // Map pins based on processed labs
  const mapPins = processedLabs
    .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
    .map((l) => ({
      id: l.id,
      name: l.name,
      city: l.city || "",
      state: l.state || "",
      lat: l.lat,
      lng: l.lng,
      detail_url: l.source_url,
      source: "BIS LIMS",
    }));

  return (
    <div className="w-full my-4 rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden text-[#0F172A]">
      {/* Header */}
      <div className="bg-[#0B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#E8710A] shrink-0" />
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              BIS-Recognised Testing Laboratories
            </h3>
            <p className="text-[11px] text-slate-300">
              Scope: {standard_id} • {labs.length} laboratories found
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-200">
          Official LIMS
        </span>
      </div>

      {/* Near Me & Location Filter Toolbar */}
      <div className="p-3 bg-slate-50 border-b border-[#E5E7EB] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestLocation}
              disabled={geoStatus === "requesting"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                geoStatus === "granted" && locationName === "Your Current Location"
                  ? "bg-emerald-600 text-white"
                  : "bg-[#0B2A4A] text-white hover:bg-[#081e36]"
              }`}
            >
              <Navigation className={`w-3.5 h-3.5 ${geoStatus === "requesting" ? "animate-spin" : ""}`} />
              <span>
                {geoStatus === "requesting"
                  ? "Locating…"
                  : geoStatus === "granted" && locationName === "Your Current Location"
                  ? "Using Current Location"
                  : "Find Labs Near Me"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualPicker(!showManualPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>Manual Location</span>
            </button>
          </div>

          {locationName && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sorted by nearest to: <strong>{locationName}</strong></span>
              <button
                type="button"
                onClick={handleClearLocation}
                className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Reset sorting"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Error notification if geolocation denied */}
        {geoError && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="flex-1">{geoError}</span>
          </div>
        )}

        {/* Manual City Selector Dropdown / Tray */}
        {showManualPicker && (
          <div className="p-3 bg-white rounded-lg border border-[#E5E7EB] shadow-xs space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Select your nearest city:</span>
              <button
                type="button"
                onClick={() => setShowManualPicker(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick city chips */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MAJOR_INDIAN_CITIES).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectCity(key)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                    locationName === item.label
                      ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Free text search by city/state */}
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
              <input
                type="text"
                value={manualFilter}
                onChange={(e) => setManualFilter(e.target.value)}
                placeholder="Or filter by city name (e.g. Pune, Delhi, Wardha, Chennai)…"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Map (if coordinates exist) */}
      {mapPins.length > 0 && (
        <div className="p-3 bg-slate-50 border-b border-[#E5E7EB]">
          <LabsMap labs={mapPins} />
        </div>
      )}

      {/* Lab List */}
      <div className="divide-y divide-[#E5E7EB] max-h-[380px] overflow-y-auto">
        {processedLabs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No laboratories found matching &ldquo;{manualFilter}&rdquo; in this scope.
          </div>
        ) : (
          processedLabs.map((lab: LabRecord & { distanceKm?: number }) => (
            <div key={lab.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-[#0B2A4A] truncate">
                      {lab.name}
                    </h4>

                    {typeof lab.distanceKm === "number" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Navigation className="w-2.5 h-2.5" />
                        {lab.distanceKm} km away
                      </span>
                    )}

                    {lab.current_status && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {lab.current_status}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#64748B]">
                    {(lab.city || lab.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {[lab.city, lab.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {lab.recognition_valid_upto && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Valid up to: {lab.recognition_valid_upto}
                      </span>
                    )}
                  </div>

                  {lab.scope && lab.scope[0]?.remark && lab.scope[0].remark !== "- -" && (
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      Note: {lab.scope[0].remark}
                    </p>
                  )}
                </div>

                {lab.source_url && (
                  <a
                    href={lab.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-[#0B2A4A] transition-colors rounded hover:bg-slate-100 flex-shrink-0"
                    title="View scope on BIS LIMS portal"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Citation */}
      {retrieved_note && (
        <div className="px-4 py-2 bg-slate-50 text-[11px] text-[#64748B] border-t border-[#E5E7EB] flex items-center justify-between">
          <span>{retrieved_note}</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
            <ShieldCheck className="w-3 h-3 text-[#228f4a]" /> Verified directory
          </span>
        </div>
      )}
    </div>
  );
}
