import { describe, it, expect, beforeEach } from 'vitest';
import { ratingService } from './rating.service';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from '@/features/requests/request.service';
import { authService } from '@/features/auth/auth.service';
import { notificationService } from '@/features/notifications/notification.service';

describe('Rating & Reputation Service (Phase 7)', () => {
  const hostId = 'student_host_rating_1';
  const passengerId = 'student_passenger_rating_1';
  const outsiderId = 'student_outsider_1';

  let testRideId: string;

  beforeEach(async () => {
    localStorage.clear();

    // Register host and passenger profiles
    await authService.register({
      name: 'Host Student',
      email: 'host.student@indiraicem.ac.in',
      prn: 'PRN1111111111',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      department: 'Computer Science',
      year: 3,
    });

    await authService.register({
      name: 'Passenger Student',
      email: 'passenger.student@indiraicem.ac.in',
      prn: 'PRN2222222222',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      department: 'Mechanical',
      year: 2,
    });

    // Create a ride
    const ride = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-26',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
    });
    testRideId = ride.id;

    // Passenger requests and host accepts
    const req = await requestService.createRequest(passengerId, {
      ride_id: testRideId,
      seat_count: 1,
    });
    await requestService.acceptRequest(hostId, req.id);
  });

  it('rejects rating if the ride is not in COMPLETED status (Rules.md §22)', async () => {
    // Ride is currently PUBLISHED / CONFIRMED
    await expect(
      ratingService.submitRating(passengerId, {
        ride_id: testRideId,
        reviewee_id: hostId,
        score: 5,
        feedback: 'Great ride!',
      })
    ).rejects.toThrow(/Ratings can only be submitted after the ride is COMPLETED/i);
  });

  it('allows confirmed passenger to rate host once the ride is COMPLETED', async () => {
    // Complete the ride
    await rideService.startRide(hostId, testRideId);
    await rideService.completeRide(hostId, testRideId);

    const result = await ratingService.submitRating(passengerId, {
      ride_id: testRideId,
      reviewee_id: hostId,
      score: 5,
      feedback: 'Very punctual and polite riding.',
    });

    expect(result.success).toBe(true);
    expect(result.rating_id).toBeDefined();

    // Host should have received in-app notification
    const hostNotifs = await notificationService.getUserNotifications(hostId);
    expect(hostNotifs.some((n) => n.type === 'RATING_RECEIVED')).toBe(true);
  });

  it('prevents self-rating (ck_no_self_rating)', async () => {
    await rideService.startRide(hostId, testRideId);
    await rideService.completeRide(hostId, testRideId);

    await expect(
      ratingService.submitRating(hostId, {
        ride_id: testRideId,
        reviewee_id: hostId,
        score: 5,
      })
    ).rejects.toThrow(/Self-rating is strictly prohibited/i);
  });

  it('prevents duplicate ratings from the same reviewer for the same ride (uq_ride_rating)', async () => {
    await rideService.startRide(hostId, testRideId);
    await rideService.completeRide(hostId, testRideId);

    await ratingService.submitRating(passengerId, {
      ride_id: testRideId,
      reviewee_id: hostId,
      score: 4,
    });

    await expect(
      ratingService.submitRating(passengerId, {
        ride_id: testRideId,
        reviewee_id: hostId,
        score: 5,
      })
    ).rejects.toThrow(/already rated this user/i);
  });

  it('rejects ratings from non-participants who were not on the ride', async () => {
    await rideService.startRide(hostId, testRideId);
    await rideService.completeRide(hostId, testRideId);

    await expect(
      ratingService.submitRating(outsiderId, {
        ride_id: testRideId,
        reviewee_id: hostId,
        score: 5,
      })
    ).rejects.toThrow(/only confirmed participants and host of this ride may rate/i);
  });

  it('allows host to rate confirmed passenger', async () => {
    await rideService.startRide(hostId, testRideId);
    await rideService.completeRide(hostId, testRideId);

    const result = await ratingService.submitRating(hostId, {
      ride_id: testRideId,
      reviewee_id: passengerId,
      score: 5,
      feedback: 'Wait at gate was zero seconds. Perfect passenger.',
    });

    expect(result.success).toBe(true);
    expect(result.new_average).toBeGreaterThanOrEqual(1);

    const passengerNotifs = await notificationService.getUserNotifications(passengerId);
    expect(passengerNotifs.some((n) => n.type === 'RATING_RECEIVED')).toBe(true);
  });
});
