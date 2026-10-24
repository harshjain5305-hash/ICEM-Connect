import { useState, useEffect, useRef, useCallback } from 'react';
import { liveLocationService } from './liveLocation.service';
import { GPSKalmanFilter } from './gpsKalmanFilter';
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

export type GpsPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

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
  const [permissionState, setPermissionState] = useState<GpsPermissionState>('prompt');
  const [isGpsTurnedOff, setIsGpsTurnedOff] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const kalmanFilterRef = useRef<GPSKalmanFilter>(new GPSKalmanFilter());

  // Check browser permission state if supported
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermissionState('unsupported');
      return;
    }

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((perm) => {
          setPermissionState(perm.state as GpsPermissionState);
          perm.onchange = () => {
            setPermissionState(perm.state as GpsPermissionState);
          };
        })
        .catch(() => {
          // Permissions API query not supported or rejected
        });
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    kalmanFilterRef.current.reset();
    setStatus('ENDED');
    liveLocationService.stopLocationSharing(hostId, rideId).catch(() => {});
  }, [hostId, rideId]);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('UNAVAILABLE');
      setPermissionState('unsupported');
      setErrorMessage('Geolocation is not supported by your browser environment.');
      return;
    }

    setStatus('REQUESTING_PERMISSION');
    setErrorMessage(null);
    setIsGpsTurnedOff(false);

    liveLocationService.startLocationSharing(hostId, rideId).catch(() => {});

    try {
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          setStatus('ACTIVE');
          setPermissionState('granted');
          setIsGpsTurnedOff(false);
          setErrorMessage(null);

          const rawAccuracy = Math.round(pos.coords.accuracy);
          const rawHeading =
            pos.coords.heading !== null && !isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : null;
          const rawSpeed =
            pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0
              ? Math.round(pos.coords.speed * 3.6) // convert m/s to km/h
              : null;

          const filtered = kalmanFilterRef.current.filter(
            pos.coords.latitude,
            pos.coords.longitude,
            rawAccuracy,
            pos.timestamp || Date.now()
          );

          const update: LiveLocationUpdate = {
            ride_id: rideId,
            latitude: filtered.latitude,
            longitude: filtered.longitude,
            accuracy: filtered.accuracy,
            heading: rawHeading,
            speed: rawSpeed ?? filtered.estimatedSpeedKph,
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
            setPermissionState('denied');
            setErrorMessage('Location permission denied. Live map will be unavailable.');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setStatus('UNAVAILABLE');
            setIsGpsTurnedOff(true);
            setErrorMessage('Device GPS hardware appears to be turned off. Please check device location settings.');
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

  const requestPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser environment.');
      return;
    }
    setErrorMessage(null);
    setStatus('REQUESTING_PERMISSION');
    navigator.geolocation.getCurrentPosition(
      () => {
        setPermissionState('granted');
        startWatching();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
          setStatus('PERMISSION_DENIED');
          setErrorMessage('Location permission denied. Please allow location in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setIsGpsTurnedOff(true);
          setStatus('UNAVAILABLE');
          setErrorMessage('Device GPS is off. Please enable Location in your device settings.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [startWatching]);

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
    permissionState,
    isGpsTurnedOff,
    requestPermission,
    retryLocation: startWatching,
    startWatching,
    stopWatching,
  };
}
