import React, { useMemo, useState } from 'react';
import type { CalculatedRoute, CalculatedWaypoint } from './route.types';
import type { RideRoute, RideWaypoint } from '@/features/rides/ride.types';
import { decodePolyline } from './polyline.utils';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Navigation, Clock, Gauge, Compass } from 'lucide-react';

export interface RouteMapPreviewProps {
  route?: CalculatedRoute | RideRoute | null;
  waypoints?: (CalculatedWaypoint | RideWaypoint)[];
  className?: string;
  showStats?: boolean;
}

export const RouteMapPreview: React.FC<RouteMapPreviewProps> = ({
  route,
  waypoints = [],
  className = '',
  showStats = true,
}) => {
  const [hoveredWaypoint, setHoveredWaypoint] = useState<CalculatedWaypoint | RideWaypoint | null>(null);

  // Extract coordinates from geometry_json or decode encoded_polyline
  const coordinates: [number, number][] = useMemo(() => {
    if (!route) return [];

    if (route.geometry_json && 'coordinates' in route.geometry_json) {
      const geoCoords = route.geometry_json.coordinates as [number, number][]; // [lng, lat]
      return geoCoords.map(([lng, lat]) => [lat, lng]);
    }

    if (route.encoded_polyline) {
      return decodePolyline(route.encoded_polyline); // [lat, lng]
    }

    // Fallback: draw straight lines between waypoints
    return waypoints.map((wp) => [wp.latitude, wp.longitude]);
  }, [route, waypoints]);

  // Project geographic coordinates into SVG viewBox (500 x 300)
  const { pathData, projectedWaypoints } = useMemo(() => {
    const width = 500;
    const height = 280;
    const padding = 45;

    if (coordinates.length < 2) {
      return { pathData: '', projectedWaypoints: [] };
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lat, lng] of coordinates) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    // Ensure non-zero span
    const latSpan = Math.max(maxLat - minLat, 0.005);
    const lngSpan = Math.max(maxLng - minLng, 0.005);

    const project = (lat: number, lng: number) => {
      const x = padding + ((lng - minLng) / lngSpan) * (width - 2 * padding);
      // Invert Y because latitude increases upwards
      const y = height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);
      return { x, y };
    };

    // Build SVG path string
    const points = coordinates.map(([lat, lng]) => project(lat, lng));
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }

    // Project waypoints
    const projWaypoints = waypoints.map((wp) => {
      const { x, y } = project(wp.latitude, wp.longitude);
      return {
        ...wp,
        svgX: x,
        svgY: y,
      };
    });

    return { pathData: d, projectedWaypoints: projWaypoints };
  }, [coordinates, waypoints]);

  if (!route && waypoints.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground ${className}`}>
        <Compass className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/60" />
        Select origin and destination to preview the generated travel corridor.
      </div>
    );
  }

  const distanceKm = route?.distance_meters ? (route.distance_meters / 1000).toFixed(1) : null;
  const durationMins = route?.duration_seconds ? Math.round(route.duration_seconds / 60) : null;

  return (
    <div className={`relative rounded-xl border border-border/80 bg-slate-950 text-white overflow-hidden shadow-sm ${className}`}>
      {/* TOP STATS BAR */}
      {showStats && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-sm">
            {distanceKm && (
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <Gauge className="h-3.5 w-3.5" /> {distanceKm} km
              </span>
            )}
            {durationMins && (
              <span className="flex items-center gap-1 font-medium text-slate-300 border-l border-slate-700 pl-2">
                <Clock className="h-3.5 w-3.5 text-cyan-400" /> ~{durationMins} mins
              </span>
            )}
          </div>

          <Badge variant="cyan" className="bg-[#00A2A5]/20 text-[#43CBD0] border-[#00A2A5]/40 text-[10px] hidden sm:inline-flex">
            {waypoints.length} Route Stops
          </Badge>
        </div>
      )}

      {/* SVG ROUTE CANVAS */}
      <svg
        viewBox="0 0 500 280"
        className="w-full h-auto max-h-[300px] select-none block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background Grid Pattern */}
        <defs>
          <pattern id="road-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
          <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#00A2A5" />
            <stop offset="100%" stopColor="#E85C0D" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <rect width="500" height="280" fill="url(#road-grid)" />

        {/* Soft Route Halo Shadow */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="#003C84"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />
        )}

        {/* Active Route Corridor Line */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="url(#route-gradient)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* WAYPOINT NODES ON CANVAS */}
        {projectedWaypoints.map((wp) => {
          const isOrigin = wp.sequence === 1 || wp.type === 'ORIGIN';
          const isDest = wp.sequence === waypoints.length || wp.type === 'DESTINATION';

          return (
            <g
              key={`svg_wp_${wp.sequence}`}
              className="cursor-pointer transition-transform hover:scale-125"
              onMouseEnter={() => setHoveredWaypoint(wp)}
              onMouseLeave={() => setHoveredWaypoint(null)}
            >
              {/* Outer pulsing ring for Origin / Destination */}
              {(isOrigin || isDest) && (
                <circle
                  cx={wp.svgX}
                  cy={wp.svgY}
                  r="12"
                  fill={isOrigin ? '#10B981' : '#EF4444'}
                  opacity="0.25"
                  className="animate-pulse"
                />
              )}

              {/* Waypoint circle */}
              <circle
                cx={wp.svgX}
                cy={wp.svgY}
                r={isOrigin || isDest ? 8 : 5}
                fill={isOrigin ? '#10B981' : isDest ? '#EF4444' : '#00A2A5'}
                stroke="#FFFFFF"
                strokeWidth="2"
              />

              {/* Sequence text inside origin/destination */}
              {(isOrigin || isDest) && (
                <text
                  x={wp.svgX}
                  y={wp.svgY + 3.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {isOrigin ? 'A' : 'B'}
                </text>
              )}

              {/* Label text */}
              <text
                x={wp.svgX}
                y={wp.svgY - (isOrigin || isDest ? 12 : 9)}
                textAnchor="middle"
                fill="#F1F5F9"
                fontSize="9"
                fontWeight={isOrigin || isDest ? '600' : '400'}
                className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              >
                {wp.label.length > 18 ? `${wp.label.slice(0, 16)}...` : wp.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HOVER TOOLTIP */}
      {hoveredWaypoint && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 rounded-lg bg-slate-900/95 border border-slate-700 p-2 text-xs text-white shadow-lg flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2 truncate">
            {hoveredWaypoint.type === 'ORIGIN' ? (
              <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : hoveredWaypoint.type === 'DESTINATION' ? (
              <Navigation className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-[#00A2A5] shrink-0" />
            )}
            <span className="font-semibold truncate">{hoveredWaypoint.label}</span>
          </div>
          <span className="text-slate-400 text-[11px] shrink-0">
            Stop #{hoveredWaypoint.sequence}
            {hoveredWaypoint.distance_from_start_meters
              ? ` &bull; +${(hoveredWaypoint.distance_from_start_meters / 1000).toFixed(1)} km`
              : ''}
          </span>
        </div>
      )}
    </div>
  );
};
