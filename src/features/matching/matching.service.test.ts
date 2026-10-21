import { describe, it, expect, beforeEach } from 'vitest';
import { matchingService } from './matching.service';
import { rideService } from '@/features/rides/ride.service';

describe('Deterministic Route-Segment Matching Engine (Phase 5)', () => {
  const hostId = 'student_host_404';
  const passengerId = 'student_passenger_505';

  const departureDate = '2026-10-25';

  beforeEach(() => {
    localStorage.clear();
  });

  // Helper to create the canonical ICEM -> Bhosari host ride
  async function setupHostRide(override = {}) {
    return await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Leaving ICEM gate right after lab',
      ...override,
    });
  }

  it('matches full route: ICEM Campus -> Bhosari Bus Stand', async () => {
    await setupHostRide();

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:30',
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(1);
    const match = result.candidates[0];
    expect(match.matchScore).toBeGreaterThanOrEqual(90);
    expect(match.isDirectWaypointMatch).toBe(true);
    expect(match.pickupWaypoint.sequence).toBe(1);
    expect(match.dropWaypoint.sequence).toBeGreaterThan(1);
  });

  it('matches intermediate segment: Somatne Phata -> Bhosari (Phase 5 Core Value)', async () => {
    await setupHostRide();

    // Passenger only needs Somatne -> Bhosari
    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_somatne_phata',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:35',
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(1);
    const match = result.candidates[0];
    expect(match.pickupWaypoint.label).toContain('Somatne');
    expect(match.dropWaypoint.label).toContain('Bhosari');
    expect(match.pickupWaypoint.sequence).toBeLessThan(match.dropWaypoint.sequence);
    expect(match.matchScore).toBeGreaterThanOrEqual(80);
  });

  it('matches middle segment: Somatne Phata -> Pimpri Chowk', async () => {
    await setupHostRide();

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_somatne_phata',
      drop_location_id: 'loc_pimpri_chowk',
      departure_date: departureDate,
      departure_time: '17:30',
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(1);
    const match = result.candidates[0];
    expect(match.pickupWaypoint.sequence).toBeLessThan(match.dropWaypoint.sequence);
  });

  it('REJECTS reverse route: Bhosari -> Somatne Phata (Directionality Invariant)', async () => {
    await setupHostRide();

    // Host is travelling ICEM -> Bhosari.
    // Passenger travelling Bhosari -> Somatne is travelling in the OPPOSITE direction!
    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_bhosari_stand',
      drop_location_id: 'loc_somatne_phata',
      departure_date: departureDate,
      departure_time: '17:30',
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(0);
  });

  it('rejects candidates on mismatched departure dates', async () => {
    await setupHostRide();

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-26', // Tomorrow
      departure_time: '17:30',
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(0);
  });

  it('rejects candidate when requested seats exceed available seats', async () => {
    await setupHostRide({ total_seats: 1 }); // only 1 seat offered

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      requested_seats: 2, // passenger needs 2 seats
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(0);
  });

  it('rejects candidate when departure time is outside flexibility window', async () => {
    await setupHostRide({ departure_time: '17:00' });

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '19:00', // 120 mins difference
      flexibility_minutes: 30, // only allows +/- 30m
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(0);
  });

  it('excludes host from matching their own ride', async () => {
    await setupHostRide();

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      passenger_id: hostId, // searching as the host
    });

    expect(result.candidates.length).toBe(0);
  });

  it('ranks higher for closer departure times and exact waypoint matches', async () => {
    // Ride A: departs at 17:30 (exact time match)
    await rideService.createRide('host_a', {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
    });

    // Ride B: departs at 17:55 (25 mins offset)
    await rideService.createRide('host_b', {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:55',
      total_seats: 2,
      vehicle_type: 'BIKE',
    });

    const result = await matchingService.findCompatibleRides({
      pickup_location_id: 'loc_icem_campus',
      drop_location_id: 'loc_bhosari_stand',
      departure_date: departureDate,
      departure_time: '17:30',
      flexibility_minutes: 30,
      passenger_id: passengerId,
    });

    expect(result.candidates.length).toBe(2);
    // Ride A must be ranked #1
    expect(result.candidates[0].ride.host_id).toBe('host_a');
    expect(result.candidates[0].matchScore).toBeGreaterThan(result.candidates[1].matchScore);
  });
});
