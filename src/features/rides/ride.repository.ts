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
import { routeService } from '@/features/routes/route.service';
import { isValidUuid } from '@/lib/utils';
import { getLocalData, saveLocalData, STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_RIDES_KEY = STORAGE_KEYS.RIDES;
const LOCAL_STORAGE_WAYPOINTS_KEY = STORAGE_KEYS.WAYPOINTS;
const LOCAL_STORAGE_REQUESTS_KEY = STORAGE_KEYS.REQUESTS;
const LOCAL_STORAGE_PARTICIPANTS_KEY = STORAGE_KEYS.PARTICIPANTS;

async function hydrateLocations(ride: Ride): Promise<Ride> {
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

  let route = ride.route;
  if (!route) {
    route = await routeService.getRouteForRide(ride.id);
  }

  let waypoints = ride.waypoints;
  if (!waypoints || waypoints.length === 0) {
    waypoints = await routeService.getWaypointsForRide(ride.id);
  }

  return { ...ride, origin, destination, route, waypoints };
}

export const rideRepository = {
  /**
   * Creates a ride record with initial status ('DRAFT' or 'PUBLISHED').
   * Automatically calculates normalized corridor route and sequenced waypoints.
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

        const hydrated = await hydrateLocations(data as unknown as Ride);
        try {
          const calculated = await routeService.calculateRouteForLocations(
            input.origin_location_id,
            input.destination_location_id
          );
          const { route, waypoints } = await routeService.attachRouteToRide(hydrated.id, calculated);
          hydrated.route = route;
          hydrated.waypoints = waypoints;
        } catch (routeErr) {
          console.warn('Live route attachment warning:', routeErr);
        }
        return hydrated;
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

    // Automatically calculate and attach corridor route and sequenced waypoints
    try {
      const calculatedRoute = await routeService.calculateRouteForLocations(
        input.origin_location_id,
        input.destination_location_id
      );
      const { route, waypoints } = await routeService.attachRouteToRide(rideId, calculatedRoute);
      newRide.route = route;
      newRide.waypoints = waypoints;
    } catch (routeErr) {
      console.warn('Local route attachment warning:', routeErr);
    }

    return newRide;
  },

  /**
   * Fetches a ride by its ID with hydrated origin, destination, route, and waypoints.
   */
  async getRideById(rideId: string): Promise<Ride | null> {
    const dismissedRides = getLocalData<string>(STORAGE_KEYS.DISMISSED_RIDES);
    if (dismissedRides[rideId]) return null;

    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq('id', rideId)
          .maybeSingle();
        if (data && !data.deleted_at && !dismissedRides[data.id]) {
          return await hydrateLocations(data as unknown as Ride);
        }
      } catch (err) {
        console.warn('Live Supabase getRideById error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const ride = rides[rideId] || null;
    if (ride && (ride.deleted_at || dismissedRides[ride.id])) return null;
    return ride ? await hydrateLocations(ride) : null;
  },

  /**
   * Lists rides hosted by a specific student (excluding soft-deleted/dismissed rides).
   * Automatically executes 2-day auto-purge for rides dismissed more than 48 hours ago.
   */
  async listRidesByHost(hostId: string): Promise<Ride[]> {
    const isLive = isSupabaseConfigured();

    // Trigger auto-purge of rides soft-deleted > 2 days ago
    await this.purgeExpiredDismissedRides();

    const dismissedRides = getLocalData<string>(STORAGE_KEYS.DISMISSED_RIDES);

    if (isLive && isValidUuid(hostId)) {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .eq('host_id', hostId)
          .is('deleted_at', null)
          .order('departure_date', { ascending: false });

        if (!error && data) {
          const filteredLive = data.filter((r) => !dismissedRides[r.id]);
          return await Promise.all(filteredLive.map((r) => hydrateLocations(r as unknown as Ride)));
        }
      } catch (err) {
        console.warn('Live Supabase listRidesByHost error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    const hostRides = Object.values(rides).filter(
      (r) => r.host_id === hostId && !r.deleted_at && !dismissedRides[r.id]
    );
    const hydrated = await Promise.all(hostRides.map((r) => hydrateLocations(r)));
    return hydrated.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Permanently deletes a ride from the database and local storage.
   * Associated routes, waypoints, and join requests cascade delete.
   * Also ensures it is permanently removed from Home and Find Ride sections.
   * Live ACTIVE rides cannot be deleted.
   */
  async dismissRide(hostId: string, rideId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const isLive = isSupabaseConfigured();

    // Check if ride is currently LIVE ACTIVE
    const ride = await this.getRideById(rideId);
    if (ride && ride.status === 'ACTIVE') {
      throw new Error('Cannot delete an active live ride in progress. Complete or end the session first.');
    }

    // Persist to dismissed set (tombstone)
    const dismissedRides = getLocalData<string>(STORAGE_KEYS.DISMISSED_RIDES);
    dismissedRides[rideId] = nowIso;
    saveLocalData(STORAGE_KEYS.DISMISSED_RIDES, dismissedRides);

    if (isLive && isValidUuid(rideId)) {
      try {
        // Delete directly from Supabase database table 'rides'
        let query = supabase.from('rides').delete().eq('id', rideId);
        if (isValidUuid(hostId)) {
          query = query.eq('host_id', hostId);
        }
        const { error } = await query;
        if (error) {
          console.warn('Live Supabase delete ride error, applying fallback cancel:', error);
          let fallbackQuery = supabase
            .from('rides')
            .update({ status: 'CANCELLED', deleted_at: nowIso, updated_at: nowIso })
            .eq('id', rideId);
          if (isValidUuid(hostId)) {
            fallbackQuery = fallbackQuery.eq('host_id', hostId);
          }
          await fallbackQuery;
        }
      } catch (err) {
        console.warn('Live dismissRide error:', err);
      }
    }

    // Completely remove from local storage
    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    if (rides[rideId]) {
      delete rides[rideId];
      saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
    }

    // Clean up related join requests in local storage
    const requests = getLocalData<RideJoinRequest>(LOCAL_STORAGE_REQUESTS_KEY);
    let reqsModified = false;
    for (const key of Object.keys(requests)) {
      if (requests[key].ride_id === rideId) {
        delete requests[key];
        reqsModified = true;
      }
    }
    if (reqsModified) {
      saveLocalData(LOCAL_STORAGE_REQUESTS_KEY, requests);
    }

    // Dispatch custom browser event to immediately notify active views (Home, Find Ride, etc.)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ride:deleted', { detail: { rideId } }));
    }
  },

  /**
   * Permanently purges rides from storage/database that were soft-deleted > 2 days ago.
   */
  async purgeExpiredDismissedRides(): Promise<void> {
    const isLive = isSupabaseConfigured();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (isLive) {
      try {
        await supabase.rpc('cleanup_dismissed_rides_and_requests');
      } catch {
        // Handled defensively
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    let changed = false;
    for (const [id, r] of Object.entries(rides)) {
      if (r.deleted_at) {
        const deletedTime = new Date(r.deleted_at).getTime();
        if (now - deletedTime >= twoDaysMs) {
          delete rides[id];
          changed = true;
        }
      }
    }
    if (changed) {
      saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
    }
  },

  /**
   * Lists published and confirmed rides discoverable to passengers.
   */
  async listPublishedRides(date?: string): Promise<Ride[]> {
    const isLive = isSupabaseConfigured();
    const dismissedRides = getLocalData<string>(STORAGE_KEYS.DISMISSED_RIDES);

    if (isLive) {
      try {
        let query = supabase
          .from('rides')
          .select('*')
          .in('status', ['PUBLISHED', 'CONFIRMED'])
          .is('deleted_at', null);

        if (date) {
          query = query.eq('departure_date', date);
        }
        const { data, error } = await query.order('departure_date', { ascending: true });
        if (!error && data && data.length > 0) {
          const visible = data.filter((r) => !dismissedRides[r.id]);
          return await Promise.all(visible.map((r) => hydrateLocations(r as unknown as Ride)));
        }
      } catch (err) {
        console.warn('Live Supabase listPublishedRides error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);

    // Clean up any legacy seed rides or dismissed rides from local storage if present
    let hasLegacySeed = false;
    for (const id of Object.keys(rides)) {
      if (id.startsWith('seed_ride_') || dismissedRides[id]) {
        delete rides[id];
        hasLegacySeed = true;
      }
    }
    if (hasLegacySeed) {
      saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
    }

    const filtered = Object.values(rides)
      .filter((r) => {
        if (r.id.startsWith('seed_ride_')) return false;
        if (!['PUBLISHED', 'CONFIRMED'].includes(r.status)) return false;
        if (r.deleted_at) return false;
        if (dismissedRides[r.id]) return false;
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

    if (isLive && isValidUuid(rideId)) {
      try {
        const payload: Record<string, unknown> = { updated_at: now };
        if (updates.origin_location_id) payload.origin_location_id = updates.origin_location_id;
        if (updates.destination_location_id) payload.destination_location_id = updates.destination_location_id;
        if (updates.departure_date) payload.departure_date = updates.departure_date;
        if (updates.departure_time) payload.departure_time = updates.departure_time;
        if (updates.total_seats !== undefined) payload.total_seats = updates.total_seats;
        if (updates.available_seats !== undefined) {
          const maxSeats = updates.total_seats ?? (await this.getRideById(rideId))?.total_seats ?? 4;
          payload.available_seats = Math.max(0, Math.min(maxSeats, updates.available_seats));
        }
        if (updates.status) payload.status = updates.status;
        if (updates.vehicle_type) payload.vehicle_type = updates.vehicle_type;
        if (updates.note !== undefined) payload.note = updates.note;

        const { data, error } = await supabase
          .from('rides')
          .update(payload)
          .eq('id', rideId)
          .select()
          .maybeSingle();

        if (!error && data) {
          const hydrated = await hydrateLocations(data as unknown as Ride);
          const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
          rides[rideId] = hydrated;
          saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
          return hydrated;
        }
      } catch (err) {
        console.warn('Live Supabase updateRide error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    let existing: Ride | null | undefined = rides[rideId];
    if (!existing) {
      existing = await this.getRideById(rideId);
    }
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

    if (isLive && isValidUuid(rideId)) {
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
          .maybeSingle();

        if (!error && data) {
          const hydrated = await hydrateLocations(data as unknown as Ride);
          const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
          rides[rideId] = hydrated;
          saveLocalData(LOCAL_STORAGE_RIDES_KEY, rides);
          return hydrated;
        }
      } catch (err) {
        console.warn('Live Supabase updateRideStatus error:', err);
      }
    }

    const rides = getLocalData<Ride>(LOCAL_STORAGE_RIDES_KEY);
    let existing: Ride | null | undefined = rides[rideId];
    if (!existing) {
      existing = await this.getRideById(rideId);
    }
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

    if (isLive && isValidUuid(rideId)) {
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

    if (isLive && isValidUuid(rideId)) {
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
          .maybeSingle();

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

    if (isLive && isValidUuid(studentId) && isValidUuid(input.ride_id)) {
      try {
        const { data, error } = await supabase
          .from('ride_join_requests')
          .insert({
            ride_id: input.ride_id,
            student_id: studentId,
            pickup_waypoint_id: isValidUuid(input.pickup_waypoint_id) ? input.pickup_waypoint_id : null,
            drop_waypoint_id: isValidUuid(input.drop_waypoint_id) ? input.drop_waypoint_id : null,
            seat_count: input.seat_count,
            specific_area_note: input.specific_area_note || null,
            status: 'PENDING',
          })
          .select()
          .maybeSingle();

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
