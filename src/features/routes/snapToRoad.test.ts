import { describe, it, expect } from 'vitest';
import { snapCoordinateToRoute } from './snapToRoad';
import { calculateHaversineDistance } from './polyline.utils';

describe('snapCoordinateToRoute (Highway & Corridor Snapping)', () => {
  // Simple highway segment from Akurdi Chowk to Nigdi Octroi (approx 1.5 km west-to-east)
  const highwayRoute: [number, number][] = [
    [18.6496, 73.7712], // Akurdi
    [18.6535, 73.7805], // Midpoint
    [18.6575, 73.7895], // Nigdi
  ];

  it('snaps coordinates within 45m directly onto the road segment', () => {
    // A point drifting 20 meters north into a roadside building/field
    const rawPoint = {
      latitude: 18.6515 + 0.00018, // ~20m north of segment
      longitude: 73.7758,
    };

    const result = snapCoordinateToRoute(rawPoint, highwayRoute, { maxSnapDistanceMeters: 45 });

    expect(result.isSnapped).toBe(true);
    expect(result.distanceToRoadMeters).toBeLessThanOrEqual(45);
    expect(result.roadBearing).not.toBeNull();
    expect(result.segmentIndex).toBe(0);

    // Snapped coordinate should be closer to the highway line than the raw point
    const rawDist = calculateHaversineDistance(rawPoint.latitude, rawPoint.longitude, 18.6515, 73.7758);
    const snappedDist = calculateHaversineDistance(result.latitude, result.longitude, 18.6515, 73.7758);
    expect(snappedDist).toBeLessThan(rawDist);
  });

  it('preserves authentic driver detours when coordinate is further than 45m from road', () => {
    // Driver pulls over at a dhaba or petrol pump 120m away from the highway
    const detourPoint = {
      latitude: 18.6515 + 0.0011, // ~120m north
      longitude: 73.7758,
    };

    const result = snapCoordinateToRoute(detourPoint, highwayRoute, { maxSnapDistanceMeters: 45 });

    expect(result.isSnapped).toBe(false);
    expect(result.latitude).toBe(detourPoint.latitude);
    expect(result.longitude).toBe(detourPoint.longitude);
    expect(result.distanceToRoadMeters).toBeGreaterThan(45);
  });

  it('handles empty or degenerate routes safely', () => {
    const pt = { latitude: 18.7088, longitude: 73.6654 };
    const emptyResult = snapCoordinateToRoute(pt, []);

    expect(emptyResult.isSnapped).toBe(false);
    expect(emptyResult.latitude).toBe(pt.latitude);
    expect(emptyResult.longitude).toBe(pt.longitude);
  });

  it('calculates correct road heading for orientation alignment', () => {
    const p1: [number, number] = [18.7000, 73.6000];
    const p2: [number, number] = [18.7000, 73.6100]; // Eastward heading (~90 deg)

    const raw = { latitude: 18.7001, longitude: 73.6050 };
    const res = snapCoordinateToRoute(raw, [p1, p2]);

    expect(res.isSnapped).toBe(true);
    expect(res.roadBearing).toBeGreaterThan(85);
    expect(res.roadBearing).toBeLessThan(95);
  });
});
