import { describe, it, expect, beforeEach } from 'vitest';
import { requestService } from './request.service';
import { rideService } from '@/features/rides/ride.service';
import { notificationService } from '@/features/notifications/notification.service';
import { moderationService } from '@/features/moderation/moderation.service';

describe('Join Request Service & Transactional Capacity (Phase 6)', () => {
  const hostId = 'student_host_1';
  const passenger1 = 'student_passenger_1';
  const passenger2 = 'student_passenger_2';

  let testRideId: string;

  beforeEach(async () => {
    localStorage.clear();

    // Create a 2-seat published ride: ICEM Campus -> Bhosari
    const ride = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-26',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Gate 1 pickup',
    });
    testRideId = ride.id;
  });

  it('allows verified student to create a join request with optional pickup note', async () => {
    const req = await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
      specific_area_note: 'Near the HP petrol pump; I can walk 100 m',
    });

    expect(req).toBeDefined();
    expect(req.status).toBe('PENDING');
    expect(req.seat_count).toBe(1);
    expect(req.specific_area_note).toBe('Near the HP petrol pump; I can walk 100 m');

    // Host should receive notification
    const hostNotifs = await notificationService.getUserNotifications(hostId);
    expect(hostNotifs.length).toBe(1);
    expect(hostNotifs[0].type).toBe('REQUEST_RECEIVED');
  });

  it('rejects host requesting a seat on their own ride (Rules.md §10)', async () => {
    await expect(
      requestService.createRequest(hostId, {
        ride_id: testRideId,
        seat_count: 1,
      })
    ).rejects.toThrow(/own ride/i);
  });

  it('rejects duplicate pending request from the same student', async () => {
    await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
    });

    await expect(
      requestService.createRequest(passenger1, {
        ride_id: testRideId,
        seat_count: 1,
      })
    ).rejects.toThrow(/already have an active pending request/i);
  });

  it('rejects request when requested seats exceed available capacity', async () => {
    // Ride has 2 seats; requesting 3 should fail
    await expect(
      requestService.createRequest(passenger1, {
        ride_id: testRideId,
        seat_count: 3,
      })
    ).rejects.toThrow(/Not enough available seats/i);
  });

  it('allows host to accept request: decrements capacity, creates participant, and notifies passenger', async () => {
    const req = await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
      specific_area_note: 'Main gate',
    });

    const result = await requestService.acceptRequest(hostId, req.id);

    expect(result.success).toBe(true);
    expect(result.status).toBe('ACCEPTED');
    expect(result.available_seats).toBe(1); // 2 - 1 = 1 seat remaining

    // Verify ride state in repository
    const updatedRide = await rideService.getRide(testRideId);
    expect(updatedRide.available_seats).toBe(1);

    // Verify participant is created
    const participants = await requestService.listParticipants(testRideId);
    expect(participants.length).toBe(1);
    expect(participants[0].student_id).toBe(passenger1);
    expect(participants[0].seat_count).toBe(1);
    expect(participants[0].status).toBe('CONFIRMED');

    // Verify passenger received notification
    const passengerNotifs = await notificationService.getUserNotifications(passenger1);
    expect(passengerNotifs.length).toBe(1);
    expect(passengerNotifs[0].type).toBe('REQUEST_ACCEPTED');
  });

  it('enforces atomic capacity and prevents overbooking when 2 requests compete for last seat (Architecture.md §10)', async () => {
    // Create two pending requests for 1 seat each on a ride with 1 remaining seat
    const singleSeatRide = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-26',
      departure_time: '18:00',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
    });

    const req1 = await requestService.createRequest(passenger1, {
      ride_id: singleSeatRide.id,
      seat_count: 1,
    });
    const req2 = await requestService.createRequest(passenger2, {
      ride_id: singleSeatRide.id,
      seat_count: 1,
    });

    // Accept request 1: succeeds and takes the last seat
    const res1 = await requestService.acceptRequest(hostId, req1.id);
    expect(res1.success).toBe(true);
    expect(res1.available_seats).toBe(0);

    // Accept request 2: must fail due to zero available capacity!
    await expect(
      requestService.acceptRequest(hostId, req2.id)
    ).rejects.toThrow(/Insufficient capacity/i);

    // Check ride remaining seats remains 0, not negative
    const ride = await rideService.getRide(singleSeatRide.id);
    expect(ride.available_seats).toBe(0);
  });

  it('allows host to reject request: status becomes REJECTED and capacity is untouched', async () => {
    const req = await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
    });

    const rejectResult = await requestService.rejectRequest(hostId, {
      request_id: req.id,
      reason: 'Route detour too far',
    });

    expect(rejectResult.success).toBe(true);
    expect(rejectResult.status).toBe('REJECTED');

    // Ride capacity remains 2
    const ride = await rideService.getRide(testRideId);
    expect(ride.available_seats).toBe(2);

    // Passenger received decline notification
    const passengerNotifs = await notificationService.getUserNotifications(passenger1);
    expect(passengerNotifs.length).toBe(1);
    expect(passengerNotifs[0].type).toBe('REQUEST_REJECTED');
  });

  it('allows passenger to cancel their pending request', async () => {
    const req = await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
    });

    const cancelResult = await requestService.cancelRequest(passenger1, req.id);
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.status).toBe('CANCELLED');

    const updatedReq = await requestService.getRequest(req.id);
    expect(updatedReq.status).toBe('CANCELLED');
  });

  it('restores seat capacity when a confirmed passenger cancels their seat before trip', async () => {
    const req = await requestService.createRequest(passenger1, {
      ride_id: testRideId,
      seat_count: 1,
    });
    await requestService.acceptRequest(hostId, req.id);

    // Before cancel: 1 seat left
    let ride = await rideService.getRide(testRideId);
    expect(ride.available_seats).toBe(1);

    // Passenger cancels accepted seat
    const cancelResult = await requestService.cancelRequest(passenger1, req.id);
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.restored_seats).toBe(1);

    // After cancel: seat is restored back to 2
    ride = await rideService.getRide(testRideId);
    expect(ride.available_seats).toBe(2);
  });

  it('rejects join requests between blocked peers in either direction (Rules.md §23)', async () => {
    // Host blocks passenger
    await moderationService.blockUser(hostId, { blocked_id: passenger1 });

    await expect(
      requestService.createRequest(passenger1, {
        ride_id: testRideId,
        seat_count: 1,
      })
    ).rejects.toThrow(/blocking/i);

    // Unblock and verify passenger blocking host also rejects
    await moderationService.unblockUser(hostId, passenger1);
    await moderationService.blockUser(passenger1, { blocked_id: hostId });

    await expect(
      requestService.createRequest(passenger1, {
        ride_id: testRideId,
        seat_count: 1,
      })
    ).rejects.toThrow(/blocking/i);
  });
});
