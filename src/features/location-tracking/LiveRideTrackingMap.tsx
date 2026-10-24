import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Ride } from '@/features/rides/ride.types';
import type { LiveLocationUpdate, LocationFreshness } from './location.types';
import { calculateLocationFreshness } from './location.types';
import { decodePolyline } from '@/features/routes/polyline.utils';
import { calculateWaypointProgress, type WaypointLike } from '@/features/routes/waypointProgress';
import { useSmoothVehicleMarker } from './useSmoothVehicleMarker';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Check,
  Milestone,
  Zap,
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

  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number } | null>(null);

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

  const originCoord = coordinates[0];
  const destCoord = coordinates[coordinates.length - 1];

  // 60fps Smooth Vehicle Movement, Snap-to-Road & Dead Reckoning
  const smoothMarker = useSmoothVehicleMarker(
    liveLocation,
    coordinates,
    ride.status === 'ACTIVE'
  );

  // Monotonic persistence of passed waypoints
  const [persistentPassedSequences, setPersistentPassedSequences] = useState<Set<number>>(new Set());

  // Form structured ordered waypoint sequence
  const allSortedWaypoints = useMemo(() => {
    const list: WaypointLike[] = [];
    const hasOrigin = ride.waypoints?.some((w) => w.type === 'ORIGIN');
    const hasDest = ride.waypoints?.some((w) => w.type === 'DESTINATION');

    if (!hasOrigin && ride.origin) {
      list.push({
        id: 'orig',
        ride_id: ride.id,
        sequence: 0,
        latitude: ride.origin.latitude,
        longitude: ride.origin.longitude,
        label: ride.origin.name,
        type: 'ORIGIN',
        distance_from_start_meters: 0,
      });
    }

    if (ride.waypoints) {
      list.push(...ride.waypoints);
    }

    if (!hasDest && ride.destination) {
      list.push({
        id: 'dest',
        ride_id: ride.id,
        sequence: 9999,
        latitude: ride.destination.latitude,
        longitude: ride.destination.longitude,
        label: ride.destination.name,
        type: 'DESTINATION',
        distance_from_start_meters: null,
      });
    }

    return list.sort((a, b) => a.sequence - b.sequence);
  }, [ride]);

  // Evaluate real-time waypoint progression
  const waypointProgress = useMemo(() => {
    return calculateWaypointProgress({
      waypoints: allSortedWaypoints,
      coordinates,
      currentLocation: liveLocation,
      isRideActive: ride.status === 'ACTIVE',
      isRideCompleted: ride.status === 'COMPLETED',
      previouslyPassedSequences: persistentPassedSequences,
    });
  }, [allSortedWaypoints, coordinates, liveLocation, ride.status, persistentPassedSequences]);

  // Monotonically accumulate passed waypoints
  useEffect(() => {
    if (waypointProgress.passedSequences.size > persistentPassedSequences.size) {
      setPersistentPassedSequences(new Set(waypointProgress.passedSequences));
    }
  }, [waypointProgress.passedSequences, persistentPassedSequences.size]);

  // Project geographic coordinates into SVG viewBox (500 x 280)
  // Stable bounding box: anchored exclusively to route corridor coordinates so the map
  // does not jitter or rescale when host GPS updates.
  const {
    pathData,
    projectedWaypoints,
    projectedOrigin,
    projectedDest,
    projectedHost,
    isOriginPassed,
    isDestPassed,
  } = useMemo(() => {
    const width = 500;
    const height = 280;
    const padding = 50;

    if (coordinates.length < 2) {
      return {
        pathData: '',
        projectedWaypoints: [],
        projectedOrigin: null,
        projectedDest: null,
        projectedHost: null,
        isOriginPassed: false,
        isDestPassed: false,
      };
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

    // Ensure non-zero span with minimum tolerance
    const latSpan = Math.max(maxLat - minLat, 0.008);
    const lngSpan = Math.max(maxLng - minLng, 0.008);

    const project = (lat: number, lng: number) => {
      const x = padding + ((lng - minLng) / lngSpan) * (width - 2 * padding);
      // Invert Y because latitude increases northward (upward)
      const y = height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);
      return { x, y };
    };

    // 1. Build route corridor path
    let d = '';
    const pts = coordinates.map(([lat, lng]) => project(lat, lng));
    d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }

    // 2. Project intermediate waypoints (excluding origin and destination)
    const wps = (ride.waypoints || [])
      .filter((wp) => wp.type !== 'ORIGIN' && wp.type !== 'DESTINATION')
      .map((wp) => {
        const isPassed =
          persistentPassedSequences.has(wp.sequence) ||
          waypointProgress.passedSequences.has(wp.sequence);
        const isActive = waypointProgress.activeSequence === wp.sequence;
        return {
          ...wp,
          ...project(wp.latitude, wp.longitude),
          isPassed,
          isActive,
        };
      });

    // 3. Project dynamic Origin & Destination pins
    const projOrig = originCoord ? project(originCoord[0], originCoord[1]) : null;
    const projDst = destCoord ? project(destCoord[0], destCoord[1]) : null;

    const originWp =
      allSortedWaypoints.find((w) => w.type === 'ORIGIN') || allSortedWaypoints[0];
    const destWp =
      allSortedWaypoints.find((w) => w.type === 'DESTINATION') ||
      allSortedWaypoints[allSortedWaypoints.length - 1];
    const isOrigPassed = originWp
      ? persistentPassedSequences.has(originWp.sequence) ||
        waypointProgress.passedSequences.has(originWp.sequence)
      : false;
    const isDstPassed = destWp
      ? persistentPassedSequences.has(destWp.sequence) ||
        waypointProgress.passedSequences.has(destWp.sequence)
      : ride.status === 'COMPLETED';

    // 4. Project live host marker with soft edge-clamping (using 60fps smoothed position)
    let hostPt: { x: number; y: number; isOffScreen: boolean } | null = null;
    const effectiveLat = smoothMarker.latitude ?? liveLocation?.latitude ?? null;
    const effectiveLng = smoothMarker.longitude ?? liveLocation?.longitude ?? null;

    if (effectiveLat !== null && effectiveLng !== null) {
      const raw = project(effectiveLat, effectiveLng);
      // Soft-clamp host inside visible map extents so marker is never lost off-screen
      const clampedX = Math.min(width - 20, Math.max(20, raw.x));
      const clampedY = Math.min(height - 20, Math.max(20, raw.y));
      const isOffScreen = raw.x < 15 || raw.x > width - 15 || raw.y < 15 || raw.y > height - 15;
      hostPt = { x: clampedX, y: clampedY, isOffScreen };
    }

    return {
      pathData: d,
      projectedWaypoints: wps,
      projectedOrigin: projOrig,
      projectedDest: projDst,
      projectedHost: hostPt,
      isOriginPassed: isOrigPassed,
      isDestPassed: isDstPassed,
    };
  }, [
    coordinates,
    liveLocation,
    smoothMarker.latitude,
    smoothMarker.longitude,
    ride.waypoints,
    originCoord,
    destCoord,
    persistentPassedSequences,
    waypointProgress,
    allSortedWaypoints,
    ride.status,
  ]);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((z) => Math.min(4, Math.round((z + 0.4) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(1, Math.round((z - 0.4) * 10) / 10);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFocusHost = () => {
    if (projectedHost) {
      const targetZoom = 2.2;
      setZoom(targetZoom);
      const targetPanX = 250 - projectedHost.x * targetZoom;
      const targetPanY = 140 - projectedHost.y * targetZoom;
      setPan({ x: Math.round(targetPanX), y: Math.round(targetPanY) });
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom((z) => {
      const next = Math.min(4, Math.max(1, Math.round((z + delta) * 10) / 10));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Drag pan handlers (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    setPan({
      x: dragStartRef.current.startPanX + dx,
      y: dragStartRef.current.startPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    dragStartRef.current = null;
  };

  // Drag pan handlers (Touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsPanning(true);
    dragStartRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || !dragStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.clientX;
    const dy = touch.clientY - dragStartRef.current.clientY;
    setPan({
      x: dragStartRef.current.startPanX + dx,
      y: dragStartRef.current.startPanY + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    dragStartRef.current = null;
  };

  // Signal Freshness Badge configuration
  const freshnessBadge = (() => {
    switch (freshness) {
      case 'FRESH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-3.5" />
            Live Signal &bull; {secondsAgo}s ago
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <Radio className="w-3 h-3 text-amber-600 animate-spin" />
            Signal Stale &bull; {secondsAgo}s ago
          </span>
        );
      case 'LOST':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
            <WifiOff className="w-3 h-3 text-slate-400" />
            GPS Disconnected
          </span>
        );
    }
  })();

  const originName = ride.origin?.name || 'Journey Start';
  const destName = ride.destination?.name || 'Journey Destination';

  return (
    <div className={`space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm overflow-hidden ${className}`}>
      {/* HEADER: TITLE & SIGNAL QUALITY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
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
      <div
        className={`relative rounded-xl border border-border/80 bg-slate-950 p-2 overflow-hidden shadow-inner select-none ${
          zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* INTERACTIVE ZOOM & FOCUS CONTROLS */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            title="Zoom in (+)"
            aria-label="Zoom in"
            className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            title="Zoom out (-)"
            aria-label="Zoom out"
            className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetFit}
            title="Reset to Fit Route"
            aria-label="Fit route"
            className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {projectedHost && (
            <button
              type="button"
              onClick={handleFocusHost}
              title="Focus on Host Location"
              aria-label="Focus host"
              className="p-1.5 rounded-lg text-[#00A2A5] hover:text-cyan-300 hover:bg-slate-800 transition-colors"
            >
              <Crosshair className="h-4 w-4 animate-pulse" />
            </button>
          )}
          <div className="px-1 text-[9px] font-mono text-slate-400 font-semibold border-t border-slate-700/60 pt-0.5">
            {zoom.toFixed(1)}x
          </div>
        </div>

        {/* HINT OVERLAY */}
        <div className="absolute top-3 left-3 z-10 text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
          {zoom > 1 ? 'Drag to pan' : 'Scroll wheel to zoom'}
        </div>

        <svg
          viewBox="0 0 500 280"
          className="w-full h-64 sm:h-72 select-none"
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

          {/* ZOOMABLE & PAN-ENABLED CANVAS GROUP */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            className="transition-transform duration-100 ease-out"
          >
            {/* ROUTE CORRIDOR PATH */}
            {pathData && (
              <>
                {/* Outer Corridor Glow */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#003C84"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.45"
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

            {/* SEQUENCED INTERMEDIATE WAYPOINTS WITH LIVE PASSING STATE */}
            {projectedWaypoints.map((wp, idx) => (
              <g key={wp.id || idx} className="cursor-pointer">
                {wp.isPassed ? (
                  <>
                    {/* Pulsing Emerald Halo */}
                    <circle cx={wp.x} cy={wp.y} r="10" fill="#10B981" opacity="0.3" className="animate-pulse" />
                    {/* Emerald Green Node */}
                    <circle cx={wp.x} cy={wp.y} r="6.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                    {/* White Checkmark (Green Tick) */}
                    <path
                      d={`M ${wp.x - 3} ${wp.y} L ${wp.x - 1} ${wp.y + 2.5} L ${wp.x + 3.5} ${wp.y - 2.5}`}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Passed Badge Pill */}
                    <rect
                      x={wp.x - 22}
                      y={wp.y - 22}
                      width="44"
                      height="12"
                      rx="3"
                      fill="rgba(16, 185, 129, 0.95)"
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                    />
                    <text
                      x={wp.x}
                      y={wp.y - 13}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#FFFFFF"
                      fontWeight="700"
                      className="pointer-events-none select-none"
                    >
                      ✓ PASSED
                    </text>
                  </>
                ) : wp.isActive ? (
                  <>
                    {/* Active approaching node pulse */}
                    <circle cx={wp.x} cy={wp.y} r="9" fill="#00A2A5" opacity="0.4" className="animate-pulse" />
                    <circle cx={wp.x} cy={wp.y} r="5.5" fill="#00A2A5" stroke="#FFFFFF" strokeWidth="1.5" />
                    <text
                      x={wp.x}
                      y={wp.y + 2.5}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#FFFFFF"
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      {wp.sequence}
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={wp.x} cy={wp.y} r="4.5" fill="#1E293B" stroke="#F1F5F9" strokeWidth="1.5" />
                    <text
                      x={wp.x}
                      y={wp.y + 2.5}
                      textAnchor="middle"
                      fontSize="6.5"
                      fill="#94A3B8"
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {wp.sequence}
                    </text>
                  </>
                )}

                {/* Waypoint Label */}
                <text
                  x={wp.x}
                  y={wp.isPassed ? wp.y + 14 : wp.y - 9}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill={wp.isPassed ? '#34D399' : wp.isActive ? '#38BDF8' : '#CBD5E1'}
                  fontWeight={wp.isPassed || wp.isActive ? '700' : '500'}
                  className="pointer-events-none select-none drop-shadow"
                >
                  {wp.isPassed ? `✓ ${wp.label.split('(')[0].trim()}` : wp.label.split('(')[0].trim()}
                </text>
              </g>
            ))}

            {/* DYNAMIC ORIGIN PIN */}
            {projectedOrigin && (
              <g className="cursor-pointer">
                <circle cx={projectedOrigin.x} cy={projectedOrigin.y} r="11" fill="#10B981" opacity="0.3" className="animate-pulse" />
                <circle cx={projectedOrigin.x} cy={projectedOrigin.y} r="6.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                {isOriginPassed && (
                  <path
                    d={`M ${projectedOrigin.x - 3} ${projectedOrigin.y} L ${projectedOrigin.x - 1} ${projectedOrigin.y + 2.5} L ${projectedOrigin.x + 3.5} ${projectedOrigin.y - 2.5}`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <rect
                  x={projectedOrigin.x - 38}
                  y={projectedOrigin.y + 9}
                  width="76"
                  height="15"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke="#10B981"
                  strokeWidth="0.8"
                />
                <text
                  x={projectedOrigin.x}
                  y={projectedOrigin.y + 20}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#FFFFFF"
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  START: {originName.length > 14 ? originName.slice(0, 12) + '..' : originName}
                </text>
              </g>
            )}

            {/* DYNAMIC DESTINATION PIN */}
            {projectedDest && (
              <g className="cursor-pointer">
                <circle
                  cx={projectedDest.x}
                  cy={projectedDest.y}
                  r="11"
                  fill={isDestPassed ? '#10B981' : '#E85C0D'}
                  opacity="0.3"
                  className="animate-pulse"
                />
                <circle
                  cx={projectedDest.x}
                  cy={projectedDest.y}
                  r="6.5"
                  fill={isDestPassed ? '#10B981' : '#E85C0D'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                {isDestPassed && (
                  <path
                    d={`M ${projectedDest.x - 3} ${projectedDest.y} L ${projectedDest.x - 1} ${projectedDest.y + 2.5} L ${projectedDest.x + 3.5} ${projectedDest.y - 2.5}`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <rect
                  x={projectedDest.x - 38}
                  y={projectedDest.y - 23}
                  width="76"
                  height="15"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke={isDestPassed ? '#10B981' : '#E85C0D'}
                  strokeWidth="0.8"
                />
                <text
                  x={projectedDest.x}
                  y={projectedDest.y - 12}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#FFFFFF"
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  DEST: {destName.length > 14 ? destName.slice(0, 12) + '..' : destName}
                </text>
              </g>
            )}

            {/* LIVE HOST VEHICLE MARKER (60FPS SMOOTHED & ROAD-SNAPPED) */}
            {projectedHost && (
              <g className="transition-transform duration-75 ease-linear">
                {/* GPS Accuracy Halo Ring */}
                <circle
                  cx={projectedHost.x}
                  cy={projectedHost.y}
                  r={Math.min(32, Math.max(16, (smoothMarker.accuracy || 12) * 0.8))}
                  fill="url(#hostHaloGrad)"
                  className="animate-pulse"
                />

                {/* Concentric Radar Ring */}
                <circle
                  cx={projectedHost.x}
                  cy={projectedHost.y}
                  r="18"
                  fill="none"
                  stroke={smoothMarker.movementMode === 'DEAD_RECKONING' ? '#F59E0B' : '#00A2A5'}
                  strokeWidth="1"
                  opacity="0.6"
                />

                {/* Host Vehicle Center Marker */}
                <circle
                  cx={projectedHost.x}
                  cy={projectedHost.y}
                  r="9"
                  fill="#003C84"
                  stroke={smoothMarker.movementMode === 'DEAD_RECKONING' ? '#F59E0B' : '#FFFFFF'}
                  strokeWidth="2.5"
                  className="drop-shadow-lg"
                />

                {/* Heading Orientation Arrow */}
                {smoothMarker.heading !== null && smoothMarker.heading !== undefined && (
                  <g transform={`rotate(${smoothMarker.heading}, ${projectedHost.x}, ${projectedHost.y})`}>
                    <polygon
                      points={`${projectedHost.x},${projectedHost.y - 14} ${projectedHost.x - 4},${projectedHost.y - 8} ${projectedHost.x + 4},${projectedHost.y - 8}`}
                      fill="#F1F5F9"
                    />
                  </g>
                )}

                {/* Host Telemetry Label */}
                <rect
                  x={projectedHost.x - 34}
                  y={projectedHost.y + 12}
                  width="68"
                  height="15"
                  rx="4"
                  fill={
                    smoothMarker.movementMode === 'DEAD_RECKONING'
                      ? 'rgba(180, 83, 9, 0.95)'
                      : 'rgba(0, 60, 132, 0.95)'
                  }
                  stroke={smoothMarker.movementMode === 'DEAD_RECKONING' ? '#F59E0B' : '#00A2A5'}
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
                  {smoothMarker.movementMode === 'DEAD_RECKONING' ? 'PREDICTED' : 'HOST'}{' '}
                  {smoothMarker.speed ? `${smoothMarker.speed}kph` : ''}
                </text>
              </g>
            )}
          </g>
        </svg>

        {/* FLOATING TELEMETRY CHIPS */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] pointer-events-none flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-200">
            <Gauge className="w-3.5 h-3.5 text-[#00A2A5]" />
            <span>
              Speed:{' '}
              {smoothMarker.speed !== null && smoothMarker.speed !== undefined
                ? `${smoothMarker.speed} km/h`
                : 'Stopped'}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-200">
            <Compass className="w-3.5 h-3.5 text-[#EAA023]" />
            <span>GPS Precision: &plusmn;{smoothMarker.accuracy || 12}m</span>
          </div>

          {smoothMarker.movementMode === 'DEAD_RECKONING' ? (
            <div className="flex items-center gap-1.5 bg-amber-950/90 backdrop-blur border border-amber-500/50 text-amber-300 px-2.5 py-1 rounded-lg animate-pulse font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Predicting Route (Dead Reckoning)</span>
            </div>
          ) : smoothMarker.isSnappedToRoad ? (
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg font-medium">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Road Snapped (60fps)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{secondsAgo < 5 ? 'Realtime' : `${secondsAgo}s delay`}</span>
            </div>
          )}
        </div>
      </div>

      {/* CORRIDOR WAYPOINTS PROGRESS BAR & CHIPS */}
      {allSortedWaypoints.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Milestone className="w-3.5 h-3.5 text-[#00A2A5]" />
              <span>Corridor Waypoints Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {waypointProgress.passedCount} of {waypointProgress.totalCount} passed
              </span>
              <span className="font-bold text-emerald-400 text-xs">
                {waypointProgress.progressPercentage}%
              </span>
            </div>
          </div>

          {/* Progress Bar Fill */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-[#00A2A5] to-teal-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${waypointProgress.progressPercentage}%` }}
            />
          </div>

          {/* Waypoint Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-[11px]">
            {allSortedWaypoints.map((wp, idx) => {
              const isPassed =
                persistentPassedSequences.has(wp.sequence) ||
                waypointProgress.passedSequences.has(wp.sequence);
              const isActive = waypointProgress.activeSequence === wp.sequence;

              return (
                <div
                  key={wp.id || idx}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all ${
                    isPassed
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-semibold shadow-xs'
                      : isActive
                      ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300 font-semibold ring-1 ring-cyan-500/30 animate-pulse'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  {isPassed ? (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
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

      {/* SAFETY & TRANSIENT STORAGE NOTICE */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
        <span className="flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-emerald-600" />
          Location streaming is ephemeral and automatically terminates when trip concludes.
        </span>
        <span className="font-semibold text-primary">ICEM Campus Transit Security</span>
      </div>
    </div>
  );
};
