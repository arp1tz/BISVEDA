"use client";

import React, { useEffect, useRef } from "react";

export interface InspectorLab {
  id: string | number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  address?: string;
  scope?: string;
  oslCode?: string;
  distance_km?: number;
  status?: string;
}

interface InspectorLabLocationMapProps {
  labs: InspectorLab[];
  selectedLabId?: string | number;
  onSelectLab: (lab: InspectorLab) => void;
}

export function InspectorLabLocationMap({
  labs,
  selectedLabId,
  onSelectLab,
}: InspectorLabLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string | number, any>>(new Map());

  const selectedLab = labs.find((l) => l.id === selectedLabId) || labs[0];

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = (await import("leaflet")).default;

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersMapRef.current.clear();
      }

      const defaultCenter: [number, number] = [
        selectedLab?.lat || 20.5937,
        selectedLab?.lng || 78.9629,
      ];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: labs.length > 1 ? 6 : 9,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapInstanceRef.current = map;

      // OpenStreetMap tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      // Create pins for each lab
      labs.forEach((lab) => {
        if (!lab.lat || !lab.lng) return;
        const isSelected = lab.id === selectedLabId;

        const icon = L.divIcon({
          className: `inspector-lab-pin-${lab.id}`,
          html: `
            <div style="
              background-color: ${isSelected ? "#ff6b00" : "#0d2b45"};
              color: white;
              width: ${isSelected ? "32px" : "24px"};
              height: ${isSelected ? "32px" : "24px"};
              border-radius: 50%;
              border: 2.5px solid white;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? "14px" : "11px"};
              font-weight: bold;
              transition: transform 0.2s ease, background-color 0.2s ease;
              cursor: pointer;
            ">
              ⚗️
            </div>
          `,
          iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
          iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
        });

        const marker = L.marker([lab.lat, lab.lng], { icon }).addTo(map);

        // Bind interactive popup
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; color: #0d2b45; line-height: 1.4; padding: 2px;">
            <div style="font-weight: 800; font-size: 13px; color: #0d2b45; margin-bottom: 2px;">
              ${lab.name}
            </div>
            <div style="color: #4a5568; font-size: 11px; margin-bottom: 4px;">
              📍 ${lab.city}, ${lab.state}
            </div>
            <div style="display: inline-block; background-color: #e6fffa; color: #047857; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">
              ✓ NABL / BIS Recognized Active
            </div>
            ${lab.scope ? `<div style="font-size: 10px; color: #64748b; margin-top: 4px; max-height: 48px; overflow: hidden;"><strong>Scope:</strong> ${lab.scope}</div>` : ""}
            ${lab.distance_km ? `<div style="font-size: 10px; color: #ff6b00; font-weight: 700; margin-top: 4px;">Proximity: ~${lab.distance_km} km</div>` : ""}
          </div>
        `);

        marker.on("click", () => {
          onSelectLab(lab);
        });

        markersMapRef.current.set(lab.id, marker);
      });

      // Fit bounds if multiple labs exist
      if (labs.length > 1) {
        const bounds = L.latLngBounds(labs.map((l) => [l.lat, l.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, [labs]);

  // Handle selected lab changes to pan and open popup
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLab || !selectedLab.lat || !selectedLab.lng) return;

    mapInstanceRef.current.flyTo([selectedLab.lat, selectedLab.lng], 9, {
      duration: 0.8,
    });

    const marker = markersMapRef.current.get(selectedLab.id);
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 400);
    }
  }, [selectedLabId, selectedLab]);

  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden border border-navy/20 bg-slate-100 shadow-inner">
      <div
        ref={mapContainerRef}
        className="w-full h-full min-h-[300px] z-10"
        style={{ minHeight: "320px" }}
      />
      {/* Floating Map Info Overlay */}
      <div className="absolute top-2.5 right-2.5 z-20 rounded-lg bg-surface-raised/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-navy shadow-sm border border-border flex items-center gap-1.5 pointer-events-none">
        <span className="flex h-2 w-2 rounded-full bg-success animate-ping" />
        <span>OpenStreetMap Live Pins ({labs.length})</span>
      </div>
    </div>
  );
}
