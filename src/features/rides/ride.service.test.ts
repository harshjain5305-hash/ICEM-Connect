import { describe, it, expect, beforeEach } from 'vitest';
import { rideService, RideServiceError } from './ride.service';

describe('Ride Service & Lifecycle Enforcement (Phase 3)', () => {
  const hostId = 'student_host_101';
  const otherStudentId = 'student_passenger_202';

  const validRidePayload = {
    origin_location_id: 'loc_icem_campus',
    destination_location_id: 'loc_bhosari_stand',
    departure_date: '2026-10-25',
    departure_time: '17:30',
    total_seats: 1,
    vehicle_type: 'SCOOTER' as const,
    note: 'Leaving from main gate after lab',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('createRide', () => {
    it('creates a PUBLISHED ride by default', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload);

      expect(ride.id).toBeDefined();
      expect(ride.host_id).toBe(hostId);
      expect(ride.status).toBe('PUBLISHED');
      expect(ride.total_seats).toBe(1);
      expect(ride.available_seats).toBe(1);
      expect(ride.published_at).toBeDefined();
      expect(ride.origin?.name).toContain('ICEM');
      expect(ride.destination?.name).toContain('Bhosari');
    });

    it('creates a DRAFT ride when requested', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload, true);

      expect(ride.id).toBeDefined();
      expect(ride.host_id).toBe(hostId);
      expect(ride.status).toBe('DRAFT');
      expect(ride.published_at).toBeNull();
    });

    it('rejects creation without a host ID', async () => {
      await expect(
        rideService.createRide('', validRidePayload)
      ).rejects.toThrowError(RideServiceError);

      try {
        await rideService.createRide('', validRidePayload);
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('AUTH_REQUIRED');
      }
    });

    it('rejects invalid inputs with VALIDATION_ERROR', async () => {
      const invalid = {
        ...validRidePayload,
        destination_location_id: 'loc_icem_campus', // Same as origin
      };

      try {
        await rideService.createRide(hostId, invalid);
        expect.unreachable('Should have thrown validation error');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('updateRide', () => {
    it('allows the host to update a DRAFT or PUBLISHED ride', async () => {
      const draft = await rideService.createRide(hostId, validRidePayload, true);

      const updated = await rideService.updateRide(hostId, draft.id, {
        note: 'Updated note: helmets compulsory',
        vehicle_type: 'BIKE',
      });

      expect(updated.note).toBe('Updated note: helmets compulsory');
      expect(updated.vehicle_type).toBe('BIKE');
    });

    it('rejects updates from unauthorized non-host students', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload);

      try {
        await rideService.updateRide(otherStudentId, ride.id, {
          note: 'Tampered note',
        });
        expect.unreachable('Should have rejected non-host');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('FORBIDDEN');
      }
    });

    it('rejects updates on ACTIVE rides', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload);
      await rideService.startRide(hostId, ride.id); // Moves to ACTIVE

      try {
        await rideService.updateRide(hostId, ride.id, { note: 'New note' });
        expect.unreachable('Should have rejected update on active ride');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('RIDE_INVALID_STATE');
      }
    });
  });

  describe('Lifecycle State Machine Transitions', () => {
    it('progresses from DRAFT -> PUBLISHED -> ACTIVE -> COMPLETED', async () => {
      // 1. Create Draft
      const draft = await rideService.createRide(hostId, validRidePayload, true);
      expect(draft.status).toBe('DRAFT');

      // 2. Publish
      const published = await rideService.publishRide(hostId, draft.id);
      expect(published.status).toBe('PUBLISHED');
      expect(published.published_at).toBeDefined();

      // 3. Start (Active)
      const active = await rideService.startRide(hostId, published.id);
      expect(active.status).toBe('ACTIVE');

      // 4. Complete
      const completed = await rideService.completeRide(hostId, active.id);
      expect(completed.status).toBe('COMPLETED');
    });

    it('allows cancelling a PUBLISHED ride', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload);
      const cancelled = await rideService.cancelRide(hostId, ride.id, 'Change of plans');

      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects transitions on terminal rides', async () => {
      const ride = await rideService.createRide(hostId, validRidePayload);
      await rideService.startRide(hostId, ride.id);
      await rideService.completeRide(hostId, ride.id); // COMPLETED

      // Attempt to reactivate completed ride
      try {
        await rideService.startRide(hostId, ride.id);
        expect.unreachable('Should have rejected restart');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('RIDE_INVALID_STATE');
      }
    });

    it('rejects invalid state jumps', async () => {
      const draft = await rideService.createRide(hostId, validRidePayload, true);

      // Attempt DRAFT -> ACTIVE without publishing
      try {
        await rideService.startRide(hostId, draft.id);
        expect.unreachable('Should have rejected starting draft directly');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('RIDE_INVALID_STATE');
      }
    });
  });

  describe('deleteDraftRide', () => {
    it('deletes a DRAFT ride successfully', async () => {
      const draft = await rideService.createRide(hostId, validRidePayload, true);
      const deleted = await rideService.deleteDraftRide(hostId, draft.id);
      expect(deleted).toBe(true);

      await expect(rideService.getRide(draft.id)).rejects.toThrowError('not found');
    });

    it('rejects permanent deletion of a PUBLISHED ride', async () => {
      const published = await rideService.createRide(hostId, validRidePayload);

      try {
        await rideService.deleteDraftRide(hostId, published.id);
        expect.unreachable('Should have rejected deleting published ride');
      } catch (err: unknown) {
        const error = err as RideServiceError;
        expect(error.code).toBe('RIDE_INVALID_STATE');
      }
    });
  });

  describe('listHostRides', () => {
    it('returns all rides created by the specified host', async () => {
      await rideService.createRide(hostId, validRidePayload);
      await rideService.createRide(hostId, {
        ...validRidePayload,
        destination_location_id: 'loc_talegaon_station',
      });
      await rideService.createRide(otherStudentId, validRidePayload);

      const hostRides = await rideService.listHostRides(hostId);
      expect(hostRides.length).toBe(2);
      expect(hostRides.every((r) => r.host_id === hostId)).toBe(true);
    });
  });
});
