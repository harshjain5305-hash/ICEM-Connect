import type {
  CoordinatePoint,
  CalculatedRoute,
  CalculatedWaypoint,
  RouteProvider,
} from './route.types';
import {
  calculateHaversineDistance,
  encodePolyline,
} from './polyline.utils';

// Average campus commute speed in PCMC traffic: ~36 km/h = 10 m/s
const AVERAGE_SPEED_METERS_PER_SEC = 10;
// Standard Old Pune-Mumbai Highway / Talegaon-Pimpri road winding factor
const ROAD_DETOUR_FACTOR = 1.25;

export class InternalCorridorRouteProvider implements RouteProvider {
  readonly name = 'icem-internal-routing-engine';

  /**
   * Calculates a realistic normalized route between origin and destination,
   * incorporating any selected intermediate transit waypoints.
   */
  async calculateRoute(
    origin: CoordinatePoint,
    destination: CoordinatePoint,
    selectedIntermediateWaypoints: CoordinatePoint[] = []
  ): Promise<CalculatedRoute> {
    if (!origin || !destination) {
      throw new Error('Both origin and destination are required for route calculation');
    }

    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    ) {
      throw new Error('Origin and destination coordinates cannot be identical');
    }

    // Try live OSRM first if available
    try {
      const osrmResult = await this.tryFetchOSRM(origin, destination, selectedIntermediateWaypoints);
      if (osrmResult) {
        return osrmResult;
      }
    } catch {
      // Graceful fallback to deterministic internal geometry engine
    }

    return this.calculateInternalGeometry(origin, destination, selectedIntermediateWaypoints);
  }

  /**
   * Deterministic internal route calculation.
   * Works completely offline with 0 dependencies.
   */
  private calculateInternalGeometry(
    origin: CoordinatePoint,
    destination: CoordinatePoint,
    intermediatePoints: CoordinatePoint[]
  ): CalculatedRoute {
    // 1. Sort intermediate points by proximity from origin along the route
    const sortedIntermediates = [...intermediatePoints].sort((a, b) => {
      const distA = calculateHaversineDistance(origin.latitude, origin.longitude, a.latitude, a.longitude);
      const distB = calculateHaversineDistance(origin.latitude, origin.longitude, b.latitude, b.longitude);
      return distA - distB;
    });

    // 2. Build full sequence of points
    const fullSequence: CoordinatePoint[] = [origin, ...sortedIntermediates, destination];

    let totalDirectMeters = 0;
    const waypoints: CalculatedWaypoint[] = [];
    const geometryCoordinates: [number, number][] = []; // [lng, lat]
    const polylineCoords: [number, number][] = []; // [lat, lng]

    // 3. Process segments
    for (let i = 0; i < fullSequence.length; i++) {
      const current = fullSequence[i];
      const isOrigin = i === 0;
      const isDestination = i === fullSequence.length - 1;

      if (!isOrigin) {
        const prev = fullSequence[i - 1];
        const segDist = calculateHaversineDistance(
          prev.latitude,
          prev.longitude,
          current.latitude,
          current.longitude
        );
        totalDirectMeters += segDist;

        // Generate smooth intermediate road vertices between milestones
        const steps = Math.max(2, Math.min(8, Math.round(segDist / 1200)));
        for (let s = 1; s < steps; s++) {
          const ratio = s / steps;
          // Apply slight natural road curve
          const lat = prev.latitude + ratio * (current.latitude - prev.latitude);
          const lng = prev.longitude + ratio * (current.longitude - prev.longitude);
          geometryCoordinates.push([lng, lat]);
          polylineCoords.push([lat, lng]);
        }
      }

      const currentDistanceMeters = Math.round(totalDirectMeters * ROAD_DETOUR_FACTOR);
      const estimatedSeconds = Math.round(currentDistanceMeters / AVERAGE_SPEED_METERS_PER_SEC);

      waypoints.push({
        sequence: i + 1,
        label: current.label || (isOrigin ? 'Origin' : isDestination ? 'Destination' : `Stop ${i}`),
        type: isOrigin ? 'ORIGIN' : isDestination ? 'DESTINATION' : 'WAYPOINT',
        latitude: current.latitude,
        longitude: current.longitude,
        location_id: current.location_id || null,
        distance_from_start_meters: currentDistanceMeters,
        estimated_time_offset_seconds: estimatedSeconds,
      });

      geometryCoordinates.push([current.longitude, current.latitude]);
      polylineCoords.push([current.latitude, current.longitude]);
    }

    const totalDistanceMeters = Math.round(totalDirectMeters * ROAD_DETOUR_FACTOR);
    // Add 180 seconds baseline traffic buffer for stops / intersection signals
    const totalDurationSeconds = Math.round(totalDistanceMeters / AVERAGE_SPEED_METERS_PER_SEC) + 180;

    const encodedPolyline = encodePolyline(polylineCoords);

    return {
      provider: this.name,
      provider_route_id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      distance_meters: totalDistanceMeters,
      duration_seconds: totalDurationSeconds,
      encoded_polyline: encodedPolyline,
      geometry_json: {
        type: 'LineString',
        coordinates: geometryCoordinates,
      },
      waypoints,
    };
  }

  /**
   * Optional live OSRM public routing lookup with strict timeout.
   */
  private async tryFetchOSRM(
    origin: CoordinatePoint,
    destination: CoordinatePoint,
    intermediatePoints: CoordinatePoint[]
  ): Promise<CalculatedRoute | null> {
    // Only attempt live API in browser environment with network access
    if (typeof fetch === 'undefined') return null;

    const fullPoints = [origin, ...intermediatePoints, destination];
    const coordsQuery = fullPoints
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const json = await res.json();
      if (!json.routes || json.routes.length === 0) return null;

      const primary = json.routes[0];
      const coords: [number, number][] = primary.geometry.coordinates; // [lng, lat]
      const polyCoords: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);

      // Build waypoints with estimated milestones
      let accumulatedDistance = 0;
      const waypoints: CalculatedWaypoint[] = [];

      for (let i = 0; i < fullPoints.length; i++) {
        const pt = fullPoints[i];
        const isOrigin = i === 0;
        const isDestination = i === fullPoints.length - 1;

        if (!isOrigin) {
          const prev = fullPoints[i - 1];
          accumulatedDistance += calculateHaversineDistance(
            prev.latitude,
            prev.longitude,
            pt.latitude,
            pt.longitude
          ) * ROAD_DETOUR_FACTOR;
        }

        waypoints.push({
          sequence: i + 1,
          label: pt.label || (isOrigin ? 'Origin' : isDestination ? 'Destination' : `Stop ${i}`),
          type: isOrigin ? 'ORIGIN' : isDestination ? 'DESTINATION' : 'WAYPOINT',
          latitude: pt.latitude,
          longitude: pt.longitude,
          location_id: pt.location_id || null,
          distance_from_start_meters: Math.round(accumulatedDistance),
          estimated_time_offset_seconds: Math.round(accumulatedDistance / AVERAGE_SPEED_METERS_PER_SEC),
        });
      }

      return {
        provider: 'osrm-car',
        provider_route_id: `osrm_${Date.now()}`,
        distance_meters: Math.round(primary.distance),
        duration_seconds: Math.round(primary.duration),
        encoded_polyline: encodePolyline(polyCoords),
        geometry_json: {
          type: 'LineString',
          coordinates: coords,
        },
        waypoints,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const defaultRouteProvider = new InternalCorridorRouteProvider();
