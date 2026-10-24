import { calculateHaversineDistance, calculateBearing } from './polyline.utils';

export interface SnapToRoadOptions {
  /**
   * Maximum perpendicular distance (in meters) from a route segment within which
   * a coordinate will be snapped directly onto the road asphalt.
   * Default: 45 meters
   */
  maxSnapDistanceMeters?: number;
}

export interface SnapToRoadResult {
  /** Cleaned latitude (snapped to road if within threshold, or original if detour) */
  latitude: number;
  /** Cleaned longitude (snapped to road if within threshold, or original if detour) */
  longitude: number;
  /** Whether this coordinate was snapped to the route polyline */
  isSnapped: boolean;
  /** Perpendicular distance to the nearest road segment in meters */
  distanceToRoadMeters: number;
  /** Tangent bearing of the snapped road segment (0..360 degrees) */
  roadBearing: number | null;
  /** Index of the nearest polyline segment */
  segmentIndex: number | null;
}

/**
 * Snaps a GPS coordinate onto the nearest asphalt road segment of a route polyline.
 *
 * Prevents vehicle markers from wandering into parallel farmland or off-road fields
 * while preserving legitimate driver detours (e.g. petrol pump or highway rest stop).
 *
 * @param location Current vehicle coordinate [latitude, longitude]
 * @param routeCoordinates Decoded route corridor polyline coordinates [[lat, lng], ...]
 * @param options Snapping options
 */
export function snapCoordinateToRoute(
  location: { latitude: number; longitude: number },
  routeCoordinates: [number, number][],
  options: SnapToRoadOptions = {}
): SnapToRoadResult {
  const maxSnapDistance = options.maxSnapDistanceMeters ?? 45;

  if (!routeCoordinates || routeCoordinates.length === 0) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      isSnapped: false,
      distanceToRoadMeters: 0,
      roadBearing: null,
      segmentIndex: null,
    };
  }

  if (routeCoordinates.length === 1) {
    const single = routeCoordinates[0];
    const dist = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      single[0],
      single[1]
    );
    const snap = dist <= maxSnapDistance;
    return {
      latitude: snap ? single[0] : location.latitude,
      longitude: snap ? single[1] : location.longitude,
      isSnapped: snap,
      distanceToRoadMeters: dist,
      roadBearing: null,
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let bestPoint: [number, number] = [location.latitude, location.longitude];
  let bestBearing: number | null = null;
  let bestSegmentIndex: number | null = null;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const p1 = routeCoordinates[i];
    const p2 = routeCoordinates[i + 1];

    // Orthogonal projection with equirectangular longitude adjustment
    const latMidRad = ((p1[0] + p2[0]) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(latMidRad);

    const dx = (p2[1] - p1[1]) * cosLat;
    const dy = p2[0] - p1[0];
    const lenSq = dx * dx + dy * dy;

    let closestLat: number;
    let closestLng: number;

    if (lenSq === 0) {
      closestLat = p1[0];
      closestLng = p1[1];
    } else {
      const ux = (location.longitude - p1[1]) * cosLat;
      const uy = location.latitude - p1[0];

      // Scalar projection t clamped to [0, 1]
      const t = Math.max(0, Math.min(1, (ux * dx + uy * dy) / lenSq));

      closestLat = p1[0] + t * (p2[0] - p1[0]);
      closestLng = p1[1] + t * (p2[1] - p1[1]);
    }

    const dist = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      closestLat,
      closestLng
    );

    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = [closestLat, closestLng];
      bestBearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
      bestSegmentIndex = i;
    }
  }

  const isSnapped = minDistance <= maxSnapDistance;

  return {
    latitude: isSnapped ? Number(bestPoint[0].toFixed(6)) : location.latitude,
    longitude: isSnapped ? Number(bestPoint[1].toFixed(6)) : location.longitude,
    isSnapped,
    distanceToRoadMeters: Math.round(minDistance),
    roadBearing: bestBearing,
    segmentIndex: bestSegmentIndex,
  };
}
