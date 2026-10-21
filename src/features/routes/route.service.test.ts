import { describe, it, expect, beforeEach } from 'vitest';
import { routeService } from './route.service';

describe('Route Service & Waypoint Sequencing (Phase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCandidateWaypointsForCorridor', () => {
    it('discovers authentic intermediate transit nodes along ICEM -> Bhosari corridor', async () => {
      const candidates = await routeService.getCandidateWaypointsForCorridor(
        'loc_icem_campus',
        'loc_bhosari_stand'
      );

      expect(candidates.length).toBeGreaterThan(0);

      // Verify that discovered locations include major PCMC nodes along the highway
      const names = candidates.map((c) => c.name);
      expect(names.some((n) => n.includes('Somatne') || n.includes('Dehu') || n.includes('Akurdi') || n.includes('Pimpri'))).toBe(true);
    });

    it('returns empty array when locations are identical', async () => {
      const candidates = await routeService.getCandidateWaypointsForCorridor(
        'loc_icem_campus',
        'loc_icem_campus'
      );
      expect(candidates.length).toBe(0);
    });
  });

  describe('calculateRouteForLocations', () => {
    it('calculates full corridor route and sequenced waypoints', async () => {
      const route = await routeService.calculateRouteForLocations(
        'loc_icem_campus',
        'loc_bhosari_stand'
      );

      expect(route).toBeDefined();
      expect(route.distance_meters).toBeGreaterThan(20000);
      expect(route.duration_seconds).toBeGreaterThan(1000);
      expect(route.encoded_polyline).toBeTruthy();

      // Waypoints checks
      expect(route.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(route.waypoints[0].type).toBe('ORIGIN');
      expect(route.waypoints[0].sequence).toBe(1);

      const lastWp = route.waypoints[route.waypoints.length - 1];
      expect(lastWp.type).toBe('DESTINATION');
      expect(lastWp.sequence).toBe(route.waypoints.length);

      // Verify strict ascending sequence and distance monotonicity
      for (let i = 1; i < route.waypoints.length; i++) {
        expect(route.waypoints[i].sequence).toBe(route.waypoints[i - 1].sequence + 1);
        expect(route.waypoints[i].distance_from_start_meters).toBeGreaterThanOrEqual(
          route.waypoints[i - 1].distance_from_start_meters
        );
      }
    });

    it('rejects calculation for identical origin and destination', async () => {
      await expect(
        routeService.calculateRouteForLocations('loc_icem_campus', 'loc_icem_campus')
      ).rejects.toThrow('must be distinct');
    });
  });

  describe('attachRouteToRide & retrieval', () => {
    it('persists and retrieves route and waypoints for a ride', async () => {
      const rideId = 'test_ride_route_99';
      const calculated = await routeService.calculateRouteForLocations(
        'loc_icem_campus',
        'loc_talegaon_station'
      );

      const { route, waypoints } = await routeService.attachRouteToRide(rideId, calculated);
      expect(route).toBeDefined();
      expect(route.ride_id).toBe(rideId);
      expect(waypoints.length).toBeGreaterThanOrEqual(2);

      // Retrieve
      const fetchedRoute = await routeService.getRouteForRide(rideId);
      expect(fetchedRoute).toBeDefined();
      expect(fetchedRoute?.encoded_polyline).toBe(calculated.encoded_polyline);

      const fetchedWaypoints = await routeService.getWaypointsForRide(rideId);
      expect(fetchedWaypoints.length).toBe(waypoints.length);
      expect(fetchedWaypoints[0].sequence).toBe(1);
    });
  });
});
