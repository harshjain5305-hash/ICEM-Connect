import { describe, it, expect } from 'vitest';
import { InternalCorridorRouteProvider } from './route.provider';
import type { CoordinatePoint } from './route.types';

describe('Route Provider Architecture (Phase 4)', () => {
  const provider = new InternalCorridorRouteProvider();

  const icemCampus: CoordinatePoint = {
    latitude: 18.7095,
    longitude: 73.6644,
    label: 'ICEM Campus Parandwadi',
    location_id: 'loc_icem_campus',
  };

  const bhosariStand: CoordinatePoint = {
    latitude: 18.6277,
    longitude: 73.8465,
    label: 'Bhosari Bus Terminus',
    location_id: 'loc_bhosari_stand',
  };

  const somatnePhata: CoordinatePoint = {
    latitude: 18.7182,
    longitude: 73.6894,
    label: 'Somatne Phata',
    location_id: 'loc_somatne_phata',
  };

  it('calculates a valid normalized route between ICEM and Bhosari', async () => {
    const route = await provider.calculateRoute(icemCampus, bhosariStand, [somatnePhata]);

    expect(route).toBeDefined();
    expect(route.provider).toBeTruthy();
    expect(route.distance_meters).toBeGreaterThan(20000); // > 20 km
    expect(route.distance_meters).toBeLessThan(45000); // < 45 km
    expect(route.duration_seconds).toBeGreaterThan(1200); // > 20 mins
    expect(route.encoded_polyline).toBeTruthy();
    expect(route.geometry_json.type).toBe('LineString');
    expect(route.geometry_json.coordinates.length).toBeGreaterThan(2);

    // Waypoint sequencing verification
    expect(route.waypoints.length).toBe(3);
    expect(route.waypoints[0].type).toBe('ORIGIN');
    expect(route.waypoints[0].sequence).toBe(1);
    expect(route.waypoints[0].distance_from_start_meters).toBe(0);

    expect(route.waypoints[1].type).toBe('WAYPOINT');
    expect(route.waypoints[1].sequence).toBe(2);
    expect(route.waypoints[1].distance_from_start_meters).toBeGreaterThan(0);

    expect(route.waypoints[2].type).toBe('DESTINATION');
    expect(route.waypoints[2].sequence).toBe(3);
    expect(route.waypoints[2].distance_from_start_meters).toBe(route.distance_meters);
  });

  it('rejects identical origin and destination coordinates', async () => {
    await expect(
      provider.calculateRoute(icemCampus, icemCampus)
    ).rejects.toThrow('cannot be identical');
  });

  it('maintains strict ascending sequence order regardless of input intermediate order', async () => {
    const pimpriChowk: CoordinatePoint = {
      latitude: 18.6279,
      longitude: 73.7997,
      label: 'Pimpri Chowk',
    };

    // Pass in reverse geographic order: Pimpri first, then Somatne
    const route = await provider.calculateRoute(icemCampus, bhosariStand, [pimpriChowk, somatnePhata]);

    expect(route.waypoints.length).toBe(4);
    // Somatne is closer to ICEM than Pimpri, so Somatne must come first
    expect(route.waypoints[1].label).toBe('Somatne Phata');
    expect(route.waypoints[2].label).toBe('Pimpri Chowk');
    expect(route.waypoints[3].label).toBe('Bhosari Bus Terminus');
  });
});
