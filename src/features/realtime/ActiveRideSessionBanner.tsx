import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Users,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  Map,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FastForward,
  Check,
  Milestone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useRideRoom } from './useRideRoom';
import { useGeolocationWatcher } from '@/features/location-tracking/useGeolocationWatcher';
import { LiveRideTrackingMap } from '@/features/location-tracking/LiveRideTrackingMap';
import { RiderGpsStatusCard } from '@/features/location-tracking/RiderGpsStatusCard';
import { RideCoordinationChat } from '@/features/rides/RideCoordinationChat';
import { liveLocationService } from '@/features/location-tracking/liveLocation.service';
import { decodePolyline, calculateBearing } from '@/features/routes/polyline.utils';
import { calculateWaypointProgress, type WaypointLike } from '@/features/routes/waypointProgress';
import type { LiveLocationUpdate } from '@/features/location-tracking/location.types';
import type { Ride } from '@/features/rides/ride.types';
import type { StudentProfile } from '@/features/auth/auth.types';

interface ActiveRideSessionBannerProps {
  ride: Ride;
  currentUser: StudentProfile | null;
  onStatusChanged?: (newStatus: string) => void;
  onRateHost?: () => void;
}

export const ActiveRideSessionBanner: React.FC<ActiveRideSessionBannerProps> = ({
  ride,
  currentUser,
  onStatusChanged,
  onRateHost,
}) => {
  const isHost = Boolean(currentUser && currentUser.id === ride.host_id);
  const [liveLocation, setLiveLocation] = useState<LiveLocationUpdate | null>(null);
  const [showLiveMap, setShowLiveMap] = useState<boolean>(true);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const simIndexRef = useRef<number>(0);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    connectionState,
    activeSession,
    presenceUsers,
    isStarting,
    isEnding,
    startSession,
    endSession,
    error,
  } = useRideRoom({
    rideId: ride.id,
    user: currentUser,
    isHost,
    onEvent: (event) => {
      if (event.type === 'ride:status_changed') {
        onStatusChanged?.(event.payload.new_status);
      }
      if (event.type === 'location:update') {
        setLiveLocation({
          ride_id: event.payload.rideId,
          latitude: event.payload.latitude,
          longitude: event.payload.longitude,
          accuracy: event.payload.accuracyMeters,
          heading: event.payload.heading,
          speed: event.payload.speed,
          timestamp: event.payload.timestamp,
        });
      }
    },
  });

  const [confirmComplete, setConfirmComplete] = useState(false);
  const isRideActive = ride.status === 'ACTIVE' || activeSession?.status === 'ACTIVE';

  // PASSENGER INITIAL HYDRATION & ACTIVE POLL
  useEffect(() => {
    if (isHost || !ride.id || !currentUser) return;

    let isMounted = true;
    const fetchLatest = async () => {
      try {
        const latest = await liveLocationService.getLatestLocation(ride.id, currentUser.id);
        if (latest && isMounted) {
          setLiveLocation(latest);
        }
      } catch {
        // Handled silently
      }
    };

    fetchLatest();

    // Fallback polling for live tracking when ride is in progress
    let interval: NodeJS.Timeout | null = null;
    if (isRideActive) {
      interval = setInterval(fetchLatest, 3500);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [ride.id, currentUser, isHost, isRideActive]);

  // Host GPS location watcher
  const {
    currentLocation: hostGeoLocation,
    status: geoStatus,
    freshness: geoFreshness,
    permissionState: geoPermissionState,
    isGpsTurnedOff,
    requestPermission: requestGpsPermission,
    retryLocation: retryGpsLocation,
  } = useGeolocationWatcher({
    rideId: ride.id,
    hostId: currentUser?.id || '',
    isActive: isRideActive && isHost && !isSimulating,
    enabled: isHost && !isSimulating,
  });

  // Effective location: If simulating, use simulated location state; otherwise host geo or passenger realtime
  const effectiveLocation = isHost ? (isSimulating ? liveLocation : hostGeoLocation) : liveLocation;

  // ROUTE DRIVE SIMULATION TOOL (Allows desk testing without driving)
  const routeCoordinates: [number, number][] = React.useMemo(() => {
    if (ride.route?.encoded_polyline) {
      return decodePolyline(ride.route.encoded_polyline);
    }
    if (ride.route?.geometry_json && 'coordinates' in ride.route.geometry_json) {
      const geoCoords = ride.route.geometry_json.coordinates as [number, number][];
      return geoCoords.map(([lng, lat]) => [lat, lng]);
    }
    const pts: [number, number][] = [];
    if (ride.origin) pts.push([ride.origin.latitude, ride.origin.longitude]);
    if (ride.waypoints) {
      for (const wp of ride.waypoints) pts.push([wp.latitude, wp.longitude]);
    }
    if (ride.destination) pts.push([ride.destination.latitude, ride.destination.longitude]);
    return pts;
  }, [ride]);

  // Waypoints progress tracking for live trip
  const bannerWaypoints: WaypointLike[] = React.useMemo(() => {
    if (ride.waypoints && ride.waypoints.length > 0) {
      return [...ride.waypoints].sort((a, b) => a.sequence - b.sequence);
    }
    const fallback: WaypointLike[] = [];
    if (ride.origin) {
      fallback.push({
        id: 'orig',
        ride_id: ride.id,
        sequence: 1,
        latitude: ride.origin.latitude,
        longitude: ride.origin.longitude,
        label: ride.origin.name,
        type: 'ORIGIN' as const,
        distance_from_start_meters: 0,
      });
    }
    if (ride.destination) {
      fallback.push({
        id: 'dest',
        ride_id: ride.id,
        sequence: 2,
        latitude: ride.destination.latitude,
        longitude: ride.destination.longitude,
        label: ride.destination.name,
        type: 'DESTINATION' as const,
        distance_from_start_meters: null,
      });
    }
    return fallback;
  }, [ride]);

  const [persistentPassedSequences, setPersistentPassedSequences] = useState<Set<number>>(new Set());

  const waypointProgress = React.useMemo(() => {
    return calculateWaypointProgress({
      waypoints: bannerWaypoints,
      coordinates: routeCoordinates,
      currentLocation: effectiveLocation,
      isRideActive,
      isRideCompleted: ride.status === 'COMPLETED',
      previouslyPassedSequences: persistentPassedSequences,
    });
  }, [bannerWaypoints, routeCoordinates, effectiveLocation, isRideActive, ride.status, persistentPassedSequences]);

  useEffect(() => {
    if (waypointProgress.passedSequences.size > persistentPassedSequences.size) {
      setPersistentPassedSequences(new Set(waypointProgress.passedSequences));
    }
  }, [waypointProgress.passedSequences, persistentPassedSequences.size]);

  const stopSimulation = useCallback(() => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  const startSimulation = useCallback(() => {
    if (!currentUser || routeCoordinates.length < 2) return;
    stopSimulation();
    setIsSimulating(true);
    simIndexRef.current = 0;

    const step = async () => {
      if (simIndexRef.current >= routeCoordinates.length) {
        stopSimulation();
        return;
      }

      const idx = simIndexRef.current;
      const curr = routeCoordinates[idx];
      const next = routeCoordinates[Math.min(idx + 1, routeCoordinates.length - 1)];

      const heading = calculateBearing(curr[0], curr[1], next[0], next[1]);
      const update: LiveLocationUpdate = {
        ride_id: ride.id,
        latitude: curr[0],
        longitude: curr[1],
        accuracy: 8,
        heading: Math.round(heading),
        speed: 36, // km/h
        timestamp: new Date().toISOString(),
      };

      setLiveLocation(update);
      try {
        await liveLocationService.publishLocation(currentUser.id, update, true);
      } catch (err) {
        console.warn('Simulation publish error:', err);
      }

      simIndexRef.current += 1;
    };

    step();
    simTimerRef.current = setInterval(step, 1300);
  }, [currentUser, routeCoordinates, ride.id, stopSimulation]);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  const handleStart = async () => {
    try {
      await startSession();
      onStatusChanged?.('ACTIVE');
    } catch {
      // handled in hook
    }
  };

  const handleComplete = async () => {
    try {
      stopSimulation();
      await endSession();
      setConfirmComplete(false);
      onStatusChanged?.('COMPLETED');
    } catch {
      // handled in hook
    }
  };

  const handleManualRefresh = async () => {
    if (!ride.id || !currentUser) return;
    try {
      const latest = await liveLocationService.getLatestLocation(ride.id, currentUser.id);
      if (latest) {
        setLiveLocation(latest);
      }
    } catch (err) {
      console.warn('Manual refresh error:', err);
    }
  };

  // Status indicator config
  const connectionBadge = (() => {
    switch (connectionState) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Room Connected
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            Connecting to Realtime...
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Connection Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Room Inactive
          </span>
        );
    }
  })();

  const canCoordinateChat = currentUser && (isRideActive || ['PUBLISHED', 'CONFIRMED'].includes(ride.status));

  return (
    <div
      className={`rounded-xl border p-4 mb-4 transition-all duration-300 ${
        isRideActive
          ? 'bg-gradient-to-r from-emerald-900/10 via-teal-900/5 to-transparent border-emerald-500/40 shadow-sm'
          : 'bg-slate-50/80 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Status & Channel Room Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Radio className={`w-3.5 h-3.5 ${isRideActive ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
              Ride Room: <code className="font-mono text-slate-600 dark:text-slate-400">ride:{ride.id.slice(0, 8)}</code>
            </div>
            {connectionBadge}
            {isRideActive && (
              <Badge variant="success" className="animate-pulse">
                Trip in Progress
              </Badge>
            )}
            {isSimulating && (
              <Badge variant="warning" className="animate-pulse bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300">
                Simulating Drive (36 km/h)
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isRideActive
              ? activeSession?.started_at
                ? `Journey commenced at ${new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Active trip session in progress across campus corridor'
              : ride.status === 'COMPLETED'
              ? 'This trip has safely concluded'
              : 'Trip is scheduled. Coordination chat and presence are active.'}
          </p>
        </div>

        {/* Right Side: Host Action Controls & View Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Host Start & Complete Controls */}
          {isHost && (
            <>
              {['PUBLISHED', 'CONFIRMED'].includes(ride.status) && !isRideActive && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleStart}
                  isLoading={isStarting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                  Start Journey
                </Button>
              )}

              {isRideActive && (
                <>
                  {!confirmComplete ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmComplete(true)}
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
                    >
                      <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      Complete Journey
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 p-1 rounded-lg border border-red-200 dark:border-red-800">
                      <span className="text-xs text-red-700 dark:text-red-300 font-medium px-1">Arrived?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleComplete}
                        isLoading={isEnding}
                        className="h-7 text-xs px-2.5"
                      >
                        Yes, Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmComplete(false)}
                        className="h-7 text-xs px-2 text-slate-500"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Route Drive Simulation Tool for Host Desk Testing */}
                  <Button
                    size="sm"
                    variant={isSimulating ? 'secondary' : 'outline'}
                    onClick={isSimulating ? stopSimulation : startSimulation}
                    className="h-8 text-xs gap-1 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                    title={isSimulating ? 'Stop travel simulation' : 'Simulate vehicle moving along route'}
                  >
                    <FastForward className={`w-3.5 h-3.5 ${isSimulating ? 'animate-pulse text-cyan-600' : ''}`} />
                    <span>{isSimulating ? 'Stop Sim' : 'Simulate Drive'}</span>
                  </Button>
                </>
              )}
            </>
          )}

          {/* Rate Host when completed */}
          {!isHost && ride.status === 'COMPLETED' && onRateHost && (
            <Button
              size="sm"
              variant="primary"
              onClick={onRateHost}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              Rate Host Experience
            </Button>
          )}

          {/* TRIP COORDINATION CHAT TOGGLE (Available immediately when accepted/confirmed) */}
          {canCoordinateChat && (
            <Button
              size="sm"
              variant={showChat ? 'secondary' : 'outline'}
              onClick={() => setShowChat((prev) => !prev)}
              className="h-8 text-xs text-primary gap-1 border-primary/30 hover:bg-primary/10"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{showChat ? 'Hide Chat' : 'Trip Chat'}</span>
            </Button>
          )}

          {/* LIVE MAP TOGGLE */}
          {isRideActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLiveMap((prev) => !prev)}
              className="h-8 text-xs text-primary gap-1"
            >
              <Map className="w-3.5 h-3.5" />
              {showLiveMap ? (
                <>
                  <span>Hide Live Map</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>View Live Map</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Pre-Trip Coordination Notice when ride is not yet active */}
      {!isRideActive && ride.status !== 'COMPLETED' && (
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 pt-1.5">
          <span>
            💬 Coordination chat is open — message the host to confirm pickup point and luggage.
          </span>
          <span className="font-medium text-emerald-600">Pre-Trip Ready</span>
        </div>
      )}

      {/* Rider GPS Permission & Hardware Status (Host Only) */}
      {isHost && !isSimulating && (
        <div className="mt-3">
          <RiderGpsStatusCard
            status={geoStatus}
            freshness={geoFreshness}
            permissionState={geoPermissionState}
            isGpsTurnedOff={isGpsTurnedOff}
            errorMessage={null}
            currentLocation={hostGeoLocation}
            onRequestPermission={requestGpsPermission}
            onRetry={retryGpsLocation}
            isTripActive={isRideActive}
          />
        </div>
      )}

      {/* LIVE INTERACTIVE TRACKING MAP (Phase 9 & Zoom Enabled) */}
      {isRideActive && showLiveMap && (
        <div className="mt-3">
          <LiveRideTrackingMap
            ride={ride}
            liveLocation={effectiveLocation}
            isHost={isHost}
            onRefreshLocation={handleManualRefresh}
          />
        </div>
      )}

      {/* COMPACT WAYPOINT PROGRESS STRIP (When map is collapsed during active trip) */}
      {isRideActive && bannerWaypoints.length > 0 && !showLiveMap && (
        <div className="mt-3 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Milestone className="w-3.5 h-3.5 text-[#00A2A5]" />
              <span>Waypoints Passed</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-400">
              {waypointProgress.passedCount} of {waypointProgress.totalCount} Passed ({waypointProgress.progressPercentage}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
            {bannerWaypoints.map((wp, idx) => {
              const isPassed =
                persistentPassedSequences.has(wp.sequence) ||
                waypointProgress.passedSequences.has(wp.sequence);
              const isActive = waypointProgress.activeSequence === wp.sequence;

              return (
                <div
                  key={wp.id || idx}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] whitespace-nowrap ${
                    isPassed
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-semibold shadow-xs'
                      : isActive
                      ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300 font-medium ring-1 ring-cyan-500/30 animate-pulse'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  {isPassed ? (
                    <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                  ) : isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  )}
                  <span>{wp.label.split('(')[0].trim()}</span>
                  {isPassed && <span className="text-[10px] text-emerald-400 font-bold ml-0.5">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRIP COORDINATION CHAT (Available once accepted) */}
      {showChat && currentUser && (
        <div className="mt-3">
          <RideCoordinationChat
            rideId={ride.id}
            rideStatus={ride.status}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            hostId={ride.host_id}
          />
        </div>
      )}

      {/* Online Presence Roster */}
      {presenceUsers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            Online in Room ({presenceUsers.length}):
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {presenceUsers.map((u, idx) => (
              <span
                key={`${u.user_id}-${idx}`}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  u.role === 'HOST'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    u.role === 'HOST' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                />
                {u.name} {u.role === 'HOST' ? '(Host)' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
