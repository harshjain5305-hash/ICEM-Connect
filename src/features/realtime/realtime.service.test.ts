import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { realtimeService } from './realtime.service';
import { rideService } from '@/features/rides/ride.service';
import { requestService } from '@/features/requests/request.service';
import type { RealtimeRideEvent } from './realtime.types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: () => false,
}));

describe('Supabase Realtime Channel & Room Architecture (Phase 8)', () => {
  const hostId = 'student_host_realtime_1';
  const passengerId = 'student_passenger_realtime_2';
  const strangerId = 'student_unrelated_3';
  let rideId: string;

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
    rideId = ride.id;

    // Passenger requests and gets confirmed
    const req = await requestService.createRequest(passengerId, {
      ride_id: rideId,
      seat_count: 1,
    });
    await requestService.acceptRequest(hostId, req.id);
  });

  afterEach(() => {
    realtimeService.reset();
  });

  it('generates the canonical channel room name ride:{rideId} (Phases.md §12)', () => {
    const channelName = realtimeService.getChannelName(rideId);
    expect(channelName).toBe(`ride:${rideId}`);
  });

  it('authorizes host to enter the private ride room', async () => {
    const isAuthorized = await realtimeService.canAccessRideRoom(rideId, hostId);
    expect(isAuthorized).toBe(true);

    const subscription = await realtimeService.subscribeToRideRoom(
      rideId,
      hostId,
      'Host Student',
      'HOST'
    );
    expect(subscription).toBeDefined();
    expect(subscription.getConnectionState()).toBe('CONNECTED');
    subscription.unsubscribe();
  });

  it('authorizes confirmed passenger to enter the private ride room', async () => {
    const isAuthorized = await realtimeService.canAccessRideRoom(rideId, passengerId);
    expect(isAuthorized).toBe(true);

    const subscription = await realtimeService.subscribeToRideRoom(
      rideId,
      passengerId,
      'Confirmed Passenger',
      'PASSENGER'
    );
    expect(subscription).toBeDefined();
    expect(subscription.getConnectionState()).toBe('CONNECTED');
    subscription.unsubscribe();
  });

  it('strictly rejects unrelated students from entering the private ride room (Rules.md §14)', async () => {
    const isAuthorized = await realtimeService.canAccessRideRoom(rideId, strangerId);
    expect(isAuthorized).toBe(false);

    await expect(
      realtimeService.subscribeToRideRoom(
        rideId,
        strangerId,
        'Stranger Student',
        'PASSENGER'
      )
    ).rejects.toThrow(/Forbidden: User .* is not authorized to access ride room/i);
  });

  it('broadcasts lifecycle events between host and confirmed passengers in real time', async () => {
    const receivedHostEvents: RealtimeRideEvent[] = [];
    const receivedPassengerEvents: RealtimeRideEvent[] = [];

    // Host connects
    const hostSub = await realtimeService.subscribeToRideRoom(
      rideId,
      hostId,
      'Host Student',
      'HOST',
      {
        onEvent: (evt) => receivedHostEvents.push(evt),
      }
    );

    // Passenger connects
    const passengerSub = await realtimeService.subscribeToRideRoom(
      rideId,
      passengerId,
      'Passenger Student',
      'PASSENGER',
      {
        onEvent: (evt) => receivedPassengerEvents.push(evt),
      }
    );

    // Host broadcasts ride:session_started
    const startEvent: RealtimeRideEvent = {
      type: 'ride:session_started',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        session_id: 'session-xyz-123',
        host_id: hostId,
        started_at: new Date().toISOString(),
      },
    };

    await hostSub.broadcast(startEvent);

    expect(receivedPassengerEvents.length).toBe(1);
    expect(receivedPassengerEvents[0].type).toBe('ride:session_started');
    expect(receivedHostEvents.length).toBe(1);

    hostSub.unsubscribe();
    passengerSub.unsubscribe();
  });

  it('isolates broadcasts so rooms do not leak events to other rides', async () => {
    // Create Ride B
    const rideB = await rideService.createRide(hostId, {
      origin_location_id: 'loc_icem_campus',
      destination_location_id: 'loc_bhosari_stand',
      departure_date: '2026-10-31',
      departure_time: '19:00',
      total_seats: 1,
      vehicle_type: 'BIKE',
    });

    const receivedEventsRideA: RealtimeRideEvent[] = [];
    const receivedEventsRideB: RealtimeRideEvent[] = [];

    const subA = await realtimeService.subscribeToRideRoom(
      rideId,
      hostId,
      'Host',
      'HOST',
      { onEvent: (e) => receivedEventsRideA.push(e) }
    );

    const subB = await realtimeService.subscribeToRideRoom(
      rideB.id,
      hostId,
      'Host',
      'HOST',
      { onEvent: (e) => receivedEventsRideB.push(e) }
    );

    // Broadcast on Ride B
    await subB.broadcast({
      type: 'ride:status_changed',
      ride_id: rideB.id,
      timestamp: new Date().toISOString(),
      payload: {
        old_status: 'PUBLISHED',
        new_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      },
    });

    expect(receivedEventsRideB.length).toBe(1);
    expect(receivedEventsRideA.length).toBe(0); // Ride A must receive nothing

    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('tracks room presence synchronization between active peers', async () => {
    let presenceList: { user_id: string; role: string }[] = [];

    const hostSub = await realtimeService.subscribeToRideRoom(
      rideId,
      hostId,
      'Host Student',
      'HOST',
      {
        onPresenceSync: (users) => {
          presenceList = users;
        },
      }
    );

    expect(presenceList.length).toBe(1);
    expect(presenceList[0].user_id).toBe(hostId);
    expect(presenceList[0].role).toBe('HOST');

    const passSub = await realtimeService.subscribeToRideRoom(
      rideId,
      passengerId,
      'Passenger Student',
      'PASSENGER',
      {
        onPresenceSync: (users) => {
          presenceList = users;
        },
      }
    );

    expect(presenceList.length).toBe(2);
    expect(presenceList.some((u) => u.user_id === passengerId)).toBe(true);

    // When passenger leaves, presence updates
    passSub.unsubscribe();
    expect(presenceList.length).toBe(1);
    expect(presenceList[0].user_id).toBe(hostId);

    hostSub.unsubscribe();
  });
});
