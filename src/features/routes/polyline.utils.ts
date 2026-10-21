/**
 * Standard Google / OSRM Polyline Algorithm (lossless coordinate compression)
 * and Geodesic math for the ICEM Connect campus network.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Great Circle distance between two points using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Calculates initial compass bearing from point 1 to point 2 in degrees (0..360).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Encodes an array of [latitude, longitude] pairs into a standard polyline string.
 * Precision: 1e5 (standard).
 */
export function encodePolyline(coordinates: [number, number][]): string {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coordinates) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);

    const dLat = latE5 - prevLat;
    const dLng = lngE5 - prevLng;

    prevLat = latE5;
    prevLng = lngE5;

    output += encodeSignedNumber(dLat);
    output += encodeSignedNumber(dLng);
  }

  return output;
}

/**
 * Decodes a standard polyline string into an array of [latitude, longitude] coordinates.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num < 0 ? ~(num << 1) : num << 1;
  let output = '';

  while (sgnNum >= 0x20) {
    output += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  output += String.fromCharCode(sgnNum + 63);
  return output;
}

/**
 * Checks if a candidate location lies along the travel corridor between origin and destination.
 * Uses vector projection scalar t in [0, 1] and perpendicular distance tolerance.
 *
 * @param candidate Location to evaluate
 * @param origin Start of the journey
 * @param dest End of the journey
 * @param maxPerpendicularDistanceMeters Buffer width perpendicular to the direct vector (default: 4500m)
 */
export function isPointAlongCorridor(
  candidate: LatLng,
  origin: LatLng,
  dest: LatLng,
  maxPerpendicularDistanceMeters: number = 4500
): { inCorridor: boolean; projectionT: number; perpendicularDistanceMeters: number } {
  // Vector A (Origin -> Destination)
  const dLat = dest.latitude - origin.latitude;
  const dLng = dest.longitude - origin.longitude;
  const lenSq = dLat * dLat + dLng * dLng;

  if (lenSq === 0) {
    return { inCorridor: false, projectionT: 0, perpendicularDistanceMeters: 0 };
  }

  // Vector P (Origin -> Candidate)
  const pLat = candidate.latitude - origin.latitude;
  const pLng = candidate.longitude - origin.longitude;

  // Projection scalar t: t = (P · A) / |A|²
  const t = (pLat * dLat + pLng * dLng) / lenSq;

  // Must lie between origin and destination along the axis (with small epsilon allowance)
  if (t < -0.05 || t > 1.05) {
    return { inCorridor: false, projectionT: t, perpendicularDistanceMeters: Infinity };
  }

  // Closest point on line segment
  const clampedT = Math.max(0, Math.min(1, t));
  const closestLat = origin.latitude + clampedT * dLat;
  const closestLng = origin.longitude + clampedT * dLng;

  const perpDistance = calculateHaversineDistance(
    candidate.latitude,
    candidate.longitude,
    closestLat,
    closestLng
  );

  return {
    inCorridor: perpDistance <= maxPerpendicularDistanceMeters,
    projectionT: t,
    perpendicularDistanceMeters: perpDistance,
  };
}
