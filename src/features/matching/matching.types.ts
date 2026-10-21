import type { Ride, RideWaypoint } from '@/features/rides/ride.types';
import type { Location } from '@/features/locations/location.schema';

export interface RideSearchQuery {
  pickup_location_id: string;
  drop_location_id: string;
  departure_date: string; // YYYY-MM-DD
  departure_time?: string | null; // HH:MM
  flexibility_minutes?: number; // 15, 30, 45, 60
  requested_seats?: number; // default: 1
  passenger_id?: string | null; // used to exclude host's own rides
}

export interface ScoreBreakdown {
  routeAlignmentScore: number; // max 40
  timeProximityScore: number; // max 30
  capacityScore: number; // max 15
  reputationScore: number; // max 15
  totalScore: number; // 0..100
}

export interface MatchedRideCandidate {
  ride: Ride;
  pickupWaypoint: RideWaypoint;
  dropWaypoint: RideWaypoint;
  pickupDistanceMeters: number;
  dropDistanceMeters: number;
  timeDifferenceMinutes: number;
  scoreBreakdown: ScoreBreakdown;
  matchScore: number; // 0..100
  isDirectWaypointMatch: boolean;
  matchedSegmentLabel: string;
}

export interface RideSearchResult {
  query: RideSearchQuery;
  pickupLocation: Location;
  dropLocation: Location;
  candidates: MatchedRideCandidate[];
  totalCandidatesEvaluated: number;
  searchedAt: string;
}
