import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { liveLocationService } from './liveLocation.service';
import { calculateLocationFreshness } from './location.types';
import { rideService } from '@/features/rides/ride.service';
import { rideSessionService } from '@/features/rides/rideSession.service';
import { requestService } from '@/features/requests/request.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { RealtimeRideEvent } from '@/features/realtime/realtime.types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: () => false,
}));

describe('Live Location Tracking Service (Phase 9)', () => {
  const hostId = 'student_host_gps_1';
  const passengerId = 'student_passenger_gps_2';
  const strangerId = 'student_unauthorized_3';

  let testRideId: string;

  beforeEach(async () => {
    localStorage.clear();
    realtimeService.reset();
    liveLocationService.reset();

    // Create a 2-seat published ride: ICEM Campus -> Bhosari
    const ride = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-11-01',
      departure_time: '17:30',
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

  afterEach(() => {
    realtimeService.reset();
    liveLocationService.reset();
  });

  describe('Location Publishing Authorization (Rules.md §14.3)', () => {
    it('authorizes host to publish live GPS during an ACTIVE ride session', async () => {
      // Start ride session
      await rideSessionService.startSession(hostId, testRideId);

      const canPublish = await liveLocationService.canPublishLocation(testRideId, hostId);
      expect(canPublish).toBe(true);

      const published = await liveLocationService.publishLocation(
        hostId,
        {
          ride_id: testRideId,
          latitude: 18.7238,
          longitude: 73.6823,
          accuracy: 10,
          heading: 90,
          speed: 35,
          timestamp: new Date().toISOString(),
        },
        true // bypass throttle for test
      );

      expect(published).toBe(true);
    });

    it('strictly forbids non-host from publishing location', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      await expect(
        liveLocationService.publishLocation(passengerId, {
          ride_id: testRideId,
          latitude: 18.7238,
          longitude: 73.6823,
          accuracy: 10,
          heading: null,
          speed: null,
          timestamp: new Date().toISOString(),
        })
      ).rejects.toThrow(/Forbidden: Unauthorized to publish live location/i);
    });

    it('rejects publishing location when ride is not in ACTIVE state', async () => {
      // Ride is PUBLISHED/CONFIRMED, not ACTIVE
      const canPublish = await liveLocationService.canPublishLocation(testRideId, hostId);
      expect(canPublish).toBe(false);

      await expect(
        liveLocationService.publishLocation(hostId, {
          ride_id: testRideId,
          latitude: 18.7238,
          longitude: 73.6823,
          accuracy: 10,
          heading: null,
          speed: null,
          timestamp: new Date().toISOString(),
        })
      ).rejects.toThrow(/Forbidden: Unauthorized to publish live location/i);
    });
  });

  describe('Location Subscription Authorization (Rules.md §14.1, §14.4)', () => {
    it('permits confirmed passenger to subscribe and receive live location during ACTIVE ride', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      const canSubscribe = await liveLocationService.canSubscribeLocation(testRideId, passengerId);
      expect(canSubscribe).toBe(true);

      // Publish location
      await liveLocationService.publishLocation(
        hostId,
        {
          ride_id: testRideId,
          latitude: 18.7238,
          longitude: 73.6823,
          accuracy: 8,
          heading: 180,
          speed: 40,
          timestamp: new Date().toISOString(),
        },
        true
      );

      const latest = await liveLocationService.getLatestLocation(testRideId, passengerId);
      expect(latest).toBeDefined();
      expect(latest?.latitude).toBe(18.7238);
      expect(latest?.speed).toBe(40);
    });

    it('denies unrelated student from receiving live location (403 Forbidden)', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      const canSubscribe = await liveLocationService.canSubscribeLocation(testRideId, strangerId);
      expect(canSubscribe).toBe(false);

      await expect(
        liveLocationService.getLatestLocation(testRideId, strangerId)
      ).rejects.toThrow(/Forbidden: Unauthorized to receive live location/i);
    });

    it('terminates location subscription access once ride is COMPLETED', async () => {
      await rideSessionService.startSession(hostId, testRideId);
      await rideSessionService.endSession(hostId, testRideId);

      const canSubscribe = await liveLocationService.canSubscribeLocation(testRideId, passengerId);
      expect(canSubscribe).toBe(false);
    });
  });

  describe('GPS Throttling & Movement Rules (Rules.md §15)', () => {
    it('throttles rapid subsequent GPS broadcasts unless time or distance threshold is met', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      const now = new Date().toISOString();

      // First broadcast succeeds
      const first = await liveLocationService.publishLocation(hostId, {
        ride_id: testRideId,
        latitude: 18.7238,
        longitude: 73.6823,
        accuracy: 10,
        heading: 90,
        speed: 20,
        timestamp: now,
      });
      expect(first).toBe(true);

      // Immediate second broadcast with virtually identical position (< 15m, < 5s) is throttled
      const secondImmediate = await liveLocationService.publishLocation(hostId, {
        ride_id: testRideId,
        latitude: 18.723801,
        longitude: 73.682301,
        accuracy: 10,
        heading: 90,
        speed: 20,
        timestamp: now,
      });
      expect(secondImmediate).toBe(false);

      // Significant movement (> 15m) bypasses time throttle
      const thirdMoved = await liveLocationService.publishLocation(hostId, {
        ride_id: testRideId,
        latitude: 18.725, // moved ~130 meters north
        longitude: 73.6823,
        accuracy: 10,
        heading: 0,
        speed: 25,
        timestamp: now,
      });
      expect(thirdMoved).toBe(true);
    });
  });

  describe('Signal Freshness Evaluation (Rules.md §17)', () => {
    it('computes FRESH, STALE, and LOST based on telemetry age', () => {
      const now = Date.now();

      // 5 seconds ago -> FRESH
      const freshTs = new Date(now - 5000).toISOString();
      expect(calculateLocationFreshness(freshTs)).toBe('FRESH');

      // 35 seconds ago -> STALE
      const staleTs = new Date(now - 35000).toISOString();
      expect(calculateLocationFreshness(staleTs)).toBe('STALE');

      // 70 seconds ago -> LOST
      const lostTs = new Date(now - 70000).toISOString();
      expect(calculateLocationFreshness(lostTs)).toBe('LOST');

      // Null timestamp -> LOST
      expect(calculateLocationFreshness(null)).toBe('LOST');
    });
  });

  describe('Realtime Broadcast Delivery', () => {
    it('emits location:update events to connected room subscribers in real time', async () => {
      await rideSessionService.startSession(hostId, testRideId);

      const receivedEvents: RealtimeRideEvent[] = [];
      const sub = await realtimeService.subscribeToRideRoom(
        testRideId,
        passengerId,
        'Passenger GPS',
        'PASSENGER',
        {
          onEvent: (e) => receivedEvents.push(e),
        }
      );

      await liveLocationService.publishLocation(
        hostId,
        {
          ride_id: testRideId,
          latitude: 18.724,
          longitude: 73.683,
          accuracy: 8,
          heading: 45,
          speed: 30,
          timestamp: new Date().toISOString(),
        },
        true
      );

      const locEvent = receivedEvents.find((e) => e.type === 'location:update');
      expect(locEvent).toBeDefined();
      expect(locEvent?.type).toBe('location:update');
      if (locEvent && locEvent.type === 'location:update') {
        expect(locEvent.payload.latitude).toBe(18.724);
        expect(locEvent.payload.speed).toBe(30);
      }

      sub.unsubscribe();
    });
  });
});
