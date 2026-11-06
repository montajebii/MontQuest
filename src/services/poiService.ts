import type { FeatureCollection } from 'geojson';

/**
 * Nearby points of interest (Could-have polish) — free Overpass API,
 * cafés/restaurants/fast-food + parks/gardens within `radiusM` of the
 * user. Returned as a GeoJSON FeatureCollection ready for a ShapeSource.
 * Each feature's `poi` property maps to a pixel icon (poiIcons.ts):
 * coffee / food / tree.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_POIS = 40;

interface OverpassElement {
  lat?: number;
  lon?: number;
  tags?: { amenity?: string; leisure?: string; name?: string };
}

export const fetchNearbyPois = async (
  lat: number,
  lon: number,
  radiusM = 1000,
): Promise<FeatureCollection> => {
  const query =
    '[out:json][timeout:15];' +
    `node["amenity"~"^(cafe|restaurant|fast_food)$"](around:${radiusM},${lat},${lon});` +
    `node["leisure"~"^(park|garden)$"](around:${radiusM},${lat},${lon});` +
    `out body ${MAX_POIS};`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(`overpass ${response.status}`);
  }
  const json = (await response.json()) as { elements?: OverpassElement[] };

  const features = (json.elements ?? [])
    .filter((el) => Number.isFinite(el.lat) && Number.isFinite(el.lon))
    .slice(0, MAX_POIS)
    .map((el) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [el.lon as number, el.lat as number],
      },
      properties: {
        poi:
          el.tags?.amenity === 'cafe'
            ? 'coffee'
            : el.tags?.leisure
              ? 'tree'
              : 'food',
        name: el.tags?.name ?? '',
      },
    }));

  return { type: 'FeatureCollection', features };
};
