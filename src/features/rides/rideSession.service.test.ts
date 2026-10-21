import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rideSessionService } from './rideSession.service';
import { rideService } from './ride.service';
import { requestService } from '@/features/requests/request.service';
import { notificationService } from '@/features/notifications/notification.service';
import { realtimeService } from '@/features/realtime/realtime.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: () => false,
}));

describe('Active Ride Sessions & Session Lifecycle Service (Phase 8)', () => {
  const hostId = 'student_host_session_1';
  const passengerId = 'student_passenger_session_2';
  const strangerId = 'student_stranger_session_3';

  let testRideId: string;

  beforeEach(async () => {
    localStorage.clear();
    realtimeService.reset();

    // Create a 2-seat published ride: ICEM Campus -> Bhosari
    const ride = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-31',
      departure_time: '18:00',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
    });
    testRideId = ride.id;

    // Passenger requests and gets confirmed
    const req = await requestService.createRequest(passengerId, {
      ride_id: testRideId,
      seat_count: 1,
    });
    await requestService.acceptRequest(hostId, req.id);
  });

  describe('Session Initiation & Lifecycle (Architecture.md §12.1)', () => {
    it('allows host to start active ride session, transitioning ride to ACTIVE and notifying participants', async () => {
      const session = await rideSessionService.startSession(hostId, testRideId);

      expect(session).toBeDefined();
      expect(session.ride_id).toBe(testRideId);
      expect(session.status).toBe('ACTIVE');
      expect(session.location_enabled).toBe(true);
      expect(session.started_at).toBeDefined();

      // Ride status must become ACTIVE
      const updatedRide = await rideService.getRide(testRideId);
      expect(updatedRide.status).toBe('ACTIVE');

      // Confirmed passenger must receive RIDE_CONFIRMED / Live Active notification
      const passengerNotifs = await notificationService.getUserNotifications(passengerId);
      const startNotif = passengerNotifs.find((n) => n.data?.action === 'RIDE_STARTED');
      expect(startNotif).toBeDefined();
      expect(startNotif?.title).toContain('Ride Started');

      // Check isSessionActive
      const isActive = await rideSessionService.isSessionActive(testRideId, hostId);
      expect(isActive).toBe(true);
    });

    it('strictly forbids non-host from starting a ride session (Rules.md §14)', async () => {
      await expect(
        rideSessionService.startSession(passengerId, testRideId)
      ).rejects.toThrow(/Forbidden: Only the ride host can start an active ride session/i);

      await expect(
        rideSessionService.startSession(strangerId, testRideId)
      ).rejects.toThrow(/Forbidden: Only the ride host can start an active ride session/i);
    });

    it('rejects starting session on invalid ride status', async () => {
      // Create a DRAFT ride
      const draftRide = await rideService.createRide(hostId, {
        origin_location_id: 'loc_icem_campus',
        destination_location_id: 'loc_bhosari_stand',
        departure_date: '2026-10-31',
        departure_time: '18:00',
        total_seats: 1,
        vehicle_type: 'BIKE',
      });

      // Status of newly created ride is PUBLISHED by default in createRide
      // Let's cancel it
      await rideService.cancelRide(hostId, draftRide.id);

      await expect(
        rideSessionService.startSession(hostId, draftRide.id)
      ).rejects.toThrow(/Cannot start ride with status CANCELLED/i);
    });
  });

  describe('Session Termination & Completion (Architecture.md §12.1)', () => {
    it('allows host to end active ride session, transitioning ride to COMPLETED and prompting ratings', async () => {
      // Start session first
      await rideSessionService.startSession(hostId, testRideId);

      // End session
      const endedSession = await rideSessionService.endSession(hostId, testRideId);

      expect(endedSession.status).toBe('ENDED');
      expect(endedSession.ended_at).toBeDefined();
      expect(endedSession.location_enabled).toBe(false);

      // Ride status must become COMPLETED
      const updatedRide = await rideService.getRide(testRideId);
      expect(updatedRide.status).toBe('COMPLETED');

      // Confirmed passenger must receive completion & rating prompt notification
      const passengerNotifs = await notificationService.getUserNotifications(passengerId);
      const completedNotif = passengerNotifs.find((n) => n.data?.action === 'RIDE_COMPLETED');
      expect(completedNotif).toBeDefined();
      expect(completedNotif?.title).toContain('Trip Completed');

      // Check isSessionActive
      const isActive = await rideSessionService.isSessionActive(testRideId, hostId);
      expect(isActive).toBe(false);
    });

    it('strictly forbids non-host from ending a ride session', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      await expect(
        rideSessionService.endSession(passengerId, testRideId)
      ).rejects.toThrow(/Forbidden: Only the ride host can end this ride session/i);
    });

    it('rejects ending a session if the ride is not ACTIVE', async () => {
      await expect(
        rideSessionService.endSession(hostId, testRideId)
      ).rejects.toThrow(/Cannot complete ride with status/i);
    });
  });

  describe('Session Authorization Boundary (Rules.md §14)', () => {
    it('permits host and confirmed passenger to retrieve active session', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      const hostSession = await rideSessionService.getActiveSession(testRideId, hostId);
      expect(hostSession).toBeDefined();
      expect(hostSession?.status).toBe('ACTIVE');

      const passengerSession = await rideSessionService.getActiveSession(testRideId, passengerId);
      expect(passengerSession).toBeDefined();
      expect(passengerSession?.id).toBe(hostSession?.id);
    });

    it('denies unrelated student from retrieving active session details (403 Forbidden)', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      await expect(
        rideSessionService.getActiveSession(testRideId, strangerId)
      ).rejects.toThrow(/Forbidden: Access to active ride session is restricted to confirmed participants and host/i);
    });
  });
});
