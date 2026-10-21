import { describe, it, expect } from 'vitest';
import {
  createRideSchema,
  createWaypointSchema,
  createJoinRequestSchema,
} from './ride.schema';

describe('Core Data Model Schemas (Phase 2)', () => {
  describe('createRideSchema', () => {
    it('validates a valid ride creation payload', () => {
      const validRide = {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '2026-10-22',
        departure_time: '17:30',
        total_seats: 1,
        vehicle_type: 'SCOOTER',
        note: 'Can carry small bag, leaving right after MCA lab',
      };

      const result = createRideSchema.safeParse(validRide);
      expect(result.success).toBe(true);
    });

    it('rejects identical origin and destination locations', () => {
      const invalidRide = {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_icem_campus',
        departure_date: '2026-10-22',
        departure_time: '17:30',
        total_seats: 2,
        vehicle_type: 'BIKE',
      };

      const result = createRideSchema.safeParse(invalidRide);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('cannot be the same');
      }
    });

    it('rejects available_seats exceeding total_seats', () => {
      const invalidRide = {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '2026-10-22',
        departure_time: '17:30',
        total_seats: 1,
        available_seats: 3, // Cannot exceed 1
        vehicle_type: 'SCOOTER',
      };

      const result = createRideSchema.safeParse(invalidRide);
      expect(result.success).toBe(false);
    });

    it('rejects invalid departure date or time formats', () => {
      const invalidDate = {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '22-10-2026', // Not YYYY-MM-DD
        departure_time: '5:30 PM', // Not HH:MM
        total_seats: 1,
      };

      const result = createRideSchema.safeParse(invalidDate);
      expect(result.success).toBe(false);
    });
  });

  describe('createWaypointSchema', () => {
    it('validates ordered waypoint input', () => {
      const waypoint = {
        sequence: 2,
        label: 'Somatne Phata',
        type: 'WAYPOINT',
        latitude: 18.7182,
        longitude: 73.6894,
        location_id: 'loc_somatne_phata',
        distance_from_start_meters: 1500,
      };

      const result = createWaypointSchema.safeParse(waypoint);
      expect(result.success).toBe(true);
    });

    it('rejects non-positive sequence numbers', () => {
      const invalidWp = {
        sequence: 0,
        label: 'Start',
        latitude: 18.7,
        longitude: 73.6,
      };

      const result = createWaypointSchema.safeParse(invalidWp);
      expect(result.success).toBe(false);
    });
  });

  describe('createJoinRequestSchema', () => {
    it('validates join request with optional specific area note (Design.md §73)', () => {
      const validReq = {
        ride_id: 'ride_123',
        pickup_waypoint_id: 'wp_pickup_01',
        drop_waypoint_id: 'wp_drop_02',
        seat_count: 1,
        specific_area_note: 'Near the HP petrol pump, can walk 100m',
      };

      const result = createJoinRequestSchema.safeParse(validReq);
      expect(result.success).toBe(true);
    });

    it('rejects identical pickup and drop waypoint IDs', () => {
      const invalidReq = {
        ride_id: 'ride_123',
        pickup_waypoint_id: 'wp_same_point',
        drop_waypoint_id: 'wp_same_point',
        seat_count: 1,
      };

      const result = createJoinRequestSchema.safeParse(invalidReq);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('cannot be identical');
      }
    });

    it('rejects oversized specific area notes (>150 chars)', () => {
      const oversizedNote = {
        ride_id: 'ride_123',
        pickup_waypoint_id: 'wp_1',
        drop_waypoint_id: 'wp_2',
        seat_count: 1,
        specific_area_note: 'a'.repeat(160),
      };

      const result = createJoinRequestSchema.safeParse(oversizedNote);
      expect(result.success).toBe(false);
    });
  });
});
