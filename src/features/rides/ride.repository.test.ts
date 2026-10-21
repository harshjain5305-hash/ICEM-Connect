import { describe, it, expect, beforeEach } from 'vitest';
import { rideRepository } from './ride.repository';

describe('Ride Repository & Relational Operations (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a published ride with default available_seats and automatic origin/destination waypoints', async () => {
    const hostId = 'student_host_01';
    const ride = await rideRepository.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-22',
      departure_time: '17:30',
      total_seats: 2,
      vehicle_type: 'SCOOTER',
      note: 'Heading home to Bhosari',
    });

    expect(ride.id).toBeDefined();
    expect(ride.host_id).toBe(hostId);
    expect(ride.status).toBe('PUBLISHED');
    expect(ride.total_seats).toBe(2);
    expect(ride.available_seats).toBe(2); // Invariant: available_seats initialized
    expect(ride.origin?.name).toContain('ICEM Main Campus');
    expect(ride.destination?.name).toContain('Bhosari');

    // Verify waypoints were created
    const waypoints = await rideRepository.getWaypointsForRide(ride.id);
    expect(waypoints.length).toBe(2);
    expect(waypoints[0].type).toBe('ORIGIN');
    expect(waypoints[0].sequence).toBe(1);
    expect(waypoints[1].type).toBe('DESTINATION');
    expect(waypoints[1].sequence).toBe(2);
  });

  it('adds intermediate waypoints with ordered sequences', async () => {
    const hostId = 'student_host_02';
    const ride = await rideRepository.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-23',
      departure_time: '18:00',
      total_seats: 1,
      vehicle_type: 'BIKE',
    });

    // Add intermediate waypoint at sequence 2 (e.g. Somatne Phata)
    const intermediateWp = await rideRepository.createWaypoint(ride.id, {
      sequence: 2,
      label: 'Somatne Phata',
      type: 'WAYPOINT',
      latitude: 18.7182,
      longitude: 73.6894,
      location_id: 'loc_somatne_phata',
    });

    expect(intermediateWp.sequence).toBe(2);
    expect(intermediateWp.label).toBe('Somatne Phata');

    const allWps = await rideRepository.getWaypointsForRide(ride.id);
    expect(allWps.length).toBeGreaterThanOrEqual(3);
  });

  it('creates and tracks join requests linked to the ride', async () => {
    const hostId = 'host_101';
    const passengerId = 'passenger_202';

    const ride = await rideRepository.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_talegaon_station',
      departure_date: '2026-10-24',
      departure_time: '16:45',
      total_seats: 1,
      vehicle_type: 'SCOOTER',
    });

    const waypoints = await rideRepository.getWaypointsForRide(ride.id);

    const joinReq = await rideRepository.createJoinRequest(passengerId, {
      ride_id: ride.id,
      pickup_waypoint_id: waypoints[0].id,
      drop_waypoint_id: waypoints[1].id,
      seat_count: 1,
      specific_area_note: 'Waiting near college gate bus stop',
    });

    expect(joinReq.id).toBeDefined();
    expect(joinReq.ride_id).toBe(ride.id);
    expect(joinReq.student_id).toBe(passengerId);
    expect(joinReq.status).toBe('PENDING');
    expect(joinReq.specific_area_note).toContain('college gate');

    const rideRequests = await rideRepository.getJoinRequestsForRide(ride.id);
    expect(rideRequests.length).toBe(1);
    expect(rideRequests[0].id).toBe(joinReq.id);
  });
});
