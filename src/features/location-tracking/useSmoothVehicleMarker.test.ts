import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useSmoothVehicleMarker,
  interpolateShortestAngle,
} from './useSmoothVehicleMarker';
import type { LiveLocationUpdate } from './location.types';

describe('useSmoothVehicleMarker (60fps LERP & Dead Reckoning)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('interpolateShortestAngle', () => {
    it('interpolates angles in the same quadrant normally', () => {
      const angle = interpolateShortestAngle(10, 50, 0.5);
      expect(angle).toBe(30);
    });

    it('smoothly wraps across 360/0 degree boundary (350 deg to 10 deg)', () => {
      // Direct angular difference is +20 degrees across 0 deg North
      const angleAtHalf = interpolateShortestAngle(350, 10, 0.5);
      expect(angleAtHalf).toBe(0); // 350 -> 0 -> 10

      const angleAtQuarter = interpolateShortestAngle(350, 10, 0.25);
      expect(angleAtQuarter).toBe(355);
    });

    it('smoothly wraps in reverse (10 deg to 350 deg)', () => {
      const angleAtHalf = interpolateShortestAngle(10, 350, 0.5);
      expect(angleAtHalf).toBe(0);
    });
  });

  describe('useSmoothVehicleMarker hook', () => {
    const routeCoordinates: [number, number][] = [
      [18.7088, 73.6654],
      [18.7120, 73.6700],
    ];

    it('initializes with nulls when incomingLocation is null', () => {
      const { result } = renderHook(() =>
        useSmoothVehicleMarker(null, routeCoordinates, true)
      );

      expect(result.current.latitude).toBeNull();
      expect(result.current.longitude).toBeNull();
      expect(result.current.movementMode).toBe('IDLE');
    });

    it('snaps incoming location to route and sets mode to INTERPOLATING', () => {
      const update: LiveLocationUpdate = {
        ride_id: 'ride_1',
        latitude: 18.7090, // ~22m away from route
        longitude: 73.6656,
        accuracy: 10,
        heading: 45,
        speed: 40,
        timestamp: new Date().toISOString(),
      };

      const { result } = renderHook(() =>
        useSmoothVehicleMarker(update, routeCoordinates, true)
      );

      expect(result.current.latitude).not.toBeNull();
      expect(result.current.longitude).not.toBeNull();
      expect(result.current.isSnappedToRoad).toBe(true);
      expect(result.current.movementMode).toBe('INTERPOLATING');
    });
  });
});
