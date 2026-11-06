import { describe, it, expect } from '@jest/globals';
import { haversineMeters } from '../src/utils/geo';

describe('haversineMeters (proximity evaluation for AC-02/AC-03)', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(35.6892, 51.389, 35.6892, 51.389)).toBe(0);
  });

  it('measures one degree of latitude as ~111 km', () => {
    const d = haversineMeters(35, 51, 36, 51);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it('separates inside vs outside a 100 m geofence radius', () => {
    // ~0.0008° latitude ≈ 89 m → inside
    const inside = haversineMeters(35.6892, 51.389, 35.69, 51.389);
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThanOrEqual(100);

    // ~0.005° latitude ≈ 556 m → outside
    const outside = haversineMeters(35.6892, 51.389, 35.6942, 51.389);
    expect(outside).toBeGreaterThan(100);
  });
});
