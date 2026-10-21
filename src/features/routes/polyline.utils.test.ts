import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateBearing,
  encodePolyline,
  decodePolyline,
  isPointAlongCorridor,
} from './polyline.utils';

describe('Polyline & Geodesic Math Utilities (Phase 4)', () => {
  // Coordinates from locations_seed.md
  const icemCampus = { latitude: 18.7095, longitude: 73.6644 };
  const somatnePhata = { latitude: 18.7182, longitude: 73.6894 };
  const bhosariStand = { latitude: 18.6277, longitude: 73.8465 };
  const hinjawadi = { latitude: 18.5913, longitude: 73.7389 };

  describe('calculateHaversineDistance', () => {
    it('calculates distance between ICEM and Somatne Phata accurately (~2.8 km)', () => {
      const dist = calculateHaversineDistance(
        icemCampus.latitude,
        icemCampus.longitude,
        somatnePhata.latitude,
        somatnePhata.longitude
      );
      // Distance is ~2830 meters
      expect(dist).toBeGreaterThan(2500);
      expect(dist).toBeLessThan(3200);
    });

    it('returns 0 for identical points', () => {
      const dist = calculateHaversineDistance(
        icemCampus.latitude,
        icemCampus.longitude,
        icemCampus.latitude,
        icemCampus.longitude
      );
      expect(dist).toBe(0);
    });
  });

  describe('calculateBearing', () => {
    it('calculates heading between 0 and 360 degrees', () => {
      const bearing = calculateBearing(
        icemCampus.latitude,
        icemCampus.longitude,
        somatnePhata.latitude,
        somatnePhata.longitude
      );
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
      // Somatne is North-East of ICEM
      expect(bearing).toBeGreaterThan(45);
      expect(bearing).toBeLessThan(90);
    });
  });

  describe('encodePolyline & decodePolyline', () => {
    it('performs lossless round-trip coordinate encoding and decoding', () => {
      const originalCoords: [number, number][] = [
        [18.7095, 73.6644],
        [18.7182, 73.6894],
        [18.7324, 73.6766],
        [18.6277, 73.8465],
      ];

      const encoded = encodePolyline(originalCoords);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(5);

      const decoded = decodePolyline(encoded);
      expect(decoded.length).toBe(originalCoords.length);

      for (let i = 0; i < originalCoords.length; i++) {
        expect(decoded[i][0]).toBeCloseTo(originalCoords[i][0], 4);
        expect(decoded[i][1]).toBeCloseTo(originalCoords[i][1], 4);
      }
    });
  });

  describe('isPointAlongCorridor', () => {
    it('identifies Somatne Phata along ICEM -> Bhosari corridor', () => {
      const result = isPointAlongCorridor(somatnePhata, icemCampus, bhosariStand);
      expect(result.inCorridor).toBe(true);
      expect(result.projectionT).toBeGreaterThan(0);
      expect(result.projectionT).toBeLessThan(1);
    });

    it('rejects points outside the lateral corridor buffer or backwards', () => {
      // Hinjawadi is south of the direct ICEM -> Talegaon Old Highway route
      const result = isPointAlongCorridor(
        hinjawadi,
        icemCampus,
        somatnePhata,
        1500 // strict 1.5 km buffer
      );
      expect(result.inCorridor).toBe(false);
    });
  });
});
