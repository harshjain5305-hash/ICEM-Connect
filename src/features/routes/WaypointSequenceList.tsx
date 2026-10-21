import React from 'react';
import type { CalculatedWaypoint } from './route.types';
import type { RideWaypoint } from '@/features/rides/ride.types';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Navigation, Milestone } from 'lucide-react';

export interface WaypointSequenceListProps {
  waypoints: (CalculatedWaypoint | RideWaypoint)[];
  onToggleWaypoint?: (sequence: number) => void;
  selectedSequences?: number[];
  interactive?: boolean;
}

export const WaypointSequenceList: React.FC<WaypointSequenceListProps> = ({
  waypoints,
  onToggleWaypoint,
  selectedSequences,
  interactive = false,
}) => {
  if (!waypoints || waypoints.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground italic">
        No waypoints generated yet. Select origin and destination.
      </div>
    );
  }

  // Ensure sorted by sequence
  const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span className="flex items-center gap-1.5">
          <Milestone className="h-3.5 w-3.5 text-primary" />
          Ordered Route Waypoints ({sorted.length} stops)
        </span>
        <span className="text-[11px] font-normal normal-case text-muted-foreground">
          Pickup &rarr; Drop sequence
        </span>
      </div>

      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-[#00A2A5] before:to-rose-500">
        {sorted.map((wp) => {
          const isOrigin = wp.type === 'ORIGIN' || wp.sequence === 1;
          const isDest = wp.type === 'DESTINATION' || wp.sequence === sorted.length;
          const isIntermediate = !isOrigin && !isDest;

          const distanceKm =
            wp.distance_from_start_meters !== null && wp.distance_from_start_meters !== undefined
              ? (wp.distance_from_start_meters / 1000).toFixed(1)
              : null;

          const isSelected = selectedSequences
            ? selectedSequences.includes(wp.sequence)
            : true;

          return (
            <div
              key={`${wp.sequence}_${wp.label}`}
              onClick={() => {
                if (interactive && isIntermediate && onToggleWaypoint) {
                  onToggleWaypoint(wp.sequence);
                }
              }}
              className={`relative flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                isOrigin
                  ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : isDest
                  ? 'border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20'
                  : isSelected
                  ? 'border-border bg-card hover:border-primary/40'
                  : 'border-dashed border-border/60 bg-muted/20 opacity-60'
              } ${interactive && isIntermediate ? 'cursor-pointer hover:shadow-sm' : ''}`}
            >
              {/* TIMELINE NODE MARKER */}
              <div
                className={`absolute -left-6 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-card text-[10px] font-bold shadow-sm ${
                  isOrigin
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : isDest
                    ? 'border-rose-500 text-rose-700 dark:text-rose-300'
                    : isSelected
                    ? 'border-[#00A2A5] text-[#00A2A5]'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                {wp.sequence}
              </div>

              {/* LOCATION DETAILS */}
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="shrink-0">
                  {isOrigin ? (
                    <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : isDest ? (
                    <Navigation className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[#00A2A5]" />
                  )}
                </div>

                <div className="truncate">
                  <span className="font-semibold text-foreground block truncate">
                    {wp.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {isOrigin
                      ? 'Trip Starting Point'
                      : isDest
                      ? 'Final Trip Destination'
                      : 'Intermediate Transit Node'}
                  </span>
                </div>
              </div>

              {/* DISTANCE BADGE */}
              <div className="shrink-0 flex items-center gap-2">
                {distanceKm !== null && (
                  <Badge variant={isOrigin ? 'success' : isDest ? 'destructive' : 'cyan'} className="text-[10px]">
                    {isOrigin ? 'Start (0 km)' : `+${distanceKm} km`}
                  </Badge>
                )}

                {interactive && isIntermediate && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleWaypoint && onToggleWaypoint(wp.sequence)}
                    className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
                    aria-label={`Toggle waypoint ${wp.label}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
