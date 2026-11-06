import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Logic-level verification of the Overpass POI fetch + mapping.
const mockFetch = jest.fn<(url: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>>();
(global as { fetch: unknown }).fetch = mockFetch;

import { fetchNearbyPois } from '../src/services/poiService';

const overpassResponse = (elements: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ elements }),
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchNearbyPois', () => {
  it('queries Overpass with an around-filter and maps categories to icons', async () => {
    mockFetch.mockResolvedValue(
      overpassResponse([
        { lat: 35.7, lon: 51.4, tags: { amenity: 'cafe', name: 'کافه تست' } },
        { lat: 35.71, lon: 51.41, tags: { amenity: 'restaurant', name: 'رستوران' } },
        { lat: 35.72, lon: 51.42, tags: { leisure: 'park', name: 'پارک' } },
      ]),
    );

    const fc = await fetchNearbyPois(35.7, 51.4, 1000);

    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(3);
    expect(fc.features[0].properties).toMatchObject({ poi: 'coffee', name: 'کافه تست' });
    expect(fc.features[1].properties).toMatchObject({ poi: 'food' });
    expect(fc.features[2].properties).toMatchObject({ poi: 'tree' });
    // coordinates are [lon, lat] (MapLibre order)
    expect(fc.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [51.4, 35.7],
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = String((init as { body: string }).body);
    expect(body).toContain('around%3A1000%2C35.7%2C51.4');
    expect(body).toContain('cafe');
  });

  it('caps results at 40 and skips elements without coordinates', async () => {
    const elements = [
      ...Array.from({ length: 50 }, (_, i) => ({
        lat: 35 + i * 0.001,
        lon: 51 + i * 0.001,
        tags: { amenity: 'cafe' },
      })),
      { tags: { amenity: 'cafe' } }, // no lat/lon — must be skipped
    ];
    mockFetch.mockResolvedValue(overpassResponse(elements));

    const fc = await fetchNearbyPois(35, 51);
    expect(fc.features).toHaveLength(40);
  });

  it('throws on a non-200 Overpass response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    await expect(fetchNearbyPois(35, 51)).rejects.toThrow('overpass 502');
  });
});
