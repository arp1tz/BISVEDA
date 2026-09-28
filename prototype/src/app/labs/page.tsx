"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FlaskConical,
  MapPin,
  Search,
  ExternalLink,
  Navigation,
  Compass,
  Calendar,
  ShieldCheck,
  Check,
  AlertCircle,
  X,
  MessageSquare,
} from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";
import { LabsMap } from "@/components/chat/v9/LabsMap";
import type { LabRecord } from "@/lib/kb/types";

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

function LabsDirectoryContent() {
  const searchParams = useSearchParams();
  const initialStandard = searchParams.get("standard") || "all";

  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedStandard, setSelectedStandard] = useState(initialStandard);
  const [selectedState, setSelectedState] = useState("all");

  // Geolocation & Distance state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showManualPicker, setShowManualPicker] = useState(false);

  useEffect(() => {
    async function fetchLabs() {
      try {
        setLoading(true);
        const res = await fetch("/api/labs");
        if (!res.ok) throw new Error("Failed to load laboratory directory.");
        const data = await res.json();
        setLabs(data.labs || []);
      } catch (err: any) {
        setError(err.message || "Failed to load laboratories.");
      } finally {
        setLoading(false);
      }
    }
    fetchLabs();
  }, []);

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
        let msg = "Location permission denied. Please choose your city manually below.";
        if (err.code === err.TIMEOUT) msg = "Location request timed out. Select city manually.";
        setGeoError(msg);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSelectPresetCity = (key: string) => {
    const city = MAJOR_INDIAN_CITIES[key];
    if (!city) return;
    setUserCoords({ lat: city.lat, lng: city.lng });
    setLocationName(city.label);
    setGeoStatus("granted");
    setShowManualPicker(false);
  };

  const handleClearLocation = () => {
    setUserCoords(null);
    setLocationName(null);
    setGeoStatus("idle");
    setGeoError(null);
  };

  // Distinct states list for dropdown
  const statesList = useMemo(() => {
    const set = new Set<string>();
    for (const l of labs) {
      if (l.state) set.add(l.state.trim());
    }
    return Array.from(set).sort();
  }, [labs]);

  // Filter and sort labs
  const processedLabs = useMemo(() => {
    let result = [...labs];

    // Standard filter
    if (selectedStandard !== "all") {
      const stdNorm = selectedStandard.toLowerCase().replace(/[^a-z0-9]/g, "");
      result = result.filter((l) =>
        l.standards_in_scope.some((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(stdNorm))
      );
    }

    // State filter
    if (selectedState !== "all") {
      result = result.filter((l) => (l.state || "").toLowerCase() === selectedState.toLowerCase());
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          (l.state && l.state.toLowerCase().includes(q)) ||
          l.standards_in_scope.some((s) => s.toLowerCase().includes(q))
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
  }, [labs, selectedStandard, selectedState, search, userCoords]);

  // Map pins based on filtered & sorted labs
  const mapPins = useMemo(() => {
    return processedLabs
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
  }, [processedLabs]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#0F172A] font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E8710A] uppercase tracking-wider">
            <FlaskConical className="w-4 h-4" />
            <span>Official Laboratory Information Management System (LIMS)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2A4A] tracking-tight">
            BIS-Recognised Testing Laboratories
          </h1>

          <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
            Search and locate official laboratories across India recognized by the Bureau of Indian Standards
            for testing helmets (IS 4151, IS 2925) and toys (IS 9873, IS 15644). Filter by testing scope, location,
            or sort by distance from your current location.
          </p>

          {/* Near Me & Location Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRequestLocation}
              disabled={geoStatus === "requesting"}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                geoStatus === "granted" && locationName === "Your Current Location"
                  ? "bg-emerald-600 text-white"
                  : "bg-[#0B2A4A] text-white hover:bg-[#081e36]"
              }`}
            >
              <Navigation className={`w-4 h-4 ${geoStatus === "requesting" ? "animate-spin" : ""}`} />
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Compass className="w-4 h-4 text-slate-500" />
              <span>Manual City Select</span>
            </button>

            {locationName && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sorted by distance from: <strong>{locationName}</strong></span>
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Reset distance sorting"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {geoError && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{geoError}</span>
            </div>
          )}

          {/* Manual City Selector Drawer */}
          {showManualPicker && (
            <div className="p-4 bg-slate-50 rounded-xl border border-[#E5E7EB] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Nearest City Center:
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualPicker(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(MAJOR_INDIAN_CITIES).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPresetCity(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      locationName === item.label
                        ? "bg-[#0B2A4A] text-white border-[#0B2A4A]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#64748B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lab name, city, or standard…"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F7F8FA] border border-[#CBD5E1] rounded-xl text-sm focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white transition-all placeholder-[#64748B]"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={selectedStandard}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F7F8FA] border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white"
              >
                <option value="all">All Standards in Scope</option>
                <option value="IS 4151">IS 4151 (Motorcycle Helmets)</option>
                <option value="IS 2925">IS 2925 (Industrial Helmets)</option>
                <option value="IS 9873 (Part 1)">IS 9873 Part 1 (Mechanical Toys)</option>
                <option value="IS 9873 (Part 3)">IS 9873 Part 3 (Toy Elements)</option>
                <option value="IS 15644">IS 15644 (Electric Toys)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F7F8FA] border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white"
              >
                <option value="all">All States &amp; UTs</option>
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Map View */}
        {mapPins.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E8710A]" />
                Geographic Distribution of Testing Facilities
              </span>
              <span className="text-xs text-slate-500">
                {mapPins.length} geocoded locations
              </span>
            </div>
            <LabsMap labs={mapPins} />
          </div>
        )}

        {/* Laboratories Results */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
            <span>
              Showing <strong>{processedLabs.length}</strong> recognized testing laboratories
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Official BIS LIMS Registry
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-[#64748B] bg-white rounded-2xl border border-[#E5E7EB]">
              Loading laboratory records from BIS LIMS…
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600 bg-red-50 rounded-2xl border border-red-200">
              {error}
            </div>
          ) : processedLabs.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#64748B] bg-white rounded-2xl border border-[#E5E7EB]">
              No laboratories found matching your criteria. Try resetting filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {processedLabs.map((lab: LabRecord & { distanceKm?: number }) => (
                <div
                  key={lab.id}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0B2A4A] leading-snug">
                        {lab.name}
                      </h3>

                      {typeof lab.distanceKm === "number" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
                          <Navigation className="w-2.5 h-2.5" />
                          {lab.distanceKm} km
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                      {(lab.city || lab.state) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {[lab.city, lab.state].filter(Boolean).join(", ")}
                        </span>
                      )}

                      {lab.recognition_valid_upto && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Valid: {lab.recognition_valid_upto}
                        </span>
                      )}
                    </div>

                    {/* Standards in scope tags */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-700 block">
                        Testing Scope:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {lab.standards_in_scope.map((std, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                          >
                            {std}
                          </span>
                        ))}
                      </div>
                    </div>

                    {lab.scope && lab.scope[0]?.remark && lab.scope[0].remark !== "- -" && (
                      <p className="text-[11px] text-slate-500 italic">
                        Scope note: {lab.scope[0].remark}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                    <Link
                      href={`/chat?q=Where can I test my product under ${encodeURIComponent(
                        lab.standards_in_scope[0] || "BIS standards"
                      )} near ${encodeURIComponent(lab.city || "me")}?`}
                      className="flex items-center gap-1 font-semibold text-[#0B2A4A] hover:underline"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#E8710A]" />
                      <span>Ask about this lab</span>
                    </Link>

                    {lab.source_url && (
                      <a
                        href={lab.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-slate-500 hover:text-[#0B2A4A]"
                        title="View scope on BIS LIMS portal"
                      >
                        <span>Official LIMS Record</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export default function LabsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#64748B]">Loading Labs Directory…</div>}>
      <LabsDirectoryContent />
    </Suspense>
  );
}
