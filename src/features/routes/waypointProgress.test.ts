import { describe, it, expect } from 'vitest';
import {
  calculateWaypointProgress,
  findClosestPolylineIndex,
  type WaypointLike,
} from './waypointProgress';

describe('waypointProgress Utility', () => {
  const mockWaypoints: WaypointLike[] = [
    {
      id: 'wp-1',
      sequence: 1,
      latitude: 18.7325,
      longitude: 73.6766,
      label: 'Talegaon Station',
      type: 'ORIGIN',
    },
    {
      id: 'wp-2',
      sequence: 2,
      latitude: 18.7214,
      longitude: 73.6955,
      label: 'Somatne Phata',
      type: 'WAYPOINT',
    },
    {
      id: 'wp-3',
      sequence: 3,
      latitude: 18.7103,
      longitude: 73.7122,
      label: 'Dehu Road Bypass',
      type: 'WAYPOINT',
    },
    {
      id: 'wp-4',
      sequence: 4,
      latitude: 18.7001,
      longitude: 73.7311,
      label: 'ICEM Parandwadi',
      type: 'DESTINATION',
    },
  ];

  const mockPolyline: [number, number][] = [
    [18.7325, 73.6766], // 0: Origin
    [18.7270, 73.6860], // 1
    [18.7214, 73.6955], // 2: Waypoint 2
    [18.7150, 73.7040], // 3
    [18.7103, 73.7122], // 4: Waypoint 3
    [18.7050, 73.7210], // 5
    [18.7001, 73.7311], // 6: Destination
  ];

  it('returns empty progress when ride is not active and has no location', () => {
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: null,
      isRideActive: false,
      isRideCompleted: false,
    });

    expect(res.passedCount).toBe(0);
    expect(res.progressPercentage).toBe(0);
    expect(res.activeSequence).toBe(1);
    expect(res.passedSequences.size).toBe(0);
  });

  it('marks all waypoints as passed when trip is completed', () => {
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: null,
      isRideActive: false,
      isRideCompleted: true,
    });

    expect(res.passedCount).toBe(4);
    expect(res.progressPercentage).toBe(100);
    expect(res.activeSequence).toBeNull();
    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(true);
    expect(res.passedSequences.has(3)).toBe(true);
    expect(res.passedSequences.has(4)).toBe(true);
  });

  it('marks origin as passed once rider departs (>100m away during active ride)', () => {
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: { latitude: 18.7270, longitude: 73.6860 }, // ~1 km from origin
      isRideActive: true,
      isRideCompleted: false,
    });

    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(false);
    expect(res.activeSequence).toBe(2);
    expect(res.passedCount).toBe(1);
    expect(res.progressPercentage).toBe(25);
  });

  it('marks intermediate waypoint as passed when rider reaches proximity (<= 250m)', () => {
    // Rider is at Somatne Phata (wp-2)
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: { latitude: 18.7214, longitude: 73.6955 },
      isRideActive: true,
      isRideCompleted: false,
    });

    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(true); // wp-2 passed!
    expect(res.passedSequences.has(3)).toBe(false);
    expect(res.activeSequence).toBe(3);
    expect(res.passedCount).toBe(2);
    expect(res.progressPercentage).toBe(50);
  });

  it('marks intermediate waypoint as passed when polyline progression passes it', () => {
    // Rider is at polyline index 5 (between wp-3 and Destination)
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: { latitude: 18.7050, longitude: 73.7210 },
      isRideActive: true,
      isRideCompleted: false,
    });

    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(true);
    expect(res.passedSequences.has(3)).toBe(true); // wp-3 passed!
    expect(res.passedSequences.has(4)).toBe(false); // Destination not reached yet
    expect(res.activeSequence).toBe(4);
    expect(res.passedCount).toBe(3);
    expect(res.progressPercentage).toBe(75);
  });

  it('enforces monotonic sequence propagation: passing waypoint 3 automatically passes waypoints 1 and 2', () => {
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: { latitude: 18.7103, longitude: 73.7122 }, // at wp-3
      isRideActive: true,
      isRideCompleted: false,
    });

    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(true);
    expect(res.passedSequences.has(3)).toBe(true);
    expect(res.activeSequence).toBe(4);
  });

  it('preserves previously passed sequences to prevent GPS jitter flickering', () => {
    const previouslyPassed = new Set([1, 2]);

    // Current location has slight GPS glitch
    const res = calculateWaypointProgress({
      waypoints: mockWaypoints,
      coordinates: mockPolyline,
      currentLocation: { latitude: 18.7325, longitude: 73.6766 }, // glitch back at origin
      isRideActive: true,
      isRideCompleted: false,
      previouslyPassedSequences: previouslyPassed,
    });

    // Waypoints 1 and 2 MUST remain passed!
    expect(res.passedSequences.has(1)).toBe(true);
    expect(res.passedSequences.has(2)).toBe(true);
  });

  it('finds closest polyline index accurately', () => {
    const idx = findClosestPolylineIndex([18.7214, 73.6955], mockPolyline);
    expect(idx).toBe(2);
  });
});
