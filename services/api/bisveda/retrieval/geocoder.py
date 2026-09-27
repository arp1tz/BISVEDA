import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from bisveda.config.settings import get_settings


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Computes Great Circle distance between two coordinates in kilometers.
    """
    r = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 1)


class LocalPINCentroidGeocoder:
    """
    V8 Canonical Spec D42: PIN-Centroid Geocoding Source.
    Resolves Indian postal codes and cities to coordinates without external Google Maps API dependencies.
    """

    def __init__(self, centroids_path: Optional[Path] = None):
        settings = get_settings()
        self.centroids_path = centroids_path or (settings.data_dir / "seed" / "pin_centroids.json")
        self._centroids: Dict[str, Dict[str, Any]] = {}
        self._city_to_coords: Dict[str, Tuple[float, float]] = {}
        self._load()

    def _load(self):
        if self.centroids_path and self.centroids_path.exists():
            with open(self.centroids_path, "r", encoding="utf-8") as f:
                self._centroids = json.load(f)
            for pin, data in self._centroids.items():
                city = data.get("city", "").lower()
                if city:
                    self._city_to_coords[city] = (data["lat"], data["lng"])

    def geocode(self, pin_or_city: str) -> Optional[Tuple[float, float]]:
        cleaned = pin_or_city.strip().lower()
        if cleaned in self._centroids:
            entry = self._centroids[cleaned]
            return entry["lat"], entry["lng"]
        if cleaned in self._city_to_coords:
            return self._city_to_coords[cleaned]
        # Partial match on city
        for city, coords in self._city_to_coords.items():
            if cleaned in city or city in cleaned:
                return coords
        return None

    def sort_labs_by_distance(
        self,
        labs: List[Dict[str, Any]],
        origin_pin_or_city: str,
        max_distance_km: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        coords = self.geocode(origin_pin_or_city)
        if not coords:
            return labs

        origin_lat, origin_lng = coords
        scored_labs = []
        for lab in labs:
            lab_lat = lab.get("lat")
            lab_lng = lab.get("lng")
            if lab_lat is not None and lab_lng is not None:
                dist = haversine_km(origin_lat, origin_lng, lab_lat, lab_lng)
                if max_distance_km is None or dist <= max_distance_km:
                    lab_copy = dict(lab)
                    lab_copy["distance_km"] = dist
                    scored_labs.append(lab_copy)
            else:
                lab_copy = dict(lab)
                lab_copy["distance_km"] = None
                scored_labs.append(lab_copy)

        scored_labs.sort(
            key=lambda x: (
                x.get("distance_km") is None,
                x.get("distance_km") if x.get("distance_km") is not None else 999999.0,
            )
        )
        return scored_labs
