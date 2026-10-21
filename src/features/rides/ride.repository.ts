import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type {
  Ride,
  RideWaypoint,
  RideJoinRequest,
  RideParticipant,
} from './ride.types';
import type {
  CreateRideInput,
  UpdateRideInput,
  CreateWaypointInput,
  CreateJoinRequestInput,
} from './ride.schema';
import type { RideStatus } from '@/types/database';
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

async function hydrateLocations(ride: Ride): Promise<Ride> {
  if (ride.origin && ride.destination) return ride;

  let origin = ride.origin;
  let destination = ride.destination;

  if (!origin && ride.origin_location_id) {
    const loc = await locationService.getById(ride.origin_location_id);
    if (loc) {
      origin = {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address,
      };
    }
  }

  if (!destination && ride.destination_location_id) {
    const loc = await locationService.getById(ride.destination_location_id);
    if (loc) {
      destination = {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address,
      };
    }
  }

  return { ...ride, origin, destination };
}

export const rideRepository = {
  /**
   * Creates a ride record with initial status ('DRAFT' or 'PUBLISHED').
   * Available seats initialized to total_seats.
   */
  async createRide(
    hostId: string,
    input: CreateRideInput,
    status: RideStatus = 'PUBLISHED'
  ): Promise<Ride> {
    const isLive = isSupabaseConfigured();
    const availableSeats = input.available_seats ?? input.total_seats;

    if (isLive) {
      try {
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
            status,
            published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Failed to create ride');
        }
        return await hydrateLocations(data as unknown as Ride);
      } catch (err) {
        console.warn('Live Supabase ride create error, falling back to local mode:', err);
      }
    }

    // Local mode
    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const originLoc = await locationService.getById(input.origin_location_id);
    const destLoc = await locationService.getById(input.destination_location_id);

    const now = new Date().toISOString();
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
      status,
      created_at: now,
      updated_at: now,
      published_at: status === 'PUBLISHED' ? now : null,
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
   * Fetches a ride by its ID with hydrated origin and destination.
   */
  async getRideById(rideId: string): Promise<Ride | null> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq('id', rideId)
          .single();
        if (data) {
          return await hydrateLocations(data as unknown as Ride);
        }
      } catch (err) {
        console.warn('Live Supabase getRideById error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const ride = rides[rideId] || null;
    return ride ? await hydrateLocations(ride) : null;
  },

  /**
   * Lists rides hosted by a specific student.
   */
  async listRidesByHost(hostId: string): Promise<Ride[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq('host_id', hostId)
          .order('departure_date', { ascending: false });

        if (data && data.length > 0) {
          return await Promise.all(data.map((r) => hydrateLocations(r as unknown as Ride)));
        }
      } catch (err) {
        console.warn('Live Supabase listRidesByHost error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const hostRides = Object.values(rides).filter((r) => r.host_id === hostId);
    const hydrated = await Promise.all(hostRides.map((r) => hydrateLocations(r)));
    return hydrated.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Lists published and confirmed rides discoverable to passengers.
   */
  async listPublishedRides(date?: string): Promise<Ride[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        let query = supabase
          .from('rides')
          .select('*')
          .in('status', ['PUBLISHED', 'CONFIRMED']);

        if (date) {
          query = query.eq('departure_date', date);
        }
        const { data } = await query.order('departure_date', { ascending: true });
        if (data && data.length > 0) {
          return await Promise.all(data.map((r) => hydrateLocations(r as unknown as Ride)));
        }
      } catch (err) {
        console.warn('Live Supabase listPublishedRides error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const filtered = Object.values(rides)
      .filter((r) => {
        if (!['PUBLISHED', 'CONFIRMED'].includes(r.status)) return false;
        if (date && r.departure_date !== date) return false;
        return true;
      })
      .sort((a, b) => `${a.departure_date} ${a.departure_time}`.localeCompare(`${b.departure_date} ${b.departure_time}`));

    return await Promise.all(filtered.map((r) => hydrateLocations(r)));
  },

  /**
   * Updates mutable fields of an editable ride.
   */
  async updateRide(rideId: string, updates: UpdateRideInput): Promise<Ride> {
    const isLive = isSupabaseConfigured();
    const now = new Date().toISOString();

    if (isLive) {
      try {
        const payload: Record<string, unknown> = { updated_at: now };
        if (updates.origin_location_id) payload.origin_location_id = updates.origin_location_id;
        if (updates.destination_location_id) payload.destination_location_id = updates.destination_location_id;
        if (updates.departure_date) payload.departure_date = updates.departure_date;
        if (updates.departure_time) payload.departure_time = updates.departure_time;
        if (updates.total_seats !== undefined) payload.total_seats = updates.total_seats;
        if (updates.vehicle_type) payload.vehicle_type = updates.vehicle_type;
        if (updates.note !== undefined) payload.note = updates.note;

        const { data, error } = await supabase
          .from('rides')
          .update(payload)
          .eq('id', rideId)
          .select()
          .single();

        if (error || !data) throw new Error(error?.message || 'Failed to update ride');
        return await hydrateLocations(data as unknown as Ride);
      } catch (err) {
        console.warn('Live Supabase updateRide error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const existing = rides[rideId];
    if (!existing) throw new Error('Ride not found');

    const updated: Ride = {
      ...existing,
      ...updates,
      updated_at: now,
    };

    rides[rideId] = updated;
    saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
    return await hydrateLocations(updated);
  },

  /**
   * Updates the status of a ride.
   */
  async updateRideStatus(rideId: string, newStatus: RideStatus): Promise<Ride> {
    const isLive = isSupabaseConfigured();
    const now = new Date().toISOString();

    if (isLive) {
      try {
        const payload: Record<string, unknown> = {
          status: newStatus,
          updated_at: now,
        };
        if (newStatus === 'PUBLISHED') {
          payload.published_at = now;
        }

        const { data, error } = await supabase
          .from('rides')
          .update(payload)
          .eq('id', rideId)
          .select()
          .single();

        if (error || !data) throw new Error(error?.message || 'Failed to update ride status');
        return await hydrateLocations(data as unknown as Ride);
      } catch (err) {
        console.warn('Live Supabase updateRideStatus error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const existing = rides[rideId];
    if (!existing) throw new Error('Ride not found');

    const updated: Ride = {
      ...existing,
      status: newStatus,
      updated_at: now,
      published_at: newStatus === 'PUBLISHED' && !existing.published_at ? now : existing.published_at,
    };

    rides[rideId] = updated;
    saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
    return await hydrateLocations(updated);
  },

  /**
   * Deletes a ride only if it is in DRAFT status.
   */
  async deleteDraftRide(rideId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { error } = await supabase
          .from('rides')
          .delete()
          .eq('id', rideId)
          .eq('status', 'DRAFT');
        if (!error) return true;
      } catch (err) {
        console.warn('Live Supabase deleteDraftRide error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    if (rides[rideId] && rides[rideId].status === 'DRAFT') {
      delete rides[rideId];
      saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
      return true;
    }
    return false;
  },

  /**
   * Creates an ordered waypoint for a ride.
   */
  async createWaypoint(rideId: string, input: CreateWaypointInput): Promise<RideWaypoint> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
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

        if (!error && data) return data as unknown as RideWaypoint;
      } catch (err) {
        console.warn('Live Supabase createWaypoint error:', err);
      }
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
      try {
        const { data } = await supabase
          .from('ride_waypoints')
          .select('*')
          .eq('ride_id', rideId)
          .order('sequence', { ascending: true });
        if (data) return data as unknown as RideWaypoint[];
      } catch (err) {
        console.warn('Live Supabase getWaypointsForRide error:', err);
      }
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
      try {
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

        if (!error && data) return data as unknown as RideJoinRequest;
      } catch (err) {
        console.warn('Live Supabase createJoinRequest error:', err);
      }
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
      try {
        const { data } = await supabase
          .from('ride_join_requests')
          .select('*')
          .eq('ride_id', rideId);
        if (data) return data as unknown as RideJoinRequest[];
      } catch (err) {
        console.warn('Live Supabase getJoinRequestsForRide error:', err);
      }
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
      try {
        const { data } = await supabase
          .from('ride_participants')
          .select('*')
          .eq('ride_id', rideId)
          .eq('status', 'CONFIRMED');
        if (data) return data as unknown as RideParticipant[];
      } catch (err) {
        console.warn('Live Supabase getParticipantsForRide error:', err);
      }
    }

    const participants = getLocalData<RideParticipant>(LOCAL_STORAGE_PARTICIPANTS_KEY);
    return Object.values(participants).filter(
      (p) => p.ride_id === rideId && p.status === 'CONFIRMED'
    );
  },
};
