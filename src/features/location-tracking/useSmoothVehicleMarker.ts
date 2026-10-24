import { useState, useEffect, useRef } from 'react';
import type { LiveLocationUpdate } from './location.types';
import { snapCoordinateToRoute } from '@/features/routes/snapToRoad';

export type TrackingMovementMode =
  | 'IDLE'
  | 'INTERPOLATING'
  | 'DEAD_RECKONING'
  | 'RECONNECTING';

export interface SmoothVehicleMarkerOptions {
  /** Expected interval between regular GPS broadcasts (ms). Default: 3500 */
  expectedIntervalMs?: number;
  /** Silence threshold after which dead reckoning is engaged (ms). Default: 4000 */
  deadReckoningSilenceMs?: number;
  /** Max duration to dead-reckon before waiting for true signal (ms). Default: 25000 */
  maxDeadReckoningDurationMs?: number;
  /** Snapping distance buffer to road (meters). Default: 45 */
  maxSnapDistanceMeters?: number;
}

export interface SmoothVehicleMarkerState {
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number;
  movementMode: TrackingMovementMode;
  isSnappedToRoad: boolean;
  secondsSinceLastUpdate: number;
}

/**
 * Calculates the shortest-arc angular interpolation between two bearings (0..360 degrees).
 * Prevents erratic 350-degree spinning when crossing the 0/360 boundary.
 */
export function interpolateShortestAngle(current: number, target: number, t: number): number {
  const diff = ((target - current + 540) % 360) - 180;
  const angle = (current + diff * t) % 360;
  return angle < 0 ? angle + 360 : angle;
}

/**
 * Smooth cubic easing out: quick response with gentle arrival.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 60fps Vehicle Movement Smoothing Hook with LERP, Shortest-Arc Rotation & Dead Reckoning.
 *
 * Consumes periodic throttled GPS updates and drives a fluid, continuous requestAnimationFrame
 * animation loop so vehicle markers glide along roads rather than teleporting every 3-5 seconds.
 */
export function useSmoothVehicleMarker(
  incomingLocation: LiveLocationUpdate | null,
  routeCoordinates: [number, number][],
  isRideActive: boolean,
  options: SmoothVehicleMarkerOptions = {}
): SmoothVehicleMarkerState {
  const expectedIntervalMs = options.expectedIntervalMs ?? 3500;
  const deadReckoningSilenceMs = options.deadReckoningSilenceMs ?? 4000;
  const maxDeadReckoningDurationMs = options.maxDeadReckoningDurationMs ?? 25000;
  const maxSnapDistanceMeters = options.maxSnapDistanceMeters ?? 45;

  const initialSnap = incomingLocation
    ? snapCoordinateToRoute(
        { latitude: incomingLocation.latitude, longitude: incomingLocation.longitude },
        routeCoordinates,
        { maxSnapDistanceMeters }
      )
    : null;

  const [state, setState] = useState<SmoothVehicleMarkerState>({
    latitude: initialSnap ? initialSnap.latitude : null,
    longitude: initialSnap ? initialSnap.longitude : null,
    heading: incomingLocation?.heading ?? initialSnap?.roadBearing ?? null,
    speed: incomingLocation?.speed ?? null,
    accuracy: incomingLocation?.accuracy ?? 15,
    movementMode: incomingLocation ? 'INTERPOLATING' : 'IDLE',
    isSnappedToRoad: initialSnap?.isSnapped ?? false,
    secondsSinceLastUpdate: 0,
  });

  // Animation frame references
  const animFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());

  // Kinematic state
  const currentPosRef = useRef<{ lat: number; lng: number; heading: number }>({
    lat: initialSnap?.latitude ?? incomingLocation?.latitude ?? 0,
    lng: initialSnap?.longitude ?? incomingLocation?.longitude ?? 0,
    heading: incomingLocation?.heading ?? initialSnap?.roadBearing ?? 0,
  });

  const startPosRef = useRef<{ lat: number; lng: number; heading: number }>({
    lat: initialSnap?.latitude ?? incomingLocation?.latitude ?? 0,
    lng: initialSnap?.longitude ?? incomingLocation?.longitude ?? 0,
    heading: incomingLocation?.heading ?? initialSnap?.roadBearing ?? 0,
  });

  const targetPosRef = useRef<{ lat: number; lng: number; heading: number }>({
    lat: initialSnap?.latitude ?? incomingLocation?.latitude ?? 0,
    lng: initialSnap?.longitude ?? incomingLocation?.longitude ?? 0,
    heading: incomingLocation?.heading ?? initialSnap?.roadBearing ?? 0,
  });

  const animStartTimeRef = useRef<number>(performance.now());
  const animDurationRef = useRef<number>(expectedIntervalMs);
  const lastTrueUpdateMsRef = useRef<number>(Date.now());
  const movementModeRef = useRef<TrackingMovementMode>('IDLE');
  const speedRef = useRef<number>(incomingLocation?.speed ?? 0);
  const isSnappedRef = useRef<boolean>(false);
  const accuracyRef = useRef<number>(incomingLocation?.accuracy ?? 15);

  // 1. Process new incoming GPS updates
  useEffect(() => {
    if (!incomingLocation) return;

    // Apply snap-to-road to incoming coordinate
    const snap = snapCoordinateToRoute(
      { latitude: incomingLocation.latitude, longitude: incomingLocation.longitude },
      routeCoordinates,
      { maxSnapDistanceMeters }
    );

    const resolvedHeading =
      incomingLocation.heading !== null && incomingLocation.heading !== undefined
        ? incomingLocation.heading
        : snap.roadBearing ?? currentPosRef.current.heading;

    const previousMode = movementModeRef.current;
    const now = performance.now();

    // Reconnecting from Dead Reckoning? Soft-blend smoothly to true GPS point over 1500ms
    if (previousMode === 'DEAD_RECKONING') {
      movementModeRef.current = 'RECONNECTING';
      animDurationRef.current = 1500;
    } else {
      movementModeRef.current = 'INTERPOLATING';
      animDurationRef.current = expectedIntervalMs;
    }

    startPosRef.current = { ...currentPosRef.current };
    targetPosRef.current = {
      lat: snap.latitude,
      lng: snap.longitude,
      heading: resolvedHeading,
    };

    animStartTimeRef.current = now;
    lastTrueUpdateMsRef.current = Date.now();
    speedRef.current = incomingLocation.speed ?? speedRef.current;
    isSnappedRef.current = snap.isSnapped;
    accuracyRef.current = incomingLocation.accuracy;
  }, [
    incomingLocation?.timestamp,
    incomingLocation?.latitude,
    incomingLocation?.longitude,
    incomingLocation?.heading,
    incomingLocation?.speed,
    routeCoordinates,
    expectedIntervalMs,
    maxSnapDistanceMeters,
  ]);

  // 2. 60fps Animation Loop
  useEffect(() => {
    if (!isRideActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let isMounted = true;

    const loop = (now: number) => {
      if (!isMounted) return;

      const deltaSeconds = Math.max(0.001, Math.min(0.1, (now - lastFrameTimeRef.current) / 1000));
      lastFrameTimeRef.current = now;

      const msSinceTrueUpdate = Date.now() - lastTrueUpdateMsRef.current;
      const secondsSinceUpdate = Math.floor(msSinceTrueUpdate / 1000);

      // Check if dead reckoning should engage
      if (
        msSinceTrueUpdate > deadReckoningSilenceMs &&
        msSinceTrueUpdate < maxDeadReckoningDurationMs &&
        speedRef.current > 5
      ) {
        movementModeRef.current = 'DEAD_RECKONING';

        // Kinematic dead reckoning forward along heading
        const speedMps = speedRef.current / 3.6;
        const forwardDistanceMeters = speedMps * deltaSeconds;

        const headingRad = (currentPosRef.current.heading * Math.PI) / 180;
        const latRad = (currentPosRef.current.lat * Math.PI) / 180;

        const deltaLat = (forwardDistanceMeters * Math.cos(headingRad)) / 111139;
        const deltaLng = (forwardDistanceMeters * Math.sin(headingRad)) / (111139 * Math.cos(latRad));

        const deadLat = currentPosRef.current.lat + deltaLat;
        const deadLng = currentPosRef.current.lng + deltaLng;

        // Keep dead-reckoned position snapped forward along road curve
        const deadSnap = snapCoordinateToRoute(
          { latitude: deadLat, longitude: deadLng },
          routeCoordinates,
          { maxSnapDistanceMeters }
        );

        currentPosRef.current = {
          lat: deadSnap.latitude,
          lng: deadSnap.longitude,
          heading: deadSnap.roadBearing ?? currentPosRef.current.heading,
        };
        isSnappedRef.current = deadSnap.isSnapped;
      } else if (movementModeRef.current === 'INTERPOLATING' || movementModeRef.current === 'RECONNECTING') {
        // LERP towards targetPos
        const elapsed = now - animStartTimeRef.current;
        const rawT = Math.min(1, Math.max(0, elapsed / animDurationRef.current));
        const easedT = easeOutCubic(rawT);

        const newLat =
          startPosRef.current.lat + (targetPosRef.current.lat - startPosRef.current.lat) * easedT;
        const newLng =
          startPosRef.current.lng + (targetPosRef.current.lng - startPosRef.current.lng) * easedT;
        const newHeading = interpolateShortestAngle(
          startPosRef.current.heading,
          targetPosRef.current.heading,
          easedT
        );

        currentPosRef.current = {
          lat: newLat,
          lng: newLng,
          heading: newHeading,
        };

        if (rawT >= 1 && movementModeRef.current === 'RECONNECTING') {
          movementModeRef.current = 'INTERPOLATING';
        }
      }

      setState({
        latitude: currentPosRef.current.lat || null,
        longitude: currentPosRef.current.lng || null,
        heading: Math.round(currentPosRef.current.heading),
        speed: speedRef.current,
        accuracy: accuracyRef.current,
        movementMode: movementModeRef.current,
        isSnappedToRoad: isSnappedRef.current,
        secondsSinceLastUpdate: secondsSinceUpdate,
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    isRideActive,
    routeCoordinates,
    deadReckoningSilenceMs,
    maxDeadReckoningDurationMs,
    maxSnapDistanceMeters,
  ]);

  return state;
}
