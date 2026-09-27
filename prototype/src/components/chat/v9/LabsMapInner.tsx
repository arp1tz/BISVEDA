"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LabPinItem {
  id: string;
  name: string;
  city: string;
  state: string;
  distance_km?: number;
  lat?: number;
  lng?: number;
  detail_url?: string;
  source?: string;
}

interface LabsMapInnerProps {
  labs: LabPinItem[];
  userLocation?: { lat: number; lng: number } | null;
}

// Custom DivIcon for testing lab pin
const createLabIcon = (isNearest: boolean = false) => {
  const color = isNearest ? "#E8710A" : "#0B2A4A";
  return L.divIcon({
    className: "custom-lab-pin",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:${color};border-radius:50%;color:white;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2v7.31"/>
          <path d="M14 9.3V1.99"/>
          <path d="M8.5 2h7"/>
          <path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>
          <path d="M5.52 16h12.96"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

const userIcon = L.divIcon({
  className: "custom-user-pin",
  html: `
    <div style="width:16px;height:16px;background:#228f4a;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(34,143,74,0.3);"></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapBoundsController({
  labs,
  userLocation,
}: {
  labs: LabPinItem[];
  userLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const validCoords: [number, number][] = labs
      .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
      .map((l) => [l.lat!, l.lng!]);

    if (userLocation) {
      validCoords.push([userLocation.lat, userLocation.lng]);
    }

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }
  }, [map, labs, userLocation]);

  return null;
}

export default function LabsMapInner({ labs, userLocation }: LabsMapInnerProps) {
  const validLabs = labs.filter(
    (l) => typeof l.lat === "number" && typeof l.lng === "number"
  );

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : validLabs.length > 0
    ? [validLabs[0].lat!, validLabs[0].lng!]
    : [22.5937, 78.9629]; // India center

  return (
    <div className="w-full h-[260px] rounded-xl overflow-hidden border border-[#E5E7EB] relative shadow-xs">
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="text-xs font-semibold text-[#228f4a]">Your Location</div>
            </Popup>
          </Marker>
        )}

        {validLabs.map((lab, idx) => (
          <Marker
            key={lab.id || idx}
            position={[lab.lat!, lab.lng!]}
            icon={createLabIcon(idx === 0)}
          >
            <Popup>
              <div className="text-xs space-y-1 max-w-[200px]">
                <div className="font-bold text-[#0B2A4A] leading-snug">{lab.name}</div>
                <div className="text-[#64748B] text-[11px]">
                  {lab.city}, {lab.state}
                </div>
                {lab.distance_km !== undefined && (
                  <div className="text-[11px] font-semibold text-[#E8710A]">
                    {lab.distance_km.toFixed(1)} km away
                  </div>
                )}
                {lab.detail_url && (
                  <a
                    href={lab.detail_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0B2A4A] underline block text-[10px] pt-1"
                  >
                    View Official LIMS Lab ↗
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <MapBoundsController labs={validLabs} userLocation={userLocation} />
      </MapContainer>
    </div>
  );
}
