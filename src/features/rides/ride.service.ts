import { rideRepository } from './ride.repository';
import { rideSessionService } from './rideSession.service';
import { routeAlertService } from '@/features/matching/routeAlert.service';
import type { Ride, RideWaypoint } from './ride.types';
import type { RideStatus } from '@/types/database';
import {
  createRideSchema,
  updateRideSchema,
  type CreateRideInput,
  type UpdateRideInput,
} from './ride.schema';
import {
  canTransitionRide,
  isRideEditable,
  isRideCancellable,
  isRideTerminal,
} from './ride.state';

export class RideServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown = null
  ) {
    super(message);
    this.name = 'RideServiceError';
  }
}

export const rideService = {
  /**
   * Creates a new ride record.
   * Can be created directly as 'PUBLISHED' or saved as 'DRAFT'.
   */
  async createRide(
    hostId: string,
    rawInput: unknown,
    asDraft: boolean = false
  ): Promise<Ride> {
    if (!hostId) {
      throw new RideServiceError('AUTH_REQUIRED', 'Host student ID is required to create a ride');
    }

    const parseResult = createRideSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new RideServiceError(
        'VALIDATION_ERROR',
        parseResult.error.errors[0]?.message || 'Invalid ride details',
        parseResult.error.errors
      );
    }

    const input: CreateRideInput = parseResult.data;
    const initialStatus: RideStatus = asDraft ? 'DRAFT' : 'PUBLISHED';

    const createdRide = await rideRepository.createRide(hostId, input, initialStatus);

    if (createdRide.status === 'PUBLISHED') {
      routeAlertService.notifySubscribersOnNewRide(createdRide).catch((err) => {
        console.warn('Failed to notify route alert subscribers on new ride:', err);
      });
    }

    return createdRide;
  },

  /**
   * Retrieves a ride by ID with hydrated locations and waypoints.
   */
  async getRide(rideId: string): Promise<Ride> {
    const ride = await rideRepository.getRideById(rideId);
    if (!ride) {
      throw new RideServiceError('RIDE_NOT_FOUND', `Ride with ID ${rideId} was not found`);
    }
    return ride;
  },

  /**
   * Retrieves all waypoints for a ride.
   */
  async getWaypoints(rideId: string): Promise<RideWaypoint[]> {
    return await rideRepository.getWaypointsForRide(rideId);
  },

  /**
   * Lists rides hosted by the given student.
   */
  async listHostRides(hostId: string): Promise<Ride[]> {
    if (!hostId) return [];
    return await rideRepository.listRidesByHost(hostId);
  },

  /**
   * Lists discoverable published and confirmed rides.
   */
  async listPublishedRides(date?: string): Promise<Ride[]> {
    return await rideRepository.listPublishedRides(date);
  },

  /**
   * Updates mutable fields of an editable ride.
   * Only the host can edit, and only in DRAFT or PUBLISHED status.
   */
  async updateRide(
    hostId: string,
    rideId: string,
    rawUpdates: unknown
  ): Promise<Ride> {
    const ride = await this.getRide(rideId);

    if (ride.host_id !== hostId) {
      throw new RideServiceError('FORBIDDEN', 'Only the ride host can modify ride details');
    }

    if (!isRideEditable(ride.status)) {
      throw new RideServiceError(
        'RIDE_INVALID_STATE',
        `Ride cannot be edited in its current status: ${ride.status}. Only DRAFT and PUBLISHED rides are editable.`
      );
    }

    const parseResult = updateRideSchema.safeParse(rawUpdates);
    if (!parseResult.success) {
      throw new RideServiceError(
        'VALIDATION_ERROR',
        parseResult.error.errors[0]?.message || 'Invalid ride updates',
        parseResult.error.errors
      );
    }

    const updates: UpdateRideInput = parseResult.data;
    return await rideRepository.updateRide(rideId, updates);
  },

  /**
   * Core state transition logic enforcing deterministic lifecycle.
   */
  async transitionRideStatus(
    hostId: string,
    rideId: string,
    targetStatus: RideStatus,
    _reason?: string
  ): Promise<Ride> {
    const ride = await this.getRide(rideId);

    if (ride.host_id !== hostId) {
      throw new RideServiceError('FORBIDDEN', 'Only the ride host can update ride status');
    }

    if (ride.status === targetStatus) {
      return ride;
    }

    if (isRideTerminal(ride.status)) {
      throw new RideServiceError(
        'RIDE_INVALID_STATE',
        `Cannot change status of a terminal ride (${ride.status})`
      );
    }

    if (!canTransitionRide(ride.status, targetStatus)) {
      throw new RideServiceError(
        'RIDE_INVALID_STATE',
        `Invalid state transition: Cannot change ride status from ${ride.status} to ${targetStatus}`
      );
    }

    return await rideRepository.updateRideStatus(rideId, targetStatus);
  },

  /**
   * Publishes a DRAFT ride so students can find and request it.
   */
  async publishRide(hostId: string, rideId: string): Promise<Ride> {
    return await this.transitionRideStatus(hostId, rideId, 'PUBLISHED');
  },

  /**
   * Activates a ride when the host starts the journey and initializes the active ride session.
   */
  async startRide(hostId: string, rideId: string): Promise<Ride> {
    const updated = await this.transitionRideStatus(hostId, rideId, 'ACTIVE');
    try {
      await rideSessionService.startSession(hostId, rideId);
    } catch {
      // proceeding defensively if session already created
    }
    return updated;
  },

  /**
   * Marks an active journey as completed and ends the active ride session.
   */
  async completeRide(hostId: string, rideId: string): Promise<Ride> {
    const updated = await this.transitionRideStatus(hostId, rideId, 'COMPLETED');
    try {
      await rideSessionService.endSession(hostId, rideId);
    } catch {
      // proceeding defensively if session already ended
    }
    return updated;
  },

  /**
   * Cancels a ride. Host can cancel in DRAFT, PUBLISHED, CONFIRMED, or ACTIVE state.
   */
  async cancelRide(hostId: string, rideId: string, reason?: string): Promise<Ride> {
    const ride = await this.getRide(rideId);

    if (ride.host_id !== hostId) {
      throw new RideServiceError('FORBIDDEN', 'Only the ride host can cancel this ride');
    }

    if (!isRideCancellable(ride.status)) {
      throw new RideServiceError(
        'RIDE_INVALID_STATE',
        `Cannot cancel ride with status ${ride.status}. Completed or already cancelled rides cannot be cancelled.`
      );
    }

    return await this.transitionRideStatus(hostId, rideId, 'CANCELLED', reason);
  },

  /**
   * Deletes a DRAFT ride completely. Non-draft rides cannot be deleted.
   */
  async deleteDraftRide(hostId: string, rideId: string): Promise<boolean> {
    const ride = await this.getRide(rideId);

    if (ride.host_id !== hostId) {
      throw new RideServiceError('FORBIDDEN', 'Only the host can delete this draft');
    }

    if (ride.status !== 'DRAFT') {
      throw new RideServiceError(
        'RIDE_INVALID_STATE',
        'Only DRAFT rides can be permanently deleted. Use Cancel for active/published rides.'
      );
    }

    return await rideRepository.deleteDraftRide(rideId);
  },

  /**
   * Dismisses a ride from the host's UI immediately, marking it for 2-day auto-purge from the database.
   */
  async dismissRide(hostId: string, rideId: string): Promise<void> {
    if (!hostId || !rideId) return;
    await rideRepository.dismissRide(hostId, rideId);
  },

  /**
   * Dismisses all inactive/completed/cancelled rides for the host from the UI.
   */
  async clearInactiveRides(hostId: string): Promise<void> {
    if (!hostId) return;
    const rides = await rideRepository.listRidesByHost(hostId);
    for (const r of rides) {
      if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status)) {
        await rideRepository.dismissRide(hostId, r.id);
      }
    }
  },
};
