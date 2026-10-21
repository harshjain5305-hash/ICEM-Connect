import { locationService } from '@/features/locations/location.service';
import { rideRepository } from '@/features/rides/ride.repository';
import type { RideWaypoint } from '@/features/rides/ride.types';
import type { Location } from '@/features/locations/location.schema';
import { rideSearchSchema } from './matching.schema';
import type {
  RideSearchQuery,
  RideSearchResult,
  MatchedRideCandidate,
  ScoreBreakdown,
} from './matching.types';
import { calculateHaversineDistance } from '@/features/routes/polyline.utils';

// Configurable matching tolerance (Architecture.md §9.4)
// Max lateral distance in meters for a passenger pickup/drop to snap to a route waypoint
export const ROUTE_MATCH_TOLERANCE_METERS = 3500;

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export const matchingService = {
  /**
   * Executes the deterministic two-stage route matching pipeline (Architecture.md §9).
   */
  async findCompatibleRides(rawSearch: unknown): Promise<RideSearchResult> {
    const parseResult = rideSearchSchema.safeParse(rawSearch);
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid search parameters');
    }

    const query: RideSearchQuery = parseResult.data;
    const flexibilityMinutes = query.flexibility_minutes ?? 30;
    const requestedSeats = query.requested_seats ?? 1;

    // 1. Resolve geographic pickup and drop locations
    const pickupLoc = await locationService.getById(query.pickup_location_id);
    const dropLoc = await locationService.getById(query.drop_location_id);

    if (!pickupLoc) {
      throw new Error(`Pickup location '${query.pickup_location_id}' not found`);
    }
    if (!dropLoc) {
      throw new Error(`Drop destination '${query.drop_location_id}' not found`);
    }

    // 2. STAGE 1: Fast filtering by date and eligible status
    const candidateRides = await rideRepository.listPublishedRides(query.departure_date);

    const matchedCandidates: MatchedRideCandidate[] = [];

    // 3. STAGE 2: Geometric corridor & route segment directionality matching
    for (const ride of candidateRides) {
      // Filter out host's own rides (host cannot join own ride as passenger)
      if (query.passenger_id && ride.host_id === query.passenger_id) {
        continue;
      }

      // Hard filter: sufficient available capacity
      if (ride.available_seats < requestedSeats) {
        continue;
      }

      // Hard filter: ride status must be open
      if (!['PUBLISHED', 'CONFIRMED'].includes(ride.status)) {
        continue;
      }

      // Fetch ordered waypoints for this ride
      const waypoints = await rideRepository.getWaypointsForRide(ride.id);
      if (!waypoints || waypoints.length < 2) {
        continue;
      }

      // A. Match passenger pickup to the best ride waypoint
      const pickupMatch = this.findBestWaypointMatch(pickupLoc, waypoints);
      if (!pickupMatch || pickupMatch.distanceMeters > ROUTE_MATCH_TOLERANCE_METERS) {
        continue;
      }

      // B. Match passenger drop to the best ride waypoint
      const dropMatch = this.findBestWaypointMatch(dropLoc, waypoints);
      if (!dropMatch || dropMatch.distanceMeters > ROUTE_MATCH_TOLERANCE_METERS) {
        continue;
      }

      // C. CRITICAL DIRECTIONALITY INVARIANT (Rules.md §5.4, PRD.md §8.2)
      // Pickup waypoint MUST occur strictly before drop waypoint along host's route!
      if (pickupMatch.waypoint.sequence >= dropMatch.waypoint.sequence) {
        continue;
      }

      // D. Time Compatibility (if departure_time was requested)
      let timeDiffMinutes = 0;
      if (query.departure_time) {
        const rideMinutes = parseTimeToMinutes(ride.departure_time);
        const searchMinutes = parseTimeToMinutes(query.departure_time);
        timeDiffMinutes = Math.abs(rideMinutes - searchMinutes);

        if (timeDiffMinutes > flexibilityMinutes) {
          continue;
        }
      }

      // E. Calculate deterministic 100-point compatibility score
      const scoreBreakdown = this.calculateDeterministicScore({
        pickupDistanceMeters: pickupMatch.distanceMeters,
        dropDistanceMeters: dropMatch.distanceMeters,
        isDirectPickup: pickupMatch.isDirectLocationIdMatch,
        isDirectDrop: dropMatch.isDirectLocationIdMatch,
        timeDiffMinutes,
        flexibilityMinutes,
        hasTimeFilter: Boolean(query.departure_time),
        availableSeats: ride.available_seats,
        requestedSeats,
      });

      const isDirectMatch =
        pickupMatch.isDirectLocationIdMatch && dropMatch.isDirectLocationIdMatch;

      matchedCandidates.push({
        ride,
        pickupWaypoint: pickupMatch.waypoint,
        dropWaypoint: dropMatch.waypoint,
        pickupDistanceMeters: pickupMatch.distanceMeters,
        dropDistanceMeters: dropMatch.distanceMeters,
        timeDifferenceMinutes: timeDiffMinutes,
        scoreBreakdown,
        matchScore: scoreBreakdown.totalScore,
        isDirectWaypointMatch: isDirectMatch,
        matchedSegmentLabel: `${pickupMatch.waypoint.label} → ${dropMatch.waypoint.label}`,
      });
    }

    // 4. Deterministic ranking: sort by total score descending
    matchedCandidates.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      // Tie breaker 1: smaller time difference
      if (a.timeDifferenceMinutes !== b.timeDifferenceMinutes) {
        return a.timeDifferenceMinutes - b.timeDifferenceMinutes;
      }
      // Tie breaker 2: more available seats
      return b.ride.available_seats - a.ride.available_seats;
    });

    return {
      query,
      pickupLocation: pickupLoc,
      dropLocation: dropLoc,
      candidates: matchedCandidates,
      totalCandidatesEvaluated: candidateRides.length,
      searchedAt: new Date().toISOString(),
    };
  },

  /**
   * Finds the best matching waypoint for a passenger transit point.
   */
  findBestWaypointMatch(
    location: Location,
    waypoints: RideWaypoint[]
  ): {
    waypoint: RideWaypoint;
    distanceMeters: number;
    isDirectLocationIdMatch: boolean;
  } | null {
    // 1. Direct location_id equality match
    const directMatch = waypoints.find((wp) => wp.location_id === location.id);
    if (directMatch) {
      return {
        waypoint: directMatch,
        distanceMeters: 0,
        isDirectLocationIdMatch: true,
      };
    }

    // 2. Spatial proximity match using Haversine distance
    let bestWp: RideWaypoint | null = null;
    let minDistance = Infinity;

    for (const wp of waypoints) {
      const dist = calculateHaversineDistance(
        location.latitude,
        location.longitude,
        wp.latitude,
        wp.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestWp = wp;
      }
    }

    if (!bestWp) return null;

    return {
      waypoint: bestWp,
      distanceMeters: minDistance,
      isDirectLocationIdMatch: false,
    };
  },

  /**
   * Deterministic V2 100-Point Scoring Formula (Architecture.md §9.6)
   *
   * 1. Route Alignment & Proximity: Max 40 points
   * 2. Departure Time Proximity:     Max 30 points
   * 3. Available Capacity Headroom: Max 15 points
   * 4. Host Reputation / Baseline:  Max 15 points
   */
  calculateDeterministicScore(params: {
    pickupDistanceMeters: number;
    dropDistanceMeters: number;
    isDirectPickup: boolean;
    isDirectDrop: boolean;
    timeDiffMinutes: number;
    flexibilityMinutes: number;
    hasTimeFilter: boolean;
    availableSeats: number;
    requestedSeats: number;
  }): ScoreBreakdown {
    // A. Route Alignment Score (0..40)
    let routeAlignmentScore = 40;
    if (!params.isDirectPickup) {
      const pickupPenalty = Math.min(15, (params.pickupDistanceMeters / ROUTE_MATCH_TOLERANCE_METERS) * 15);
      routeAlignmentScore -= pickupPenalty;
    }
    if (!params.isDirectDrop) {
      const dropPenalty = Math.min(15, (params.dropDistanceMeters / ROUTE_MATCH_TOLERANCE_METERS) * 15);
      routeAlignmentScore -= dropPenalty;
    }
    routeAlignmentScore = Math.max(10, Math.round(routeAlignmentScore));

    // B. Time Proximity Score (0..30)
    let timeProximityScore = 25; // default if no specific departure_time requested
    if (params.hasTimeFilter) {
      const maxFlex = Math.max(params.flexibilityMinutes, 15);
      const ratio = Math.min(1, params.timeDiffMinutes / maxFlex);
      timeProximityScore = Math.max(5, Math.round(30 * (1 - ratio)));
    }

    // C. Capacity Score (0..15)
    let capacityScore = 12;
    if (params.availableSeats > params.requestedSeats) {
      capacityScore = 15; // Generous seat buffer
    }

    // D. Reputation / Baseline Score (0..15)
    // Verified student default reputation baseline: 14/15
    const reputationScore = 14;

    const totalScore = Math.min(
      100,
      Math.max(0, routeAlignmentScore + timeProximityScore + capacityScore + reputationScore)
    );

    return {
      routeAlignmentScore,
      timeProximityScore,
      capacityScore,
      reputationScore,
      totalScore,
    };
  },
};
