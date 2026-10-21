import { describe, it, expect } from 'vitest';
import {
  canTransitionRide,
  getAllowedTransitions,
  isRideEditable,
  isRideTerminal,
  isRideCancellable,
  RIDE_STATUS_METADATA,
} from './ride.state';
import type { RideStatus } from '@/types/database';

describe('Ride State Machine (Phase 3)', () => {
  describe('canTransitionRide', () => {
    it('allows valid progressive transitions', () => {
      expect(canTransitionRide('DRAFT', 'PUBLISHED')).toBe(true);
      expect(canTransitionRide('PUBLISHED', 'CONFIRMED')).toBe(true);
      expect(canTransitionRide('PUBLISHED', 'ACTIVE')).toBe(true);
      expect(canTransitionRide('CONFIRMED', 'ACTIVE')).toBe(true);
      expect(canTransitionRide('ACTIVE', 'COMPLETED')).toBe(true);
    });

    it('allows cancellation from non-terminal states', () => {
      expect(canTransitionRide('DRAFT', 'CANCELLED')).toBe(true);
      expect(canTransitionRide('PUBLISHED', 'CANCELLED')).toBe(true);
      expect(canTransitionRide('CONFIRMED', 'CANCELLED')).toBe(true);
      expect(canTransitionRide('ACTIVE', 'CANCELLED')).toBe(true);
    });

    it('allows expiration from scheduled non-active states', () => {
      expect(canTransitionRide('PUBLISHED', 'EXPIRED')).toBe(true);
      expect(canTransitionRide('CONFIRMED', 'EXPIRED')).toBe(true);
    });

    it('rejects illegal jumps or skipping states', () => {
      // Cannot start or complete directly from DRAFT
      expect(canTransitionRide('DRAFT', 'ACTIVE')).toBe(false);
      expect(canTransitionRide('DRAFT', 'COMPLETED')).toBe(false);
      // Cannot expire a ride once active
      expect(canTransitionRide('ACTIVE', 'EXPIRED')).toBe(false);
    });

    it('rejects transitioning from terminal states', () => {
      const terminalStates: RideStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];
      const allTargets: RideStatus[] = [
        'DRAFT',
        'PUBLISHED',
        'CONFIRMED',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
      ];

      for (const terminal of terminalStates) {
        for (const target of allTargets) {
          expect(canTransitionRide(terminal, target)).toBe(false);
        }
      }
    });

    it('rejects self-transitions to the same state', () => {
      expect(canTransitionRide('PUBLISHED', 'PUBLISHED')).toBe(false);
      expect(canTransitionRide('ACTIVE', 'ACTIVE')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns expected next targets for DRAFT', () => {
      expect(getAllowedTransitions('DRAFT')).toEqual(['PUBLISHED', 'CANCELLED']);
    });

    it('returns empty array for terminal states', () => {
      expect(getAllowedTransitions('COMPLETED')).toEqual([]);
      expect(getAllowedTransitions('CANCELLED')).toEqual([]);
      expect(getAllowedTransitions('EXPIRED')).toEqual([]);
    });
  });

  describe('isRideEditable', () => {
    it('allows editing DRAFT and PUBLISHED rides', () => {
      expect(isRideEditable('DRAFT')).toBe(true);
      expect(isRideEditable('PUBLISHED')).toBe(true);
    });

    it('prohibits editing ACTIVE, COMPLETED, or CANCELLED rides', () => {
      expect(isRideEditable('CONFIRMED')).toBe(false);
      expect(isRideEditable('ACTIVE')).toBe(false);
      expect(isRideEditable('COMPLETED')).toBe(false);
      expect(isRideEditable('CANCELLED')).toBe(false);
      expect(isRideEditable('EXPIRED')).toBe(false);
    });
  });

  describe('isRideTerminal', () => {
    it('identifies terminal statuses correctly', () => {
      expect(isRideTerminal('COMPLETED')).toBe(true);
      expect(isRideTerminal('CANCELLED')).toBe(true);
      expect(isRideTerminal('EXPIRED')).toBe(true);

      expect(isRideTerminal('DRAFT')).toBe(false);
      expect(isRideTerminal('PUBLISHED')).toBe(false);
      expect(isRideTerminal('CONFIRMED')).toBe(false);
      expect(isRideTerminal('ACTIVE')).toBe(false);
    });
  });

  describe('isRideCancellable', () => {
    it('allows cancellation prior to completion', () => {
      expect(isRideCancellable('DRAFT')).toBe(true);
      expect(isRideCancellable('PUBLISHED')).toBe(true);
      expect(isRideCancellable('CONFIRMED')).toBe(true);
      expect(isRideCancellable('ACTIVE')).toBe(true);
    });

    it('prohibits cancelling terminal rides', () => {
      expect(isRideCancellable('COMPLETED')).toBe(false);
      expect(isRideCancellable('CANCELLED')).toBe(false);
      expect(isRideCancellable('EXPIRED')).toBe(false);
    });
  });

  describe('RIDE_STATUS_METADATA', () => {
    it('contains metadata definitions for every valid RideStatus', () => {
      const statuses: RideStatus[] = [
        'DRAFT',
        'PUBLISHED',
        'CONFIRMED',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
      ];

      for (const s of statuses) {
        const meta = RIDE_STATUS_METADATA[s];
        expect(meta).toBeDefined();
        expect(meta.label).toBeTruthy();
        expect(meta.description).toBeTruthy();
        expect(meta.badgeVariant).toBeTruthy();
      }
    });
  });
});
