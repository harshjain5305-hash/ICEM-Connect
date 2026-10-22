import React, { useState } from 'react';
import { Radio, Users, AlertTriangle, Play, Square, RefreshCw, Map, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useRideRoom } from './useRideRoom';
import { useGeolocationWatcher } from '@/features/location-tracking/useGeolocationWatcher';
import { LiveRideTrackingMap } from '@/features/location-tracking/LiveRideTrackingMap';
import { RiderGpsStatusCard } from '@/features/location-tracking/RiderGpsStatusCard';
import { RideCoordinationChat } from '@/features/rides/RideCoordinationChat';
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
    isActive: isRideActive && isHost,
    enabled: isHost,
  });

  const effectiveLocation = isHost ? hostGeoLocation : liveLocation;

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
      await endSession();
      setConfirmComplete(false);
      onStatusChanged?.('COMPLETED');
    } catch {
      // handled in hook
    }
  };

  // Status indicator config
  const connectionBadge = (() => {
    switch (connectionState) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Room Connected
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            Connecting to Realtime...
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Connection Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Room Inactive
          </span>
        );
    }
  })();

  return (
    <div
      className={`rounded-xl border p-4 mb-4 transition-all duration-300 ${
        isRideActive
          ? 'bg-gradient-to-r from-emerald-900/10 via-teal-900/5 to-transparent border-emerald-500/40 shadow-sm'
          : 'bg-slate-50/80 border-slate-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Status & Channel Room Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Radio className={`w-3.5 h-3.5 ${isRideActive ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
              Ride Room: <code className="font-mono text-slate-600">ride:{ride.id.slice(0, 8)}</code>
            </div>
            {connectionBadge}
            {isRideActive && (
              <Badge variant="success" className="animate-pulse">
                Trip in Progress
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-600">
            {isRideActive
              ? activeSession?.started_at
                ? `Journey commenced at ${new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Active trip session in progress across campus corridor'
              : ride.status === 'COMPLETED'
              ? 'This trip has safely concluded'
              : 'Trip is scheduled. Realtime presence synchronizes participant arrivals'}
          </p>
        </div>

        {/* Right Side: Host Action Controls */}
        <div className="flex items-center gap-2">
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
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      Complete Journey
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                      <span className="text-xs text-red-700 font-medium px-1">Arrived?</span>
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
                </>
              )}
            </>
          )}

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

          {isRideActive && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowChat((prev) => !prev)}
                className="h-8 text-xs text-primary gap-1"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showChat ? 'Hide Chat' : 'Trip Chat'}</span>
              </Button>

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
            </>
          )}
        </div>
      </div>

      {/* Rider GPS Permission & Hardware Status (Host Only) */}
      {isHost && (
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

      {/* LIVE INTERACTIVE TRACKING MAP (Phase 9) */}
      {isRideActive && showLiveMap && (
        <div className="mt-3">
          <LiveRideTrackingMap
            ride={ride}
            liveLocation={effectiveLocation}
            isHost={isHost}
          />
        </div>
      )}

      {/* TRIP COORDINATION CHAT (Phase 10 — Architecture.md §47) */}
      {isRideActive && showChat && currentUser && (
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
        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            Online in Room ({presenceUsers.length}):
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {presenceUsers.map((u, idx) => (
              <span
                key={`${u.user_id}-${idx}`}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  u.role === 'HOST'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
