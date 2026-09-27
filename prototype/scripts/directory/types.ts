/**
 * BISVEDA — Directory build types (scripts/directory/)
 *
 * On-disk shapes of data/directory/{labs,ahc}.json, produced by
 * scripts/directory/{labs,ahc}.ts and read by src/lib/kb/store.ts (P2.1).
 */

export interface LabScopeEntry {
  standard_id: string; // canonical, matches a KB standard's `id` when it's one of ours
  is_number_raw: string; // e.g. "IS 4151 (2015)" — as shown by BIS LIMS, may be a newer edition than our KB copy
  product: string;
  grade: string;
  charges?: string;
  validity_raw?: string;
  remark?: string;
}

export interface LabRecord {
  id: string; // OSL code
  name: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  geocode: "city-centroid" | "none";
  current_status?: string;
  recognition_valid_upto?: string;
  standards_in_scope: string[]; // canonical standard_id values, deduped
  scope: LabScopeEntry[];
  source_url: string;
  retrieved_at: string;
}

export interface AhcRecord {
  recognition_no: string;
  name: string;
  address?: string;
  district?: string;
  state?: string;
  pin?: string;
  metals?: string;
  contact?: string;
  status: string;
  validity?: string;
  lat: number | null;
  lng: number | null;
  geocode: "district" | "none";
  source_url: string;
  retrieved_at: string;
}
