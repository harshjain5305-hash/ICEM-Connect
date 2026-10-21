import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rideService } from '@/features/rides/ride.service';
import { rideRepository } from '@/features/rides/ride.repository';
import { matchingService } from '@/features/matching/matching.service';
import { requestService } from '@/features/requests/request.service';
import { requestRepository } from '@/features/requests/request.repository';
import { rideSessionService } from '@/features/rides/rideSession.service';
import { rideSessionRepository } from '@/features/rides/rideSession.repository';
import { liveLocationService } from '@/features/location-tracking/liveLocation.service';
import { rideMessageService } from '@/features/rides/rideMessage.service';
import { ratingService } from '@/features/ratings/rating.service';
import { ratingRepository } from '@/features/ratings/rating.repository';
import { moderationService } from '@/features/moderation/moderation.service';
import { adminService } from '@/features/admin/admin.service';
import { authService } from '@/features/auth/auth.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { Ride, RideWaypoint } from '@/features/rides/ride.types';
import type { JoinRequest, RideParticipant } from '@/features/requests/request.types';
import type { StudentProfile } from '@/features/auth/auth.types';

describe('Phase 10 — MVP Integration Journeys & Security Hardening (Phases.md §14, §30)', () => {
  const hostId = '11111111-1111-1111-1111-111111111111';
  const passengerId = '22222222-2222-2222-2222-222222222222';
  const passenger2Id = '33333333-3333-3333-3333-333333333333';
  const outsiderId = '44444444-4444-4444-4444-444444444444';
  const adminId = '99999999-9999-9999-9999-999999999999';

  const hostProfile: StudentProfile = {
    id: hostId,
    name: 'Rohan Sharma',
    email: 'rohan.sharma@indiraicem.ac.in',
    prn: 'PRN10001',
    department: 'Computer Engineering',
    year: 3,
    profile_image_url: null,
    status: 'ACTIVE',
    rating_average: 4.8,
    rating_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const passengerProfile: StudentProfile = {
    id: passengerId,
    name: 'Priya Patel',
    email: 'priya.patel@indiraicem.ac.in',
    prn: 'PRN10002',
    department: 'Information Technology',
    year: 2,
    profile_image_url: null,
    status: 'ACTIVE',
    rating_average: 5.0,
    rating_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Mock In-Memory State
  let inMemoryRides: Ride[] = [];
  let inMemoryWaypoints: RideWaypoint[] = [];
  let inMemoryRequests: JoinRequest[] = [];
  let inMemoryParticipants: RideParticipant[] = [];

  beforeEach(() => {
    localStorage.clear();
    rideMessageService.clearRateLimitCache();
    vi.restoreAllMocks();

    inMemoryRides = [];
    inMemoryWaypoints = [];
    inMemoryRequests = [];
    inMemoryParticipants = [];

    // Profile & auth mocks
    vi.spyOn(authService, 'getProfile').mockImplementation(async (id) => {
      if (id === hostId) return hostProfile;
      if (id === passengerId) return passengerProfile;
      return null;
    });

    vi.spyOn(authService, 'getUserRoles').mockImplementation(async (id) => {
      if (id === adminId) return ['ADMIN', 'STUDENT'];
      return ['STUDENT'];
    });

    // Ride repository mocks
    vi.spyOn(rideRepository, 'createRide').mockImplementation(async (rHostId, input, status = 'DRAFT') => {
      const newRide: Ride = {
        id: crypto.randomUUID(),
        host_id: rHostId,
        origin_location_id: input.origin_location_id,
        destination_location_id: input.destination_location_id,
        departure_date: input.departure_date,
        departure_time: input.departure_time,
        available_seats: input.available_seats ?? input.total_seats,
        total_seats: input.total_seats,
        status: status,
        vehicle_type: input.vehicle_type,
        note: input.note ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryRides.push(newRide);
      return newRide;
    });

    vi.spyOn(rideRepository, 'getRideById').mockImplementation(async (id) => {
      return inMemoryRides.find((r) => r.id === id) || null;
    });

    vi.spyOn(rideRepository, 'updateRideStatus').mockImplementation(async (id, status) => {
      const ride = inMemoryRides.find((r) => r.id === id);
      if (!ride) throw new Error('Ride not found');
      ride.status = status;
      return { ...ride };
    });

    vi.spyOn(rideRepository, 'listPublishedRides').mockImplementation(async () => {
      return inMemoryRides.filter((r) => ['PUBLISHED', 'CONFIRMED'].includes(r.status));
    });

    vi.spyOn(rideRepository, 'getWaypointsForRide').mockImplementation(async (rideId) => {
      return inMemoryWaypoints.filter((w) => w.ride_id === rideId);
    });

    // Request repository mocks
    vi.spyOn(requestRepository, 'listRequestsByRide').mockImplementation(async (rideId) => {
      return inMemoryRequests.filter((r) => r.ride_id === rideId);
    });

    vi.spyOn(requestRepository, 'listParticipantsByRide').mockImplementation(async (rideId) => {
      return inMemoryParticipants.filter((p) => p.ride_id === rideId);
    });

    vi.spyOn(requestRepository, 'createRequest').mockImplementation(async (studentId, input) => {
      const newReq: JoinRequest = {
        id: crypto.randomUUID(),
        ride_id: input.ride_id,
        student_id: studentId,
        seat_count: input.seat_count,
        specific_area_note: input.specific_area_note,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryRequests.push(newReq);
      return newReq;
    });

    vi.spyOn(requestRepository, 'acceptRequest').mockImplementation(async (hostUserId, requestId) => {
      const req = inMemoryRequests.find((r) => r.id === requestId);
      if (!req) throw new Error('Request not found');
      const ride = inMemoryRides.find((r) => r.id === req.ride_id);
      if (!ride) throw new Error('Ride not found');
      if (ride.host_id !== hostUserId) throw new Error('Forbidden');
      if (ride.available_seats < req.seat_count) throw new Error('Insufficient seats available');

      req.status = 'ACCEPTED';
      ride.available_seats -= req.seat_count;

      const participant: RideParticipant = {
        id: crypto.randomUUID(),
        ride_id: ride.id,
        student_id: req.student_id,
        seat_count: req.seat_count,
        status: 'CONFIRMED',
        joined_at: new Date().toISOString(),
      };
      inMemoryParticipants.push(participant);
      return {
        success: true,
        request_id: req.id,
        ride_id: ride.id,
        status: 'ACCEPTED',
        available_seats: ride.available_seats,
        ride_status: ride.status,
      };
    });

    // Realtime broadcast mock
    vi.spyOn(realtimeService, 'broadcastRideEvent').mockResolvedValue(true as unknown as void);
  });

  describe('Journey 1: Full Host & Passenger Lifecycle (Phases.md §14, §30)', () => {
    it('executes the full coordination flow from ride offer to completion & mutual rating', async () => {
      const today = new Date().toISOString().slice(0, 10);

      // 1. Host creates a ride draft
      const createdRide = await rideService.createRide(
        hostId,
        {
          origin_location_id: 'loc_icem_campus',
          destination_location_id: 'loc_talegaon_station',
          departure_date: today,
          departure_time: '08:30',
          total_seats: 1,
          available_seats: 1,
          vehicle_type: 'SCOOTER',
        },
        true
      );
      expect(createdRide.status).toBe('DRAFT');

      // 2. Add corridor waypoints
      const w1: RideWaypoint = {
        id: 'w-1',
        ride_id: createdRide.id,
        location_id: 'loc_icem_campus',
        label: 'ICEM Main Campus (Parandwadi)',
        latitude: 18.7238,
        longitude: 73.6823,
        sequence: 0,
        type: 'ORIGIN',
        created_at: new Date().toISOString(),
      };
      const w2: RideWaypoint = {
        id: 'w-2',
        ride_id: createdRide.id,
        location_id: 'loc_somatne_phata',
        label: 'Somatne Phata (Expressway Junction)',
        latitude: 18.7182,
        longitude: 73.6894,
        sequence: 1,
        type: 'WAYPOINT',
        created_at: new Date().toISOString(),
      };
      const w3: RideWaypoint = {
        id: 'w-3',
        ride_id: createdRide.id,
        location_id: 'loc_talegaon_station',
        label: 'Talegaon Dabhade Railway Station',
        latitude: 18.7302,
        longitude: 73.6749,
        sequence: 2,
        type: 'DESTINATION',
        created_at: new Date().toISOString(),
      };
      inMemoryWaypoints.push(w1, w2, w3);

      // 3. Host publishes ride
      const published = await rideService.publishRide(hostId, createdRide.id);
      expect(published.status).toBe('PUBLISHED');

      // 4. Passenger searches and finds compatible ride segment
      const searchResult = await matchingService.findCompatibleRides({
        pickup_location_id: 'loc_somatne_phata',
        drop_location_id: 'loc_talegaon_station',
        departure_date: today,
        departure_time: '08:30',
        requested_seats: 1,
      });
      expect(searchResult.candidates.length).toBeGreaterThan(0);
      expect(searchResult.candidates[0].ride.id).toBe(createdRide.id);
      expect(searchResult.candidates[0].matchScore).toBeGreaterThanOrEqual(50);

      // 5. Passenger submits Join Request with optional pickup note (Phases.md §28)
      const joinReq = await requestService.createRequest(passengerId, {
        ride_id: createdRide.id,
        seat_count: 1,
        specific_area_note: 'Wait under the highway flyover near tea stall',
      });
      expect(joinReq.status).toBe('PENDING');
      expect(joinReq.specific_area_note).toBe('Wait under the highway flyover near tea stall');

      // 6. Host and requester coordinate via chat prior to acceptance (Architecture.md §47.4)
      const requesterMsg = await rideMessageService.sendMessage(
        createdRide.id,
        passengerId,
        'Hi Rohan, I will be standing near the tea stall under the bridge'
      );
      expect(requesterMsg.message).toContain('tea stall');

      const hostMsg = await rideMessageService.sendMessage(
        createdRide.id,
        hostId,
        'Noted Priya, see you there at 8:30 AM'
      );
      expect(hostMsg.message).toContain('8:30 AM');

      // 7. Host accepts join request -> capacity reaches 0 (total: 1, avail: 0)
      const acceptResult = await requestService.acceptRequest(hostId, joinReq.id);
      expect(acceptResult.status).toBe('ACCEPTED');
      expect(inMemoryRides.find((r) => r.id === createdRide.id)?.available_seats).toBe(0);

      // 8. New outsider attempts to coordinate when capacity is full -> rejected (Architecture.md §47.4)
      const outsiderReq: JoinRequest = {
        id: 'req-outsider',
        ride_id: createdRide.id,
        student_id: outsiderId,
        seat_count: 1,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryRequests.push(outsiderReq);

      await expect(
        rideMessageService.sendMessage(createdRide.id, outsiderId, 'Any seat left for me?')
      ).rejects.toThrow(/full capacity/i);

      // Confirmed passenger and host can still chat!
      rideMessageService.clearRateLimitCache();
      const finalCoordMsg = await rideMessageService.sendMessage(
        createdRide.id,
        passengerId,
        'I am wearing a blue backpack'
      );
      expect(finalCoordMsg.message).toBe('I am wearing a blue backpack');

      // 9. Host starts ride journey -> status ACTIVE
      let currentSession: any = null;
      vi.spyOn(rideSessionRepository, 'startSession').mockImplementation(async (rId) => {
        const ride = inMemoryRides.find((r) => r.id === rId);
        if (ride) ride.status = 'ACTIVE';
        currentSession = {
          id: 'session-1',
          ride_id: rId,
          started_at: new Date().toISOString(),
          ended_at: null,
          status: 'ACTIVE',
          location_enabled: true,
          last_location_at: null,
          created_at: new Date().toISOString(),
        };
        return currentSession;
      });

      vi.spyOn(rideSessionRepository, 'getActiveSession').mockImplementation(async (rId) => {
        return currentSession && currentSession.ride_id === rId ? currentSession : null;
      });

      const startedSession = await rideSessionService.startSession(hostId, createdRide.id);
      expect(startedSession.status).toBe('ACTIVE');

      // 10. Live location streaming permissions check (Rules.md §14, §15)
      const hostCanPublish = await liveLocationService.canPublishLocation(createdRide.id, hostId);
      expect(hostCanPublish).toBe(true);

      const passengerCanSubscribe = await liveLocationService.canSubscribeLocation(createdRide.id, passengerId);
      expect(passengerCanSubscribe).toBe(true);

      const strangerCannotSubscribe = await liveLocationService.canSubscribeLocation(createdRide.id, outsiderId);
      expect(strangerCannotSubscribe).toBe(false);

      // 11. Complete the trip
      vi.spyOn(rideSessionRepository, 'endSession').mockImplementation(async (rId) => {
        const ride = inMemoryRides.find((r) => r.id === rId);
        if (ride) ride.status = 'COMPLETED';
        if (currentSession) {
          currentSession.status = 'ENDED';
          currentSession.location_enabled = false;
          currentSession.ended_at = new Date().toISOString();
        }
        return currentSession;
      });

      const endedSession = await rideSessionService.endSession(hostId, createdRide.id);
      expect(endedSession.status).toBe('ENDED');
      expect(inMemoryRides.find((r) => r.id === createdRide.id)?.status).toBe('COMPLETED');

      // 12. Chat transitions to READ-ONLY upon completion (Phases.md §30, Architecture.md §47.8)
      rideMessageService.clearRateLimitCache();
      await expect(
        rideMessageService.sendMessage(createdRide.id, passengerId, 'Thanks for the ride!')
      ).rejects.toThrow(/read-only/i);

      // 13. Rating eligibility and atomic reputation calculation (Phase 7 & 10)
      vi.spyOn(ratingRepository, 'submitRating').mockResolvedValue({
        success: true,
        rating_id: 'rating-1',
        new_average: 4.83,
        new_count: 6,
      });

      const ratingResult = await ratingService.submitRating(passengerId, {
        ride_id: createdRide.id,
        reviewee_id: hostId,
        score: 5,
        feedback: 'Great ride, on time!',
      });
      expect(ratingResult.success).toBe(true);
      expect(ratingResult.new_count).toBe(6);
    });
  });

  describe('Journey 2: Capacity Race Concurrency (Phases.md §14)', () => {
    it('prevents overbooking when two passengers simultaneously request the last remaining seat', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const raceRide = await rideService.createRide(
        hostId,
        {
          origin_location_id: 'loc_icem_gate',
          destination_location_id: 'loc_talegaon_station',
          departure_date: today,
          departure_time: '09:00',
          total_seats: 1,
          available_seats: 1,
          vehicle_type: 'BIKE',
        },
        true
      );
      await rideService.publishRide(hostId, raceRide.id);

      // Create two concurrent join requests
      const req1 = await requestService.createRequest(passengerId, {
        ride_id: raceRide.id,
        seat_count: 1,
      });

      const req2 = await requestService.createRequest(passenger2Id, {
        ride_id: raceRide.id,
        seat_count: 1,
      });

      // Host accepts req1 first
      const acceptResult1 = await requestService.acceptRequest(hostId, req1.id);
      expect(acceptResult1.status).toBe('ACCEPTED');

      // Host attempts to accept req2 when 0 seats remain -> must fail atomically
      await expect(
        requestService.acceptRequest(hostId, req2.id)
      ).rejects.toThrow();

      // Available seats must never drop below 0
      const currentRide = inMemoryRides.find((r) => r.id === raceRide.id);
      expect(currentRide?.available_seats).toBe(0);
    });
  });

  describe('Journey 3: Ride Cancellation & Safety Hardening (Phases.md §14)', () => {
    it('cancels ride, notifies confirmed participants, and enforces read-only chat', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const cancelRide = await rideService.createRide(
        hostId,
        {
          origin_location_id: 'loc_icem_campus',
          destination_location_id: 'loc_somatne_phata',
          departure_date: today,
          departure_time: '10:00',
          total_seats: 2,
          available_seats: 2,
          vehicle_type: 'SCOOTER',
        },
        true
      );
      await rideService.publishRide(hostId, cancelRide.id);

      // Host cancels ride
      const cancelled = await rideService.cancelRide(hostId, cancelRide.id);
      expect(cancelled.status).toBe('CANCELLED');

      // Chat must reject new messages
      await expect(
        rideMessageService.sendMessage(cancelRide.id, hostId, 'Trip is off')
      ).rejects.toThrow(/read-only/i);
    });

    it('denies rating submission when ride is not COMPLETED', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const incompleteRide = await rideService.createRide(
        hostId,
        {
          origin_location_id: 'loc_icem_campus',
          destination_location_id: 'loc_talegaon_station',
          departure_date: today,
          departure_time: '11:00',
          total_seats: 1,
          available_seats: 1,
          vehicle_type: 'BIKE',
        },
        true
      );
      await rideService.publishRide(hostId, incompleteRide.id);

      await expect(
        ratingService.submitRating(passengerId, {
          ride_id: incompleteRide.id,
          reviewee_id: hostId,
          score: 5,
        })
      ).rejects.toThrow(/completed/i);
    });

    it('enforces server-authoritative admin access boundary', async () => {
      // Admin can list reports
      vi.spyOn(moderationService, 'listAllReports').mockResolvedValue([]);
      const reports = await adminService.listReports(adminId);
      expect(reports).toEqual([]);

      // Non-admin student is rejected
      await expect(
        adminService.listReports(passengerId)
      ).rejects.toThrow(/forbidden/i);
    });
  });
});
