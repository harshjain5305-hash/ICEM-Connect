import React, { useMemo, useState, useEffect } from 'react';
import type { Ride } from '@/features/rides/ride.types';
import type { LiveLocationUpdate, LocationFreshness } from './location.types';
import { calculateLocationFreshness } from './location.types';
import { decodePolyline } from '@/features/routes/polyline.utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Navigation,
  Compass,
  Gauge,
  Radio,
  Clock,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';

export interface LiveRideTrackingMapProps {
  ride: Ride;
  liveLocation: LiveLocationUpdate | null;
  isHost: boolean;
  onRefreshLocation?: () => void;
  className?: string;
}

export const LiveRideTrackingMap: React.FC<LiveRideTrackingMapProps> = ({
  ride,
  liveLocation,
  isHost,
  onRefreshLocation,
  className = '',
}) => {
  const [freshness, setFreshness] = useState<LocationFreshness>(
    calculateLocationFreshness(liveLocation?.timestamp)
  );
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Update freshness every 2 seconds
  useEffect(() => {
    if (!liveLocation?.timestamp) {
      setFreshness('LOST');
      return;
    }

    const updateAge = () => {
      const ageMs = Date.now() - new Date(liveLocation.timestamp).getTime();
      setSecondsAgo(Math.max(0, Math.floor(ageMs / 1000)));
      setFreshness(calculateLocationFreshness(liveLocation.timestamp));
    };

    updateAge();
    const interval = setInterval(updateAge, 2000);
    return () => clearInterval(interval);
  }, [liveLocation?.timestamp]);

  // Decode route corridor coordinates
  const coordinates: [number, number][] = useMemo(() => {
    const route = ride.route;
    if (route?.encoded_polyline) {
      return decodePolyline(route.encoded_polyline);
    }
    if (route?.geometry_json && 'coordinates' in route.geometry_json) {
      const geoCoords = route.geometry_json.coordinates as [number, number][];
      return geoCoords.map(([lng, lat]) => [lat, lng]);
    }
    // Fallback between origin, destination and waypoints
    const pts: [number, number][] = [];
    if (ride.origin) pts.push([ride.origin.latitude, ride.origin.longitude]);
    if (ride.waypoints) {
      for (const wp of ride.waypoints) {
        pts.push([wp.latitude, wp.longitude]);
      }
    }
    if (ride.destination) pts.push([ride.destination.latitude, ride.destination.longitude]);
    return pts;
  }, [ride]);

  // Project geographic coordinates into SVG viewBox (500 x 300)
  const { pathData, projectedWaypoints, projectedHost } = useMemo(() => {
    const width = 500;
    const height = 280;
    const padding = 45;

    // Combine route coords and live location to calculate bounding box
    const allCoords = [...coordinates];
    if (liveLocation) {
      allCoords.push([liveLocation.latitude, liveLocation.longitude]);
    }

    if (allCoords.length < 2) {
      return { pathData: '', projectedWaypoints: [], projectedHost: null };
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lat, lng] of allCoords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latSpan = Math.max(maxLat - minLat, 0.005);
    const lngSpan = Math.max(maxLng - minLng, 0.005);

    const project = (lat: number, lng: number) => {
      const x = padding + ((lng - minLng) / lngSpan) * (width - 2 * padding);
      const y = height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);
      return { x, y };
    };

    // Route corridor path
    let d = '';
    if (coordinates.length >= 2) {
      const pts = coordinates.map(([lat, lng]) => project(lat, lng));
      d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      }
    }

    // Projected waypoints
    const wps = (ride.waypoints || []).map((wp) => ({
      ...wp,
      ...project(wp.latitude, wp.longitude),
    }));

    // Projected live host marker
    let hostPt: { x: number; y: number } | null = null;
    if (liveLocation) {
      hostPt = project(liveLocation.latitude, liveLocation.longitude);
    }

    return { pathData: d, projectedWaypoints: wps, projectedHost: hostPt };
  }, [coordinates, liveLocation, ride.waypoints]);

  const originCoord = coordinates[0];
  const destCoord = coordinates[coordinates.length - 1];

  // Signal Freshness Badge configuration
  const freshnessBadge = (() => {
    switch (freshness) {
      case 'FRESH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-3.5" />
            Live Signal &bull; {secondsAgo}s ago
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Radio className="w-3 h-3 text-amber-600 animate-spin" />
            Signal Stale &bull; {secondsAgo}s ago
          </span>
        );
      case 'LOST':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <WifiOff className="w-3 h-3 text-slate-400" />
            GPS Disconnected
          </span>
        );
    }
  })();

  return (
    <div className={`space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm overflow-hidden ${className}`}>
      {/* HEADER: TITLE & SIGNAL QUALITY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Navigation className="h-4 w-4 fill-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Live Campus Trip Tracking</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {ride.vehicle_type}
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isHost
                ? 'Your GPS coordinates are streaming to confirmed passengers'
                : 'Real-time host location along your corridor'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {freshnessBadge}
          {onRefreshLocation && (
            <Button size="sm" variant="outline" onClick={onRefreshLocation} className="h-7 text-xs px-2">
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* SVG LIVE ROUTE MAP CANVAS */}
      <div className="relative rounded-xl border border-border/80 bg-slate-950 p-2 overflow-hidden shadow-inner">
        <svg
          viewBox="0 0 500 280"
          className="w-full h-56 sm:h-64 select-none touch-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Corridor glow effect */}
            <filter id="corridorGlowLive" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pulsing ripple for host marker */}
            <radialGradient id="hostHaloGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00A2A5" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#00A2A5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00A2A5" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* BACKGROUND ROAD GRID */}
          <pattern id="gridLive" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
          </pattern>
          <rect width="500" height="280" fill="url(#gridLive)" />

          {/* ROUTE CORRIDOR PATH */}
          {pathData && (
            <>
              {/* Outer Corridor Glow */}
              <path
                d={pathData}
                fill="none"
                stroke="#003C84"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
                filter="url(#corridorGlowLive)"
              />
              {/* High-contrast Main Polyline */}
              <path
                d={pathData}
                fill="none"
                stroke="#00A2A5"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* SEQUENCED WAYPOINTS */}
          {projectedWaypoints.map((wp, idx) => (
            <g key={wp.id || idx} className="cursor-pointer">
              <circle cx={wp.x} cy={wp.y} r="4.5" fill="#1E293B" stroke="#F1F5F9" strokeWidth="1.5" />
              <text
                x={wp.x}
                y={wp.y - 8}
                textAnchor="middle"
                fontSize="9"
                fill="#CBD5E1"
                fontWeight="500"
                className="pointer-events-none select-none drop-shadow"
              >
                {wp.label.split('(')[0].trim()}
              </text>
            </g>
          ))}

          {/* LIVE HOST VEHICLE MARKER */}
          {projectedHost && (
            <g className="transition-all duration-500 ease-out">
              {/* GPS Accuracy Halo Ring */}
              <circle
                cx={projectedHost.x}
                cy={projectedHost.y}
                r={Math.min(32, Math.max(16, (liveLocation?.accuracy || 15) * 0.8))}
                fill="url(#hostHaloGrad)"
                className="animate-pulse"
              />

              {/* Concentric Radar Ring */}
              <circle
                cx={projectedHost.x}
                cy={projectedHost.y}
                r="18"
                fill="none"
                stroke="#00A2A5"
                strokeWidth="1"
                opacity="0.6"
              />

              {/* Host Vehicle Center Marker */}
              <circle
                cx={projectedHost.x}
                cy={projectedHost.y}
                r="9"
                fill="#003C84"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                className="drop-shadow-lg"
              />

              {/* Heading Orientation Arrow */}
              {liveLocation?.heading !== null && liveLocation?.heading !== undefined && (
                <g transform={`rotate(${liveLocation.heading}, ${projectedHost.x}, ${projectedHost.y})`}>
                  <polygon
                    points={`${projectedHost.x},${projectedHost.y - 14} ${projectedHost.x - 4},${projectedHost.y - 8} ${projectedHost.x + 4},${projectedHost.y - 8}`}
                    fill="#F1F5F9"
                  />
                </g>
              )}

              {/* Label */}
              <rect
                x={projectedHost.x - 28}
                y={projectedHost.y + 12}
                width="56"
                height="15"
                rx="4"
                fill="rgba(0, 60, 132, 0.9)"
                stroke="#00A2A5"
                strokeWidth="0.8"
              />
              <text
                x={projectedHost.x}
                y={projectedHost.y + 23}
                textAnchor="middle"
                fontSize="8.5"
                fill="#FFFFFF"
                fontWeight="700"
              >
                HOST {liveLocation?.speed ? `${liveLocation.speed}kph` : ''}
              </text>
            </g>
          )}

          {/* ORIGIN & DESTINATION PINS */}
          {originCoord && (
            <g>
              <circle cx="45" cy="235" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
              <text x="56" y="238" fontSize="9.5" fill="#10B981" fontWeight="700">
                ICEM Start
              </text>
            </g>
          )}

          {destCoord && (
            <g>
              <circle cx="455" cy="45" r="5" fill="#E85C0D" stroke="#FFFFFF" strokeWidth="2" />
              <text x="445" y="48" textAnchor="end" fontSize="9.5" fill="#E85C0D" fontWeight="700">
                Destination
              </text>
            </g>
          )}
        </svg>

        {/* FLOATING TELEMETRY CHIPS */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] pointer-events-none flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-200">
            <Gauge className="w-3.5 h-3.5 text-[#00A2A5]" />
            <span>Speed: {liveLocation?.speed !== null && liveLocation?.speed !== undefined ? `${liveLocation.speed} km/h` : 'Stopped'}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-200">
            <Compass className="w-3.5 h-3.5 text-[#EAA023]" />
            <span>GPS Precision: &plusmn;{liveLocation?.accuracy || 12}m</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{secondsAgo < 5 ? 'Realtime' : `${secondsAgo}s delay`}</span>
          </div>
        </div>
      </div>

      {/* SAFETY & TRANSIENT STORAGE NOTICE */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
        <span className="flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-emerald-600" />
          Location is ephemeral and terminates when trip concludes (Rules.md §14.6).
        </span>
        <span className="font-semibold text-primary">ICEM Campus Transit Security</span>
      </div>
    </div>
  );
};
