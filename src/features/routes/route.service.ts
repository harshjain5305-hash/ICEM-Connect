import { locationService } from '@/features/locations/location.service';
import type { Location } from '@/features/locations/location.schema';
import { defaultRouteProvider } from './route.provider';
import type {
  CalculatedRoute,
  CalculatedWaypoint,
  CoordinatePoint,
} from './route.types';
import { isPointAlongCorridor } from './polyline.utils';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { RideRoute, RideWaypoint } from '@/features/rides/ride.types';

const LOCAL_STORAGE_ROUTES_KEY = 'icem_connect_routes_db_v1';
const LOCAL_STORAGE_WAYPOINTS_KEY = 'icem_connect_waypoints_db_v1';

function getLocalData<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function saveLocalData<T>(key: string, data: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export const routeService = {
  /**
   * Scans registered PCMC locations and finds meaningful candidate waypoints
   * situated along the corridor between origin and destination.
   */
  async getCandidateWaypointsForCorridor(
    originLocationId: string,
    destinationLocationId: string
  ): Promise<Location[]> {
    const origin = await locationService.getById(originLocationId);
    const dest = await locationService.getById(destinationLocationId);

    if (!origin || !dest) return [];

    const allLocations = await locationService.getAll();
    const candidateNodes: { location: Location; projectionT: number }[] = [];

    for (const loc of allLocations) {
      // Exclude origin and destination themselves
      if (loc.id === origin.id || loc.id === dest.id) continue;

      const check = isPointAlongCorridor(
        { latitude: loc.latitude, longitude: loc.longitude },
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: dest.latitude, longitude: dest.longitude },
        4200 // Max 4.2 km corridor breadth
      );

      // Must lie strictly between origin and destination along the corridor axis
      if (check.inCorridor && check.projectionT > 0.02 && check.projectionT < 0.98) {
        candidateNodes.push({
          location: loc,
          projectionT: check.projectionT,
        });
      }
    }

    // Sort strictly by sequence along the route vector
    candidateNodes.sort((a, b) => a.projectionT - b.projectionT);
    return candidateNodes.map((item) => item.location);
  },

  /**
   * Calculates a complete directed route with ordered waypoints between two locations.
   */
  async calculateRouteForLocations(
    originLocationId: string,
    destinationLocationId: string,
    includedWaypointIds?: string[]
  ): Promise<CalculatedRoute> {
    const origin = await locationService.getById(originLocationId);
    const dest = await locationService.getById(destinationLocationId);

    if (!origin) {
      throw new Error(`Origin location '${originLocationId}' not found`);
    }
    if (!dest) {
      throw new Error(`Destination location '${destinationLocationId}' not found`);
    }
    if (origin.id === dest.id) {
      throw new Error('Origin and destination locations must be distinct');
    }

    let intermediateLocations: Location[] = [];

    if (includedWaypointIds && includedWaypointIds.length > 0) {
      for (const id of includedWaypointIds) {
        const loc = await locationService.getById(id);
        if (loc) intermediateLocations.push(loc);
      }
    } else {
      // Automatically discover natural corridor transit nodes
      intermediateLocations = await this.getCandidateWaypointsForCorridor(
        origin.id,
        dest.id
      );
    }

    const originPoint: CoordinatePoint = {
      latitude: origin.latitude,
      longitude: origin.longitude,
      label: origin.name,
      location_id: origin.id,
    };

    const destPoint: CoordinatePoint = {
      latitude: dest.latitude,
      longitude: dest.longitude,
      label: dest.name,
      location_id: dest.id,
    };

    const intermediatePoints: CoordinatePoint[] = intermediateLocations.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      label: loc.name,
      location_id: loc.id,
    }));

    return await defaultRouteProvider.calculateRoute(
      originPoint,
      destPoint,
      intermediatePoints
    );
  },

  /**
   * Saves calculated route and waypoints for a ride to database / storage.
   */
  async attachRouteToRide(
    rideId: string,
    route: CalculatedRoute
  ): Promise<{ route: RideRoute; waypoints: RideWaypoint[] }> {
    const isLive = isSupabaseConfigured();
    const now = new Date().toISOString();

    // 1. SAVE ROUTE
    let savedRoute: RideRoute;

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data: routeData, error: routeError } = await supabase
          .from('ride_routes')
          .upsert({
            ride_id: rideId,
            provider: route.provider,
            provider_route_id: route.provider_route_id || null,
            encoded_polyline: route.encoded_polyline,
            geometry_json: route.geometry_json as unknown as Record<string, unknown>,
            distance_meters: route.distance_meters,
            duration_seconds: route.duration_seconds,
            updated_at: now,
          })
          .select()
          .maybeSingle();

        if (routeError || !routeData) {
          throw new Error(routeError?.message || 'Failed to save ride route');
        }
        savedRoute = routeData as unknown as RideRoute;
      } catch (err) {
        console.warn('Live Supabase saveRoute error, fallback to local storage:', err);
        savedRoute = this.saveLocalRoute(rideId, route, now);
      }
    } else {
      savedRoute = this.saveLocalRoute(rideId, route, now);
    }

    // 2. SAVE WAYPOINTS
    const savedWaypoints: RideWaypoint[] = [];

    if (isLive && isValidUuid(rideId)) {
      try {
        // Delete any existing waypoints for this ride first
        await supabase.from('ride_waypoints').delete().eq('ride_id', rideId);

        const waypointInserts = route.waypoints.map((wp) => ({
          ride_id: rideId,
          sequence: wp.sequence,
          label: wp.label,
          type: wp.type,
          latitude: wp.latitude,
          longitude: wp.longitude,
          location_id: wp.location_id || null,
          distance_from_start_meters: wp.distance_from_start_meters,
        }));

        const { data: wpData, error: wpError } = await supabase
          .from('ride_waypoints')
          .insert(waypointInserts)
          .select();

        if (!wpError && wpData) {
          savedWaypoints.push(...(wpData as unknown as RideWaypoint[]));
        } else {
          throw new Error(wpError?.message);
        }
      } catch (err) {
        console.warn('Live Supabase saveWaypoints error, fallback to local storage:', err);
        savedWaypoints.push(...this.saveLocalWaypoints(rideId, route.waypoints));
      }
    } else {
      savedWaypoints.push(...this.saveLocalWaypoints(rideId, route.waypoints));
    }

    return { route: savedRoute, waypoints: savedWaypoints };
  },

  /**
   * Retrieves route record for a ride.
   */
  async getRouteForRide(rideId: string): Promise<RideRoute | null> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data } = await supabase
          .from('ride_routes')
          .select('*')
          .eq('ride_id', rideId)
          .maybeSingle();
        if (data) return data as unknown as RideRoute;
      } catch (err) {
        console.warn('Live Supabase getRouteForRide error:', err);
      }
    }

    const routes = getLocalData<RideRoute>(LOCAL_STORAGE_ROUTES_KEY);
    return routes[rideId] || null;
  },

  /**
   * Retrieves ordered waypoints for a ride.
   */
  async getWaypointsForRide(rideId: string): Promise<RideWaypoint[]> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data } = await supabase
          .from('ride_waypoints')
          .select('*')
          .eq('ride_id', rideId)
          .order('sequence', { ascending: true });
        if (data && data.length > 0) return data as unknown as RideWaypoint[];
      } catch (err) {
        console.warn('Live Supabase getWaypointsForRide error:', err);
      }
    }

    const waypoints = getLocalData<RideWaypoint>(LOCAL_STORAGE_WAYPOINTS_KEY);
    return Object.values(waypoints)
      .filter((wp) => wp.ride_id === rideId)
      .sort((a, b) => a.sequence - b.sequence);
  },

  saveLocalRoute(rideId: string, route: CalculatedRoute, now: string): RideRoute {
    const routes = getLocalData<RideRoute>(LOCAL_STORAGE_ROUTES_KEY);
    const newRoute: RideRoute = {
      id: `route_${rideId}`,
      ride_id: rideId,
      provider: route.provider,
      provider_route_id: route.provider_route_id || null,
      encoded_polyline: route.encoded_polyline,
      geometry_json: route.geometry_json,
      distance_meters: route.distance_meters,
      duration_seconds: route.duration_seconds,
      created_at: now,
      updated_at: now,
    };
    routes[rideId] = newRoute;
    saveLocalData(LOCAL_STORAGE_ROUTES_KEY, routes);
    return newRoute;
  },

  saveLocalWaypoints(rideId: string, waypoints: CalculatedWaypoint[]): RideWaypoint[] {
    const store = getLocalData<RideWaypoint>(LOCAL_STORAGE_WAYPOINTS_KEY);

    // Remove existing
    for (const key of Object.keys(store)) {
      if (store[key].ride_id === rideId) {
        delete store[key];
      }
    }

    const saved: RideWaypoint[] = [];
    for (const wp of waypoints) {
      const id = `wp_${rideId}_${wp.sequence}`;
      const record: RideWaypoint = {
        id,
        ride_id: rideId,
        sequence: wp.sequence,
        label: wp.label,
        type: wp.type,
        latitude: wp.latitude,
        longitude: wp.longitude,
        location_id: wp.location_id || null,
        distance_from_start_meters: wp.distance_from_start_meters,
        created_at: new Date().toISOString(),
      };
      store[id] = record;
      saved.push(record);
    }

    saveLocalData(LOCAL_STORAGE_WAYPOINTS_KEY, store);
    return saved;
  },
};
