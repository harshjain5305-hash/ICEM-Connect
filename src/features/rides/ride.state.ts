import type { RideStatus } from '@/types/database';

/**
 * Deterministic Ride State Machine transitions (Architecture.md §11.1, Rules.md §6-9).
 *
 * DRAFT      ──► PUBLISHED ──► CONFIRMED ──► ACTIVE ──► COMPLETED
 *   │                 │             │           │
 *   └──► CANCELLED    ├──► ACTIVE   ├──► CANCEL └──► CANCELLED
 *                     ├──► CANCEL   └──► EXPIRED
 *                     └──► EXPIRED
 */
export const VALID_RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['CONFIRMED', 'ACTIVE', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Checks whether transitioning from currentStatus to targetStatus is permitted.
 */
export function canTransitionRide(currentStatus: RideStatus, targetStatus: RideStatus): boolean {
  if (currentStatus === targetStatus) return false;
  const allowed = VALID_RIDE_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}

/**
 * Returns the list of permitted target statuses from the current status.
 */
export function getAllowedTransitions(currentStatus: RideStatus): readonly RideStatus[] {
  return VALID_RIDE_TRANSITIONS[currentStatus] || [];
}

/**
 * A ride can only be edited in states that allow modification (Rules.md §7).
 * Normally DRAFT and PUBLISHED (before active participants).
 */
export function isRideEditable(status: RideStatus): boolean {
  return status === 'DRAFT' || status === 'PUBLISHED';
}

/**
 * Terminal statuses cannot undergo any further state changes.
 */
export function isRideTerminal(status: RideStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED';
}

/**
 * Checks if a ride can be cancelled by the host.
 */
export function isRideCancellable(status: RideStatus): boolean {
  return status === 'DRAFT' || status === 'PUBLISHED' || status === 'CONFIRMED' || status === 'ACTIVE';
}

export interface RideStatusMeta {
  label: string;
  description: string;
  badgeVariant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  colorClass: string;
  bgClass: string;
}

export const RIDE_STATUS_METADATA: Record<RideStatus, RideStatusMeta> = {
  DRAFT: {
    label: 'Draft',
    description: 'Saved privately. Not visible to passengers.',
    badgeVariant: 'outline',
    colorClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'Open for student join requests along the corridor.',
    badgeVariant: 'default',
    colorClass: 'text-[#003C84] dark:text-[#00A2A5]',
    bgClass: 'bg-[#003C84]/10 dark:bg-[#00A2A5]/10 border-[#003C84]/20',
  },
  CONFIRMED: {
    label: 'Confirmed',
    description: 'At least one passenger request has been confirmed.',
    badgeVariant: 'secondary',
    colorClass: 'text-[#00A2A5] dark:text-[#00A2A5]',
    bgClass: 'bg-[#00A2A5]/10 border-[#00A2A5]/20',
  },
  ACTIVE: {
    label: 'Active (On Route)',
    description: 'Host has started the journey. Live location active.',
    badgeVariant: 'success',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800',
  },
  COMPLETED: {
    label: 'Completed',
    description: 'Journey finished. Coordination chat in 3-hour retention window.',
    badgeVariant: 'secondary',
    colorClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'Ride was cancelled by host.',
    badgeVariant: 'destructive',
    colorClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
  },
  EXPIRED: {
    label: 'Expired',
    description: 'Scheduled departure time passed without activation.',
    badgeVariant: 'outline',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/40 border-border',
  },
};
