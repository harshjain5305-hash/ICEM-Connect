import React from 'react';
import {
  AlertTriangle,
  Compass,
  RefreshCw,
  MapPin,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { LocationSharingStatus, LocationFreshness, LiveLocationUpdate } from './location.types';
import type { GpsPermissionState } from './useGeolocationWatcher';

export interface RiderGpsStatusCardProps {
  status: LocationSharingStatus;
  freshness: LocationFreshness;
  permissionState: GpsPermissionState;
  isGpsTurnedOff: boolean;
  errorMessage?: string | null;
  currentLocation: LiveLocationUpdate | null;
  onRequestPermission: () => void;
  onRetry: () => void;
  isTripActive: boolean;
  className?: string;
}

export const RiderGpsStatusCard: React.FC<RiderGpsStatusCardProps> = ({
  status,
  freshness,
  permissionState,
  isGpsTurnedOff,
  errorMessage: _errorMessage,
  currentLocation,
  onRequestPermission,
  onRetry,
  isTripActive,
  className = '',
}) => {
  // 1. ACTIVE & BROADCASTING
  if (status === 'ACTIVE' && currentLocation) {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-xs ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              GPS Broadcasting Live
            </span>
          </div>
          <Badge variant="success" className="text-[10px] py-0 px-2 font-mono">
            {freshness === 'FRESH' ? 'FRESH (<25s)' : freshness === 'STALE' ? 'STALE (25-60s)' : 'LOST'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-emerald-500/20 text-emerald-900/90 dark:text-emerald-200">
          <div>
            <span className="text-muted-foreground block text-[10px]">Accuracy</span>
            <span className="font-medium">±{currentLocation.accuracy} m</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Speed</span>
            <span className="font-medium">{currentLocation.speed !== null ? `${currentLocation.speed} km/h` : 'Stopped'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px]">Heading</span>
            <span className="font-medium">{currentLocation.heading !== null ? `${currentLocation.heading}°` : 'N/A'}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Confirmed passengers are receiving real-time coordinates over the encrypted campus channel.
        </p>
      </div>
    );
  }

  // 2. DEVICE GPS HARDWARE OFF (POSITION_UNAVAILABLE)
  if (isGpsTurnedOff || status === 'UNAVAILABLE') {
    return (
      <div className={`rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Device GPS Appears Turned Off</span>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-100/50 text-[10px]">
            Hardware Disabled
          </Badge>
        </div>

        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
          Your browser cannot acquire satellite coordinates. Please toggle <strong>Location / GPS ON</strong> in your device or phone settings.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" /> Retry GPS Signal
          </Button>
        </div>
      </div>
    );
  }

  // 3. PERMISSION DENIED
  if (status === 'PERMISSION_DENIED' || permissionState === 'denied') {
    return (
      <div className={`rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 space-y-2 text-xs text-destructive ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4 shrink-0" />
            <span>Browser Location Permission Blocked</span>
          </div>
          <Badge variant="destructive" className="text-[10px]">
            Denied
          </Badge>
        </div>

        <p className="text-[11px] text-foreground/80">
          Browser location access is denied. To enable live tracking:
          <br />
          1. Tap the <strong>lock / info icon</strong> next to the website address bar.
          <br />
          2. Change <strong>Location</strong> permission to <strong>&ldquo;Allow&rdquo;</strong>.
          <br />
          3. Tap the button below to resume broadcasting.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={onRequestPermission}
            className="text-xs h-7 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" /> Retry Location Permission
          </Button>
        </div>
      </div>
    );
  }

  // 4. REQUESTING PERMISSION / ACQUIRING SATELLITE
  if (status === 'REQUESTING_PERMISSION') {
    return (
      <div className={`rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-1.5 text-xs ${className}`}>
        <div className="flex items-center gap-2 text-primary font-semibold">
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
          <span>Requesting Location Access &amp; Acquiring GPS Lock...</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Please confirm the location prompt in your browser to start broadcasting your route position.
        </p>
      </div>
    );
  }

  // 5. IDLE (TRIP ACTIVE OR PRE-CHECK)
  return (
    <div className={`rounded-xl border border-border p-3 space-y-2 text-xs bg-card ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          <span>Rider GPS Broadcasting</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isTripActive ? 'Ready to broadcast' : 'Activates when trip starts'}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        When your trip starts, your phone will stream coordinates along the route to confirmed ICEM passengers.
      </p>

      {permissionState !== 'granted' && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestPermission}
          className="text-xs h-7 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
        >
          <Compass className="h-3.5 w-3.5" /> Pre-Check GPS Access
        </Button>
      )}
    </div>
  );
};
