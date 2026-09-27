"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

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

interface LabsMapProps {
  labs: LabPinItem[];
  userLocation?: { lat: number; lng: number } | null;
}

const DynamicLabsMap = dynamic(() => import("./LabsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[260px] rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] flex items-center justify-center text-xs text-[#64748B]">
      <Loader2 className="h-5 w-5 animate-spin text-[#0B2A4A] mr-2" />
      <span>Loading Interactive Lab Map...</span>
    </div>
  ),
});

export function LabsMap(props: LabsMapProps) {
  return <DynamicLabsMap {...props} />;
}
