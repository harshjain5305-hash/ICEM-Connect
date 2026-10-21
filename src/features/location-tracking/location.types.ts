export type LocationSharingStatus =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'ACTIVE'
  | 'PAUSED'
  | 'PERMISSION_DENIED'
  | 'UNAVAILABLE'
  | 'ENDED'
  | 'ERROR';

export type LocationFreshness = 'FRESH' | 'STALE' | 'LOST';

export interface LiveLocationUpdate {
  ride_id: string;
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  heading: number | null; // degrees 0..360
  speed: number | null; // km/h or m/s
  timestamp: string; // ISO 8601
}

export interface GeolocationState {
  currentLocation: LiveLocationUpdate | null;
  status: LocationSharingStatus;
  freshness: LocationFreshness;
  errorMessage: string | null;
  lastUpdatedAt: string | null;
}

/**
 * Calculates freshness of a location signal according to Rules.md §17.
 * - FRESH: update received within 25 seconds
 * - STALE: between 25 and 60 seconds (warning)
 * - LOST: older than 60 seconds (offline signal alert)
 */
export function calculateLocationFreshness(timestampIso?: string | null): LocationFreshness {
  if (!timestampIso) return 'LOST';
  const ageMs = Date.now() - new Date(timestampIso).getTime();
  if (ageMs < 25_000) return 'FRESH';
  if (ageMs < 60_000) return 'STALE';
  return 'LOST';
}
