"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin,
  Search,
  Building,
  Phone,
  Mail,
  FlaskConical,
  ExternalLink,
  ShieldCheck,
  Navigation,
  Compass,
  LocateFixed,
  Map as MapIcon,
  ListFilter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getLabsNearPin, pinCentroids } from "@/lib/standards-helper";
import type { LabItem as MapLabItem } from "@/components/features/LaboratoryMap";

// Dynamic import for Leaflet map to prevent SSR window reference errors
const LaboratoryMap = dynamic(
  () => import("@/components/features/LaboratoryMap").then((mod) => mod.LaboratoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 sm:h-96 w-full rounded-2xl border border-border bg-surface-alt/50 animate-pulse flex flex-col items-center justify-center gap-3 text-ink-faint">
        <Compass className="h-8 w-8 animate-spin text-orange" />
        <span className="text-xs font-bold">Loading Interactive Laboratory Map...</span>
      </div>
    ),
  }
);

export default function TestingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pinCode, setPinCode] = useState("442001");
  const [selectedStandard, setSelectedStandard] = useState("ALL");
  const [selectedState, setSelectedState] = useState("ALL");
  const [facilityType, setFacilityType] = useState<"ALL" | "LAB" | "AHC">("ALL");
  const [validityFilter, setValidityFilter] = useState<"ALL" | "ACTIVE" | "RENEWAL">("ALL");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; city?: string } | null>(null);
  const [showMapPreview, setShowMapPreview] = useState(true);

  // Load saved location if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bisveda_user_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) {
          setUserCoords(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Compute geocoded lab results sorted by true Haversine distance
  const labs = useMemo(() => {
    return getLabsNearPin(
      pinCode,
      selectedStandard === "ALL" ? undefined : selectedStandard,
      userCoords
    );
  }, [pinCode, selectedStandard, userCoords]);

  const states = useMemo(() => {
    return Array.from(new Set(labs.map((l) => l.state).filter(Boolean))).sort();
  }, [labs]);

  const filteredLabs = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return labs.filter((lab) => {
      const matchesSearch =
        q === "" ||
        (lab.name || "").toLowerCase().includes(q) ||
        (lab.city || "").toLowerCase().includes(q) ||
        (lab.state || "").toLowerCase().includes(q) ||
        (lab.scope || "").toLowerCase().includes(q);

      const matchesState = selectedState === "ALL" || lab.state === selectedState;

      const isAhc =
        (lab.name || "").toLowerCase().includes("hallmark") ||
        (lab.name || "").toLowerCase().includes("ahc") ||
        (lab.scope || "").toLowerCase().includes("hallmark") ||
        (lab.scope || "").toLowerCase().includes("assaying");

      const matchesFacility =
        facilityType === "ALL" ||
        (facilityType === "AHC" && isAhc) ||
        (facilityType === "LAB" && !isAhc);

      const isValid =
        !((lab.accreditation || "").toLowerCase().includes("expired") ||
          (lab.scope || "").toLowerCase().includes("expired"));

      const matchesValidity =
        validityFilter === "ALL" ||
        (validityFilter === "ACTIVE" && isValid) ||
        (validityFilter === "RENEWAL" && !isValid);

      return matchesSearch && matchesState && matchesFacility && matchesValidity;
    });
  }, [labs, searchTerm, selectedState, facilityType, validityFilter]);

  // Transform for LaboratoryMap component - strictly geocoded only
  const mapLabs: MapLabItem[] = useMemo(() => {
    return filteredLabs
      .filter((l) => typeof l.lat === "number" && typeof l.lng === "number" && !isNaN(l.lat) && !isNaN(l.lng))
      .map((l, idx) => ({
        id: l.id || `lab-${idx}`,
        name: l.name,
        city: l.city,
        state: l.state,
        lat: l.lat,
        lng: l.lng,
        oslCode: l.accreditation || "BIS-REC",
        currentStatus: "Active",
        distance_km: l.distanceKm,
        standards: l.standards_tested,
      }));
  }, [filteredLabs]);

  const handleLocationDetected = (coords: { lat: number; lng: number; city?: string }) => {
    setUserCoords(coords);
    try {
      localStorage.setItem("bisveda_user_location", JSON.stringify(coords));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-faint mb-4">
          <Link href="/" className="hover:text-navy hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">Testing & Laboratory Locator</span>
        </div>

        {/* Header Hero */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-black uppercase text-success">
                  NABL & BIS Accredited Directory
                </span>
                <span className="text-xs font-semibold text-ink-faint">
                  430+ Verified Laboratories Across India
                </span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black text-navy tracking-tight">
                BIS Recognized Testing Laboratories & Proximity Locator
              </h1>
              <p className="mt-1 text-sm text-ink-soft max-w-2xl leading-relaxed">
                Find accredited conformity assessment labs for preliminary testing, sample validation, and factory audit witness tests with real Haversine distance calculation and interactive map preview.
              </p>
            </div>

            {/* Geocode PIN & GPS Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="rounded-xl border border-border bg-surface-alt/70 p-3 flex items-center gap-3">
                <Compass className="h-5 w-5 text-orange shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase text-ink-faint block">
                    Your Location (PIN / City)
                  </span>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => {
                      setPinCode(e.target.value);
                      setUserCoords(null); // Reset manual GPS when user enters new PIN
                    }}
                    placeholder="e.g. 442001 or Nagpur"
                    className="mt-0.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-mono font-bold text-navy focus:outline-none focus:border-navy w-32"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowMapPreview((prev) => !prev)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all shadow-2xs ${
                  showMapPreview
                    ? "border-navy bg-navy text-white"
                    : "border-border bg-surface-raised text-navy hover:bg-surface-alt"
                }`}
              >
                <MapIcon className="h-4 w-4" />
                <span>{showMapPreview ? "Hide Map" : "Show Map Preview"}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Search lab name, city, test scope..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-raised pl-9 pr-3 py-2 text-xs font-medium text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none"
              />
            </div>

            <div>
              <select
                value={selectedStandard}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none"
              >
                <option value="ALL">All Tested Standards</option>
                <option value="IS 2347">IS 2347 (Domestic Pressure Cookers)</option>
                <option value="IS 14543">IS 14543 (Packaged Drinking Water)</option>
                <option value="IS 17526">IS 17526 (Stainless Steel Bottles)</option>
                <option value="IS 9873">IS 9873 (Safety of Toys)</option>
                <option value="IS 269">IS 269 (Ordinary Portland Cement)</option>
                <option value="IS 1293">IS 1293 (Plugs & Socket-Outlets)</option>
                <option value="IS 4151">IS 4151 (Protective Helmets)</option>
                <option value="IS 1417">IS 1417 (Gold Hallmarking / AHC)</option>
                <option value="IS 1786">IS 1786 (High Strength TMT Steel)</option>
              </select>
            </div>

            <div>
              <select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none font-bold"
              >
                <option value="ALL">All Facility Types</option>
                <option value="LAB">Testing Laboratories (LRS)</option>
                <option value="AHC">AHC (Assaying &amp; Hallmarking)</option>
              </select>
            </div>

            <div>
              <select
                value={validityFilter}
                onChange={(e) => setValidityFilter(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none font-bold"
              >
                <option value="ALL">All Accreditations</option>
                <option value="ACTIVE">Active / Certified Only</option>
                <option value="RENEWAL">Renewal Pending</option>
              </select>
            </div>

            <div>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none"
              >
                <option value="ALL">All States / UTs</option>
                {states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Map Preview Section */}
        {showMapPreview && (
          <div className="mb-8 rounded-2xl border border-border bg-surface-raised p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange/15 text-orange font-bold text-xs">
                  🗺️
                </div>
                <div>
                  <h2 className="text-sm font-black text-navy uppercase tracking-wider">
                    Interactive Geospatial Laboratory Map
                  </h2>
                  <p className="text-[11px] text-ink-faint">
                    Pin locations verified with accurate state & city coordinates (e.g., Ghaziabad in UP, Mumbai in MH).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {userCoords ? (
                  <span className="flex items-center gap-1 rounded-full bg-blue/10 px-2.5 py-1 text-[11px] font-bold text-blue border border-blue/20">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Exact GPS Active
                  </span>
                ) : (
                  <span className="text-ink-faint text-[11px]">
                    Using Reference PIN: <strong className="text-navy">{pinCode}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Embedded Leaflet Map */}
            <LaboratoryMap
              labs={mapLabs}
              selectedStandard={selectedStandard === "ALL" ? undefined : selectedStandard}
              initialCity={pinCode}
              onUserLocationDetected={handleLocationDetected}
            />
          </div>
        )}

        {/* Results Counter & Sorting Label */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
          <span className="font-semibold text-navy">
            Showing {filteredLabs.length} accredited laboratories
          </span>
          <span className="bg-surface-alt px-2.5 py-1 rounded-lg border border-border font-medium">
            📍 Sorted by Haversine proximity to{" "}
            <strong className="text-navy">
              {userCoords ? "Your Current GPS Location" : pinCode || "India Central"}
            </strong>
          </span>
        </div>

        {/* Labs Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLabs.slice(0, 60).map((lab, index) => (
            <div
              key={index}
              className="flex flex-col justify-between rounded-xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-navy/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-blue shrink-0" />
                    <span className="text-xs font-bold text-navy leading-snug">
                      {lab.name}
                    </span>
                  </div>
                  {lab.distanceKm !== undefined && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                        lab.distanceKm <= 50
                          ? "bg-success/15 text-success border border-success/30"
                          : lab.distanceKm <= 300
                          ? "bg-blue/15 text-blue border border-blue/30"
                          : "bg-surface-alt text-ink-soft border border-border"
                      }`}
                    >
                      ~{lab.distanceKm} km
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-ink-soft">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-orange shrink-0 mt-0.5" />
                    <span>
                      {lab.address ? `${lab.address}, ` : ""}
                      <strong className="text-navy">{lab.city}</strong>, {lab.state}{" "}
                      {lab.pin_code && `(${lab.pin_code})`}
                    </span>
                  </div>

                  {lab.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-ink-faint shrink-0" />
                      <span>{lab.phone}</span>
                    </div>
                  )}

                  {lab.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-ink-faint shrink-0" />
                      <span className="truncate">{lab.email}</span>
                    </div>
                  )}
                </div>

                {lab.scope && (
                  <div className="mt-3 rounded-lg bg-surface-alt/70 p-2 text-[11px] text-ink-soft">
                    <span className="font-bold text-navy block text-[10px] uppercase">
                      Testing Scope:
                    </span>
                    <p className="mt-0.5 line-clamp-2">{lab.scope}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-[10px] text-ink-faint">
                  Accreditation: {lab.accreditation || "BIS Recognised"}
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${lab.name} ${lab.city}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-navy hover:underline flex items-center gap-1"
                >
                  <span>Map Directions</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
