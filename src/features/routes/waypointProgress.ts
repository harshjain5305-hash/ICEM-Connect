import { calculateHaversineDistance } from './polyline.utils';

export interface WaypointLike {
  id?: string;
  sequence: number;
  latitude: number;
  longitude: number;
  label: string;
  type?: 'ORIGIN' | 'WAYPOINT' | 'DESTINATION' | string;
  distance_from_start_meters?: number | null;
  ride_id?: string;
  created_at?: string;
}

export interface WaypointProgressResult {
  /** Set of sequence numbers of waypoints that have been passed */
  passedSequences: Set<number>;
  /** The sequence number of the next upcoming waypoint (currently en route to), or null if all passed */
  activeSequence: number | null;
  /** Percentage of route waypoints completed (0 to 100) */
  progressPercentage: number;
  /** Count of waypoints passed */
  passedCount: number;
  /** Total count of waypoints */
  totalCount: number;
}

/**
 * Finds the index of the closest polyline point to a given coordinate.
 */
export function findClosestPolylineIndex(
  target: [number, number],
  coordinates: [number, number][]
): number {
  if (coordinates.length === 0) return -1;
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const dist = calculateHaversineDistance(
      target[0],
      target[1],
      coordinates[i][0],
      coordinates[i][1]
    );
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Evaluates which waypoints have been passed by the rider during an active trip.
 *
 * Rules:
 * 1. If ride is COMPLETED, 100% of waypoints are passed.
 * 2. If ride is ACTIVE and liveLocation is available:
 *    a) Proximity: Any waypoint within 250m is passed.
 *    b) Polyline progression: If the rider's polyline projection index is >= waypoint's polyline index,
 *       the rider has reached or traveled past that waypoint.
 *    c) Monotonic sequence propagation: If waypoint K is passed, all waypoints 1..K-1 are also passed.
 *    d) Origin is passed as soon as rider departs (> 100m away or any waypoint passed).
 * 3. Incorporates previously passed sequences to guarantee monotonic forward progression (no flickering).
 */
export function calculateWaypointProgress(params: {
  waypoints: WaypointLike[];
  coordinates?: [number, number][];
  currentLocation?: { latitude: number; longitude: number } | null;
  isRideActive: boolean;
  isRideCompleted: boolean;
  previouslyPassedSequences?: Set<number> | number[];
}): WaypointProgressResult {
  const {
    waypoints,
    coordinates = [],
    currentLocation,
    isRideActive,
    isRideCompleted,
    previouslyPassedSequences,
  } = params;

  if (!waypoints || waypoints.length === 0) {
    return {
      passedSequences: new Set(),
      activeSequence: null,
      progressPercentage: 0,
      passedCount: 0,
      totalCount: 0,
    };
  }

  // Sort waypoints ascending by sequence
  const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);
  const totalCount = sorted.length;
  const passedSequences = new Set<number>(
    previouslyPassedSequences ? Array.from(previouslyPassedSequences) : []
  );

  // Case 1: Trip is completed
  if (isRideCompleted) {
    for (const wp of sorted) {
      passedSequences.add(wp.sequence);
    }
    return {
      passedSequences,
      activeSequence: null,
      progressPercentage: 100,
      passedCount: totalCount,
      totalCount,
    };
  }

  // Case 2: Not active yet or no location signal
  if (!isRideActive || !currentLocation) {
    // If we have previously passed sequences preserved, keep them
    const passedCount = passedSequences.size;
    const progressPercentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
    const activeSequence = sorted.find((w) => !passedSequences.has(w.sequence))?.sequence ?? null;

    return {
      passedSequences,
      activeSequence,
      progressPercentage,
      passedCount,
      totalCount,
    };
  }

  const { latitude: currLat, longitude: currLng } = currentLocation;

  // Pre-calculate polyline index for current location if coordinates exist
  const hasPolyline = coordinates.length >= 2;
  const currPolyIndex = hasPolyline
    ? findClosestPolylineIndex([currLat, currLng], coordinates)
    : -1;

  // Waypoint polyline indices
  const wpIndices: Record<number, number> = {};
  if (hasPolyline) {
    for (const wp of sorted) {
      wpIndices[wp.sequence] = findClosestPolylineIndex(
        [wp.latitude, wp.longitude],
        coordinates
      );
    }
  }

  let highestPassedSequence = 0;

  // Find newly passed waypoints
  for (let i = 0; i < sorted.length; i++) {
    const wp = sorted[i];
    const isOrigin = wp.type === 'ORIGIN' || (!wp.type && i === 0);
    const isDest = wp.type === 'DESTINATION' || (!wp.type && i === sorted.length - 1);

    const distToWp = calculateHaversineDistance(
      currLat,
      currLng,
      wp.latitude,
      wp.longitude
    );

    let isPassed = passedSequences.has(wp.sequence);

    if (!isPassed) {
      if (isOrigin) {
        // Origin is passed if rider is > 100m away or polyline index has advanced
        if (distToWp > 100 || (hasPolyline && currPolyIndex > (wpIndices[wp.sequence] ?? 0) + 1)) {
          isPassed = true;
        }
      } else if (isDest) {
        // Destination is passed if within 150m or rider reached the final polyline point
        if (distToWp <= 150 || (hasPolyline && currPolyIndex === coordinates.length - 1)) {
          isPassed = true;
        }
      } else {
        // Intermediate waypoint: passed if within 250m or polyline progression has passed it
        if (distToWp <= 250) {
          isPassed = true;
        } else if (hasPolyline && wpIndices[wp.sequence] !== undefined) {
          const wpIdx = wpIndices[wp.sequence];
          // Rider has progressed past this waypoint along the polyline
          if (currPolyIndex >= wpIdx) {
            isPassed = true;
          }
        }
      }
    }

    if (isPassed) {
      passedSequences.add(wp.sequence);
      if (wp.sequence > highestPassedSequence) {
        highestPassedSequence = wp.sequence;
      }
    }
  }

  // Monotonic sequence propagation: all waypoints prior to highestPassedSequence are also passed
  if (highestPassedSequence > 0) {
    for (const wp of sorted) {
      if (wp.sequence <= highestPassedSequence) {
        passedSequences.add(wp.sequence);
      }
    }
  }

  // Identify next upcoming active waypoint
  const activeWp = sorted.find((w) => !passedSequences.has(w.sequence));
  const activeSequence = activeWp ? activeWp.sequence : null;

  const passedCount = passedSequences.size;
  const progressPercentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return {
    passedSequences,
    activeSequence,
    progressPercentage,
    passedCount,
    totalCount,
  };
}
