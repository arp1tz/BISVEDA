"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  MapPin,
  Building,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  ExternalLink,
  Search,
  LocateFixed,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import labsData from "../../../data/laboratories.json";

export interface LabItem {
  id: string | number;
  name: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  oslCode?: string;
  currentStatus?: string;
  recognitionValidUpto?: string;
  standards?: string[];
  distance_km?: number;
}

interface LaboratoryMapProps {
  labs?: LabItem[];
  selectedStandard?: string;
  initialCity?: string;
  onSelectLab?: (lab: LabItem) => void;
  onUserLocationDetected?: (coords: { lat: number; lng: number; city?: string }) => void;
}

export const KNOWN_CITY_COORDINATES: Record<string, [number, number]> = {
  ghaziabad: [28.6692, 77.4538],
  sahibabad: [28.6722, 77.3628],
  noida: [28.5355, 77.3910],
  delhi: [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  mumbai: [19.1136, 72.8697],
  andheri: [19.1136, 72.8697],
  pune: [18.5204, 73.8567],
  nagpur: [21.1498, 79.0820],
  kolkata: [22.5726, 88.3639],
  chennai: [13.0827, 80.2707],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  hyderabad: [17.3850, 78.4867],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  lucknow: [26.8467, 80.9462],
  manesar: [28.3541, 76.9388],
  gurugram: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  faridabad: [28.4089, 77.3178],
  kanpur: [26.4499, 80.3319],
  patna: [25.5941, 85.1376],
  vadodara: [22.3072, 73.1812],
  surat: [21.1702, 72.8311],
  coimbatore: [11.0168, 76.9558],
  indore: [22.7196, 75.8577],
  bhopal: [23.2599, 77.4126],
  bhubaneswar: [20.2961, 85.8245],
  chandigarh: [30.7333, 76.7794],
  dehradun: [30.3165, 78.0322],
  guwahati: [26.1445, 91.7362],
  kochi: [9.9312, 76.2673],
  mysore: [12.2958, 76.6394],
  visakhapatnam: [17.6868, 83.2185],
  nashik: [19.9975, 73.7898],
};

export function resolveLabCoordinates(lab: { city?: string; state?: string; lat?: number; lng?: number }): [number, number] {
  const cityLower = (lab.city || "").toLowerCase().trim();

  // Explicit priority for Ghaziabad & Sahibabad (must never be misplaced in Delhi)
  if (cityLower.includes("ghaziabad") || cityLower.includes("sahibabad")) {
    return KNOWN_CITY_COORDINATES.ghaziabad;
  }
  if (cityLower.includes("mumbai") || cityLower.includes("andheri")) {
    return KNOWN_CITY_COORDINATES.mumbai;
  }

  if (lab.lat && lab.lng) {
    return [lab.lat, lab.lng];
  }

  for (const [cityName, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
    if (cityLower.includes(cityName)) {
      return coords;
    }
  }

  return [28.6139, 77.2090];
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function LaboratoryMap({
  labs: customLabs,
  selectedStandard,
  initialCity,
  onSelectLab,
  onUserLocationDetected,
}: LaboratoryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [filterQuery, setFilterQuery] = useState("");

  // Load saved location from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bisveda_user_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng) {
          setUserCoords(parsed);
          setLocationStatus("granted");
          onUserLocationDetected?.(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleRequestLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocationStatus("granted");
        try {
          localStorage.setItem("bisveda_user_location", JSON.stringify(coords));
        } catch {}
        onUserLocationDetected?.(coords);
      },
      (err) => {
        console.warn("Geolocation permission error:", err);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Base geocoded labs with resolved accurate coordinates
  const rawLabs: LabItem[] = useMemo(() => {
    const list = customLabs && customLabs.length > 0 ? customLabs : (labsData as any[]);
    return list.map((l, idx) => {
      const [lat, lng] = resolveLabCoordinates(l);
      return {
        id: l.id || l.oslCode || `lab-${idx}`,
        name: l.name,
        city: l.city || "India",
        state: l.state || "",
        lat,
        lng,
        oslCode: l.accreditation_number || l.oslCode || "BIS-REC",
        currentStatus: l.currentStatus || "Active",
        recognitionValidUpto: l.recognitionValidUpto,
        standards: l.recognized_standards || ["IS 2347", "IS 14543", "IS 4151", "IS 17526"],
        distance_km: l.distance_km,
      };
    });
  }, [customLabs]);

  // Dynamically compute proximity if user location is known, then sort
  const sortedLabs = useMemo(() => {
    let result = rawLabs.map((lab) => {
      if (userCoords && lab.lat && lab.lng) {
        const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, lab.lat, lab.lng);
        return { ...lab, distance_km: dist };
      }
      return lab;
    });

    if (userCoords) {
      result.sort((a, b) => (a.distance_km || 9999) - (b.distance_km || 9999));
    }

    return result;
  }, [rawLabs, userCoords]);

  const [activeLabId, setActiveLabId] = useState<string | number>(sortedLabs[0]?.id || "");

  useEffect(() => {
    if (sortedLabs.length > 0 && (!activeLabId || !sortedLabs.some((l) => l.id === activeLabId))) {
      setActiveLabId(sortedLabs[0].id);
    }
  }, [sortedLabs, activeLabId]);

  const filteredLabs = useMemo(() => {
    if (!filterQuery) return sortedLabs;
    const q = filterQuery.toLowerCase().trim();
    return sortedLabs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.state.toLowerCase().includes(q)
    );
  }, [sortedLabs, filterQuery]);

  const selectedLab = filteredLabs.find((l) => l.id === activeLabId) || filteredLabs[0];

  // Leaflet Map Initialization & Marker Updates
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
        userMarkerRef.current = null;
      }

      const defaultCenter: [number, number] = userCoords
        ? [userCoords.lat, userCoords.lng]
        : selectedLab && selectedLab.lat && selectedLab.lng
        ? [selectedLab.lat, selectedLab.lng]
        : [21.1498, 79.0820]; // Center of India

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: userCoords ? 9 : 6,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      // 1. User Location Marker (Pulsing Blue Pin)
      if (userCoords) {
        const userIcon = L.divIcon({
          className: "user-loc-marker",
          html: `
            <div style="
              background-color: #2563eb;
              color: white;
              width: 34px;
              height: 34px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 16px rgba(37,99,235,0.7);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 15px;
            ">
              📍
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const uMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon }).addTo(map);
        uMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 2px;">
            <strong style="color: #2563eb; font-size: 13px;">📍 Your Current Location</strong><br/>
            <span style="color: #64748b;">Conformity assessment proximity origin</span>
          </div>
        `);
        userMarkerRef.current = uMarker;
      }

      // 2. Laboratory Markers
      const createLabIcon = (isSelected: boolean) =>
        L.divIcon({
          className: "custom-lab-marker",
          html: `
            <div style="
              background-color: ${isSelected ? "#ff6b00" : "#0d2b45"};
              color: white;
              width: ${isSelected ? "34px" : "26px"};
              height: ${isSelected ? "34px" : "26px"};
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? "14px" : "11px"};
              font-weight: bold;
              transition: all 0.2s ease;
              cursor: pointer;
            ">
              ⚗️
            </div>
          `,
          iconSize: [isSelected ? 34 : 26, isSelected ? 34 : 26],
          iconAnchor: [isSelected ? 17 : 13, isSelected ? 17 : 13],
        });

      const displayLabs = filteredLabs.slice(0, 30);
      const pointsToFit: [number, number][] = [];

      if (userCoords) {
        pointsToFit.push([userCoords.lat, userCoords.lng]);
      }

      displayLabs.forEach((lab) => {
        if (!lab.lat || !lab.lng) return;
        pointsToFit.push([lab.lat, lab.lng]);
        const isSelected = lab.id === activeLabId;
        const marker = L.marker([lab.lat, lab.lng], {
          icon: createLabIcon(isSelected),
        }).addTo(map);

        marker.on("click", () => {
          setActiveLabId(lab.id);
          if (onSelectLab) onSelectLab(lab);
          map.setView([lab.lat!, lab.lng!], 11, { animate: true });
        });

        const distStr = lab.distance_km ? `<br/><span style="color: #ea580c; font-weight: bold;">📍 ~${lab.distance_km} km away</span>` : "";
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 2px;">
            <strong style="color: #0d2b45; font-size: 13px;">${lab.name}</strong><br/>
            <span style="color: #64748b;">${lab.city}, ${lab.state}</span>${distStr}<br/>
            <span style="color: #10b981; font-weight: bold;">● ${lab.currentStatus || "Recognized"}</span>
          </div>
        `);

        markersRef.current.push({ id: lab.id, marker });
      });

      // Fit bounds to show both user pin and closest laboratories if available
      if (pointsToFit.length > 1) {
        map.fitBounds(pointsToFit, { padding: [35, 35], maxZoom: 12 });
      } else if (initialCity) {
        const cityMatch = displayLabs.find((l) => l.city.toLowerCase() === initialCity.toLowerCase());
        if (cityMatch && cityMatch.lat && cityMatch.lng) {
          map.setView([cityMatch.lat, cityMatch.lng], 9);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [filteredLabs, userCoords]);

  const handleSelectLab = (lab: LabItem) => {
    setActiveLabId(lab.id);
    if (onSelectLab) onSelectLab(lab);
    if (mapInstanceRef.current && lab.lat && lab.lng) {
      mapInstanceRef.current.setView([lab.lat, lab.lng], 11, { animate: true });
    }
  };

  return (
    <div className="space-y-4">
      {/* Location Permission & Proximity Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-navy/15 bg-gradient-to-r from-surface-raised via-surface-alt to-surface-raised shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${userCoords ? "bg-blue text-white" : "bg-orange/15 text-orange"}`}>
            <LocateFixed className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-black text-navy flex items-center gap-2">
              <span>{userCoords ? "📍 Location Verified — Sorted by Real Proximity" : "Find Closest Laboratories to You"}</span>
              {userCoords && (
                <span className="text-[10px] bg-success/15 text-success font-bold px-2 py-0.5 rounded-full border border-success/30">
                  Accurate GPS
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-soft">
              {userCoords
                ? `Laboratories sorted by direct Haversine distance from your location (${filteredLabs[0]?.distance_km ? `closest is ${filteredLabs[0].distance_km} km` : "verified"}).`
                : "Grant location permission to rank accredited testing laboratories by proximity from your facility."}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {userCoords ? (
            <button
              onClick={handleRequestLocation}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-2xs"
            >
              <RefreshCw className="h-3 w-3 text-ink-faint" />
              <span>Update Location</span>
            </button>
          ) : (
            <button
              onClick={handleRequestLocation}
              disabled={locationStatus === "requesting"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-1.5 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5 text-orange" />
              <span>{locationStatus === "requesting" ? "Detecting GPS..." : "Enable Location"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Section Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-success text-white text-xs font-black">
              ⚗️
            </span>
            <h3 className="text-sm font-black uppercase tracking-wider text-navy">
              Laboratories Near You (BIS &amp; NABL Accredited)
            </h3>
          </div>
          <p className="text-xs text-ink-faint mt-0.5">
            Geographic directory of accredited conformity assessment testing laboratories.
          </p>
        </div>

        {/* Filter input */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search by city (e.g. Ghaziabad, Nagpur, Mumbai)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-raised pl-8 pr-3 py-1.5 text-xs text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Main Map + Card Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Leaflet Map Container */}
        <div className="lg:col-span-7 h-72 sm:h-96 rounded-2xl border border-border overflow-hidden shadow-xs relative">
          <div ref={mapContainerRef} className="h-full w-full z-0" />
          <div className="absolute bottom-2 left-2 z-10 bg-surface-raised/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-border text-[10px] font-bold text-navy shadow-2xs flex items-center gap-2">
            <span>Showing {filteredLabs.length} Accredited Facilities</span>
            {userCoords && <span className="text-blue font-extrabold">• Blue pin = You</span>}
          </div>
        </div>

        {/* Synchronized Laboratory Cards Rail */}
        <div className="lg:col-span-5 flex flex-col space-y-2.5 h-72 sm:h-96 overflow-y-auto pr-1">
          {filteredLabs.slice(0, 10).map((lab) => {
            const isSelected = lab.id === activeLabId;
            return (
              <div
                key={lab.id}
                onClick={() => handleSelectLab(lab)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                  isSelected
                    ? "border-orange bg-orange/5 ring-1 ring-orange/30 shadow-xs"
                    : "border-border bg-surface-raised hover:border-navy/40 hover:bg-surface-alt/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold text-navy leading-snug line-clamp-1">
                    {lab.name}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase shrink-0 ${
                      lab.currentStatus === "Active"
                        ? "bg-success/15 text-success border border-success/30"
                        : "bg-surface-alt text-ink-faint border border-border"
                    }`}
                  >
                    {lab.currentStatus || "Recognized"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-ink-soft text-[11px]">
                  <MapPin className="h-3 w-3 text-orange shrink-0" />
                  <span className="truncate">
                    {lab.city}, {lab.state}
                  </span>
                  {lab.distance_km !== undefined && (
                    <span className="font-mono font-bold text-orange ml-auto text-[10px] bg-orange/10 px-2 py-0.5 rounded-md">
                      📍 ~{lab.distance_km} km away
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                  <span className="font-mono text-ink-faint">
                    OSL: {lab.oslCode || "Govt-BIS"}
                  </span>
                  <span className="font-bold text-blue hover:underline">
                    View Scope &amp; Schedule →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
