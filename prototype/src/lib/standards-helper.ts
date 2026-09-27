import rawStandards from "../../data/standards.json";
import rawLabs from "../../data/laboratories.json";
import rawQcos from "../../data/qcos.json";
import rawCentroids from "../../data/pin_centroids.json";

export interface StandardItem {
  standard_id: string;
  standard_number: string;
  part: string | null;
  section: string | null;
  year: string;
  full_title: string;
  short_title: string;
  product_category: string;
  industry: string;
  scheme: string;
  certification_route: string;
  mandatory_qco: boolean;
  status: string;
  publication_date?: string;
  revision_date?: string;
  supersedes?: string | null;
  superseded_by?: string | null;
  amendments?: string[];
  scope: string;
  key_testing_parameters?: string[];
  materials?: string[];
  keywords?: string[];
  document_url?: string;
  source_url?: string;
  legal_source?: {
    gazette_order?: string;
    notification_number?: string;
    issuing_ministry?: string;
    enactment_date?: string;
    portal_url?: string;
  };
}

export interface LabItem {
  id?: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  pin_code?: string;
  phone?: string;
  email?: string;
  scope?: string;
  standards_tested?: string[];
  accreditation?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

export const allStandards: StandardItem[] = rawStandards as unknown as StandardItem[];
export const allLabs: LabItem[] = rawLabs as unknown as LabItem[];
export const allQcos: any[] = rawQcos as unknown as any[];
export const pinCentroids: Record<string, { lat: number; lng: number; city: string; state: string }> =
  rawCentroids as any;

const PIN_PREFIX_COORDINATES: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  "11": { city: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.2090 },
  "12": { city: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266 },
  "13": { city: "Karnal", state: "Haryana", lat: 29.6857, lng: 76.9905 },
  "14": { city: "Ludhiana", state: "Punjab", lat: 30.9010, lng: 75.8573 },
  "16": { city: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  "20": { city: "Noida / Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lng: 77.4538 },
  "22": { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  "24": { city: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
  "25": { city: "Meerut", state: "Uttar Pradesh", lat: 28.9845, lng: 77.7064 },
  "28": { city: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081 },
  "30": { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  "34": { city: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243 },
  "36": { city: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022 },
  "38": { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  "39": { city: "Surat / Vadodara", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  "40": { city: "Mumbai", state: "Maharashtra", lat: 18.9388, lng: 72.8354 },
  "41": { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  "42": { city: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898 },
  "43": { city: "Aurangabad", state: "Maharashtra", lat: 19.8762, lng: 75.3433 },
  "44": { city: "Nagpur / Wardha", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  "45": { city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  "46": { city: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
  "47": { city: "Gwalior", state: "Madhya Pradesh", lat: 26.2183, lng: 78.1828 },
  "48": { city: "Jabalpur", state: "Madhya Pradesh", lat: 23.1815, lng: 79.9864 },
  "49": { city: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
  "50": { city: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
  "52": { city: "Vijayawada", state: "Andhra Pradesh", lat: 16.5062, lng: 80.6480 },
  "53": { city: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 },
  "56": { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  "57": { city: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  "58": { city: "Hubballi", state: "Karnataka", lat: 15.3647, lng: 75.1240 },
  "60": { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  "62": { city: "Madurai", state: "Tamil Nadu", lat: 9.9252, lng: 78.1198 },
  "64": { city: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  "68": { city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  "69": { city: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lng: 76.9366 },
  "70": { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  "75": { city: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
  "78": { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
  "80": { city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  "83": { city: "Ranchi / Jamshedpur", state: "Jharkhand", lat: 23.3441, lng: 85.3096 },
};

const CITY_COORDINATES_MAP: Record<string, [number, number]> = {
  ghaziabad: [28.6692, 77.4538],
  sahibabad: [28.6722, 77.3628],
  noida: [28.5355, 77.3910],
  delhi: [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  mumbai: [19.1136, 72.8697],
  andheri: [19.1136, 72.8697],
  pune: [18.5204, 73.8567],
  nagpur: [21.1498, 79.0820],
  wardha: [20.7453, 78.6022],
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
  sonipat: [28.9931, 77.0151],
  sonepat: [28.9931, 77.0151],
  kundli: [28.8711, 77.1264],
  mohali: [30.7046, 76.7179],
  nasik: [19.9975, 73.7898],
  nashik: [19.9975, 73.7898],
  vijayawada: [16.5062, 80.6480],
  visakhapatnam: [17.6868, 83.2185],
};

/**
 * Locate labs sorted by proximity to given PIN code or city
 */
export function getLabsNearPin(
  pinOrCity: string = "",
  standardNum?: string,
  userCoords?: { lat: number; lng: number } | null
): Array<LabItem & { distanceKm?: number }> {
  const input = (pinOrCity || "").trim().toLowerCase();
  let originLat: number | null = userCoords?.lat ?? null;
  let originLng: number | null = userCoords?.lng ?? null;

  // 1. Exact PIN match in pinCentroids (if not already provided by GPS)
  if (!originLat && input && pinCentroids[input]) {
    originLat = pinCentroids[input].lat;
    originLng = pinCentroids[input].lng;
  } else if (input && /^\d{2}/.test(input)) {
    // 2. Regional 2-digit PIN prefix match
    const prefix = input.slice(0, 2);
    if (PIN_PREFIX_COORDINATES[prefix]) {
      originLat = PIN_PREFIX_COORDINATES[prefix].lat;
      originLng = PIN_PREFIX_COORDINATES[prefix].lng;
    }
  }

  // 3. Try matching city name directly
  if (!originLat && input) {
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES_MAP)) {
      if (input.includes(cityName) || cityName.includes(input)) {
        originLat = coords[0];
        originLng = coords[1];
        break;
      }
    }
  }

  // Fallback defaults for major Indian cities if not found in centroids
  if (!originLat && input) {
    if (input.startsWith("11") || input.includes("delhi")) { originLat = 28.6139; originLng = 77.2090; }
    else if (input.startsWith("40") || input.includes("mumbai")) { originLat = 19.0760; originLng = 72.8777; }
    else if (input.startsWith("56") || input.includes("bangalore")) { originLat = 12.9716; originLng = 77.5946; }
    else if (input.startsWith("60") || input.includes("chennai")) { originLat = 13.0827; originLng = 80.2707; }
    else if (input.startsWith("70") || input.includes("kolkata")) { originLat = 22.5726; originLng = 88.3639; }
    else if (input.startsWith("44") || input.includes("nagpur")) { originLat = 21.1458; originLng = 79.0882; }
    else if (input.startsWith("38") || input.includes("ahmedabad")) { originLat = 23.0225; originLng = 72.5714; }
  }

  let results = allLabs.map((lab) => {
    // Read real geocoded coordinates from laboratories.json
    let labLat = (lab as any).lat ?? lab.latitude;
    let labLng = (lab as any).lng ?? lab.longitude;

    if (!labLat || !labLng) {
      const city = (lab.city || "").toLowerCase().trim();
      for (const [cityName, coords] of Object.entries(CITY_COORDINATES_MAP)) {
        if (city.includes(cityName)) {
          labLat = coords[0];
          labLng = coords[1];
          break;
        }
      }
    }

    if (!labLat || !labLng) {
      labLat = 28.6139;
      labLng = 77.2090; // Default to Delhi if completely unresolvable
    }

    const distance = originLat && originLng ? haversineDistance(originLat, originLng, labLat, labLng) : undefined;
    return {
      ...lab,
      lat: labLat,
      lng: labLng,
      distanceKm: distance,
    };
  });

  if (standardNum) {
    const sLower = standardNum.toLowerCase();
    results = results.filter((l) =>
      (l.standards_tested || []).some((st) => (st || "").toLowerCase().includes(sLower)) ||
      (l.scope || "").toLowerCase().includes(sLower)
    );
  }

  if (originLat && originLng) {
    results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }

  return results;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return Math.round(R * c * 10) / 10;
}

export function standardToSlug(standardNumber: string): string {
  return (standardNumber || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/:/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function getStandardBySlug(slug: string): StandardItem | undefined {
  const normalized = (slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return allStandards.find((s) => {
    const sNorm = (s.standard_number || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return sNorm === normalized || standardToSlug(s.standard_number) === slug;
  });
}
