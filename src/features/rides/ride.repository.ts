import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type {
  Ride,
  RideWaypoint,
  RideJoinRequest,
  RideParticipant,
} from './ride.types';
import type {
  CreateRideInput,
  CreateWaypointInput,
  CreateJoinRequestInput,
} from './ride.schema';
import { locationService } from '@/features/locations/location.service';

const LOCAL_STORAGE_RIDES_KEY = 'icem_connect_rides_db_v1';
const LOCAL_STORAGE_WAYPOINTS_KEY = 'icem_connect_waypoints_db_v1';
const LOCAL_STORAGE_REQUESTS_KEY = 'icem_connect_requests_db_v1';
const LOCAL_STORAGE_PARTICIPANTS_KEY = 'icem_connect_participants_db_v1';

function getLocalData<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalData<T>(key: string, data: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export const rideRepository = {
  /**
   * Creates a ride record. Available seats initialized to total_seats.
   */
  async createRide(hostId: string, input: CreateRideInput): Promise<Ride> {
    const isLive = isSupabaseConfigured();
    const availableSeats = input.available_seats ?? input.total_seats;

    if (isLive) {
      const { data, error } = await supabase
        .from('rides')
        .insert({
          host_id: hostId,
          origin_location_id: input.origin_location_id,
          destination_location_id: input.destination_location_id,
          departure_date: input.departure_date,
          departure_time: input.departure_time,
          total_seats: input.total_seats,
          available_seats: availableSeats,
          vehicle_type: input.vehicle_type,
          note: input.note || null,
          status: 'PUBLISHED',
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Failed to create ride');
      }
      return data as unknown as Ride;
    }

    // Local mode
    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const originLoc = await locationService.getById(input.origin_location_id);
    const destLoc = await locationService.getById(input.destination_location_id);

    const newRide: Ride = {
      id: rideId,
      host_id: hostId,
      origin_location_id: input.origin_location_id,
      destination_location_id: input.destination_location_id,
      origin: originLoc ? {
        id: originLoc.id,
        name: originLoc.name,
        type: originLoc.type,
        latitude: originLoc.latitude,
        longitude: originLoc.longitude,
        address: originLoc.address,
      } : undefined,
      destination: destLoc ? {
        id: destLoc.id,
        name: destLoc.name,
        type: destLoc.type,
        latitude: destLoc.latitude,
        longitude: destLoc.longitude,
        address: destLoc.address,
      } : undefined,
      departure_date: input.departure_date,
      departure_time: input.departure_time,
      total_seats: input.total_seats,
      available_seats: availableSeats,
      vehicle_type: input.vehicle_type,
      note: input.note || null,
      status: 'PUBLISHED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    };

    rides[rideId] = newRide;
    saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);

    // Automatically create initial origin & destination waypoints
    if (originLoc) {
      await this.createWaypoint(rideId, {
        sequence: 1,
        label: originLoc.name,
        type: 'ORIGIN',
        latitude: originLoc.latitude,
        longitude: originLoc.longitude,
        location_id: originLoc.id,
        distance_from_start_meters: 0,
      });
    }

    if (destLoc) {
      await this.createWaypoint(rideId, {
        sequence: 2,
        label: destLoc.name,
        type: 'DESTINATION',
        latitude: destLoc.latitude,
        longitude: destLoc.longitude,
        location_id: destLoc.id,
      });
    }

    return newRide;
  },

  /**
   * Fetches a ride by its ID.
   */
  async getRideById(rideId: string): Promise<Ride | null> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();
      return (data as unknown as Ride) || null;
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    return rides[rideId] || null;
  },

  /**
   * Lists published rides optionally filtered by date.
   */
  async listPublishedRides(date?: string): Promise<Ride[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      let query = supabase
        .from('rides')
        .select('*')
        .in('status', ['PUBLISHED', 'CONFIRMED']);

      if (date) {
        query = query.eq('departure_date', date);
      }
      const { data } = await query.order('departure_date', { ascending: true });
      return (data as unknown as Ride[]) || [];
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    return Object.values(rides)
      .filter((r) => {
        if (!['PUBLISHED', 'CONFIRMED'].includes(r.status)) return false;
        if (date && r.departure_date !== date) return false;
        return true;
      })
      .sort((a, b) => `${a.departure_date} ${a.departure_time}`.localeCompare(`${b.departure_date} ${b.departure_time}`));
  },

  /**
   * Creates an ordered waypoint for a ride.
   */
  async createWaypoint(rideId: string, input: CreateWaypointInput): Promise<RideWaypoint> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data, error } = await supabase
        .from('ride_waypoints')
        .insert({
          ride_id: rideId,
          sequence: input.sequence,
          label: input.label,
          type: input.type,
          latitude: input.latitude,
          longitude: input.longitude,
          location_id: input.location_id || null,
          distance_from_start_meters: input.distance_from_start_meters || null,
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Failed to create waypoint');
      return data as unknown as RideWaypoint;
    }

    const waypoints = getLocalData<RideWaypoint>(LOCAL_STORAGE_WAYPOINTS_KEY);
    const waypointId = `wp_${rideId}_${input.sequence}_${Math.random().toString(36).substring(2, 5)}`;
    const wp: RideWaypoint = {
      id: waypointId,
      ride_id: rideId,
      sequence: input.sequence,
      label: input.label,
      type: input.type,
      latitude: input.latitude,
      longitude: input.longitude,
      location_id: input.location_id || null,
      distance_from_start_meters: input.distance_from_start_meters || null,
      created_at: new Date().toISOString(),
    };

    waypoints[waypointId] = wp;
    saveLocalData(LOCAL_STORAGE_WAYPOINTS_KEY, waypoints);
    return wp;
  },

  /**
   * Retrieves ordered waypoints for a ride.
   */
  async getWaypointsForRide(rideId: string): Promise<RideWaypoint[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data } = await supabase
        .from('ride_waypoints')
        .select('*')
        .eq('ride_id', rideId)
        .order('sequence', { ascending: true });
      return (data as unknown as RideWaypoint[]) || [];
    }

    const waypoints = getLocalData<RideWaypoint>(LOCAL_STORAGE_WAYPOINTS_KEY);
    return Object.values(waypoints)
      .filter((wp) => wp.ride_id === rideId)
      .sort((a, b) => a.sequence - b.sequence);
  },

  /**
   * Creates a join request.
   */
  async createJoinRequest(studentId: string, input: CreateJoinRequestInput): Promise<RideJoinRequest> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data, error } = await supabase
        .from('ride_join_requests')
        .insert({
          ride_id: input.ride_id,
          student_id: studentId,
          pickup_waypoint_id: input.pickup_waypoint_id,
          drop_waypoint_id: input.drop_waypoint_id,
          seat_count: input.seat_count,
          specific_area_note: input.specific_area_note || null,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || 'Failed to create join request');
      return data as unknown as RideJoinRequest;
    }

    const requests = getLocalData<RideJoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReq: RideJoinRequest = {
      id: requestId,
      ride_id: input.ride_id,
      student_id: studentId,
      pickup_waypoint_id: input.pickup_waypoint_id,
      drop_waypoint_id: input.drop_waypoint_id,
      seat_count: input.seat_count,
      specific_area_note: input.specific_area_note || null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    requests[requestId] = newReq;
    saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
    return newReq;
  },

  /**
   * Retrieves all join requests for a given ride.
   */
  async getJoinRequestsForRide(rideId: string): Promise<RideJoinRequest[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data } = await supabase
        .from('ride_join_requests')
        .select('*')
        .eq('ride_id', rideId);
      return (data as unknown as RideJoinRequest[]) || [];
    }

    const requests = getLocalData<RideJoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    return Object.values(requests).filter((req) => req.ride_id === rideId);
  },

  /**
   * Retrieves confirmed participants for a ride.
   */
  async getParticipantsForRide(rideId: string): Promise<RideParticipant[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      const { data } = await supabase
        .from('ride_participants')
        .select('*')
        .eq('ride_id', rideId)
        .eq('status', 'CONFIRMED');
      return (data as unknown as RideParticipant[]) || [];
    }

    const participants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
    return Object.values(participants).filter(
      (p) => p.ride_id === rideId && p.status === 'CONFIRMED'
    );
  },
};
