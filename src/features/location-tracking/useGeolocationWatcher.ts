import { useState, useEffect, useRef, useCallback } from 'react';
import { liveLocationService } from './liveLocation.service';
import type {
  LiveLocationUpdate,
  LocationSharingStatus,
  LocationFreshness,
} from './location.types';
import { calculateLocationFreshness } from './location.types';

export interface UseGeolocationWatcherOptions {
  rideId: string;
  hostId: string;
  isActive: boolean;
  enabled?: boolean;
}

export function useGeolocationWatcher({
  rideId,
  hostId,
  isActive,
  enabled = true,
}: UseGeolocationWatcherOptions) {
  const [status, setStatus] = useState<LocationSharingStatus>('IDLE');
  const [currentLocation, setCurrentLocation] = useState<LiveLocationUpdate | null>(null);
  const [freshness, setFreshness] = useState<LocationFreshness>('LOST');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('ENDED');
    liveLocationService.stopLocationSharing(hostId, rideId).catch(() => {});
  }, [hostId, rideId]);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('UNAVAILABLE');
      setErrorMessage('Geolocation is not supported by your browser environment.');
      return;
    }

    setStatus('REQUESTING_PERMISSION');
    setErrorMessage(null);

    liveLocationService.startLocationSharing(hostId, rideId).catch(() => {});

    try {
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          setStatus('ACTIVE');
          const update: LiveLocationUpdate = {
            ride_id: rideId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            heading: pos.coords.heading !== null && !isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : null,
            speed:
              pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0
                ? Math.round(pos.coords.speed * 3.6) // convert m/s to km/h
                : null,
            timestamp: new Date().toISOString(),
          };

          setCurrentLocation(update);
          setFreshness('FRESH');

          try {
            await liveLocationService.publishLocation(hostId, update);
          } catch (err: unknown) {
            console.warn('Error publishing location:', err);
          }
        },
        (error: GeolocationPositionError) => {
          if (error.code === error.PERMISSION_DENIED) {
            setStatus('PERMISSION_DENIED');
            setErrorMessage('Location permission denied. Live map will be unavailable.');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setStatus('UNAVAILABLE');
            setErrorMessage('GPS position unavailable. Please check device location settings.');
          } else {
            setStatus('ERROR');
            setErrorMessage(error.message || 'Error acquiring location signal.');
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );

      watchIdRef.current = id;
    } catch (err: unknown) {
      setStatus('ERROR');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize geolocation watcher');
    }
  }, [hostId, rideId]);

  // Manage watch lifecycle based on active state
  useEffect(() => {
    if (isActive && enabled) {
      startWatching();
    } else {
      if (watchIdRef.current !== null) {
        stopWatching();
      }
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, enabled, startWatching, stopWatching]);

  // Periodic freshness check (every 5 seconds)
  useEffect(() => {
    if (!currentLocation) return;
    const interval = setInterval(() => {
      setFreshness(calculateLocationFreshness(currentLocation.timestamp));
    }, 5000);
    return () => clearInterval(interval);
  }, [currentLocation]);

  return {
    status,
    currentLocation,
    freshness,
    errorMessage,
    startWatching,
    stopWatching,
  };
}
