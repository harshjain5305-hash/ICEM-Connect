import { requestRepository } from './request.repository';
import { rideRepository } from '@/features/rides/ride.repository';
import { moderationService } from '@/features/moderation/moderation.service';
import {
  createJoinRequestSchema,
  rejectJoinRequestSchema,
} from './request.schema';
import type {
  JoinRequest,
  RideParticipant,
  CreateJoinRequestInput,
  AcceptRequestResult,
  CancelRequestResult,
} from './request.types';

export class RequestServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'RequestServiceError';
  }
}

/**
 * Calculates absolute difference in minutes between two ride departure date/times.
 * Returns null if dates or times cannot be parsed.
 */
export function getMinutesBetweenRides(
  date1: string,
  time1: string,
  date2: string,
  time2: string
): number | null {
  try {
    const timeParts1 = time1.trim().split(':');
    const timeParts2 = time2.trim().split(':');
    if (timeParts1.length < 2 || timeParts2.length < 2) return null;

    const [y1, m1, d1] = date1.split('-').map(Number);
    const [y2, m2, d2] = date2.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;

    const dt1 = new Date(y1, m1 - 1, d1, Number(timeParts1[0]), Number(timeParts1[1]), 0);
    const dt2 = new Date(y2, m2 - 1, d2, Number(timeParts2[0]), Number(timeParts2[1]), 0);

    const diffMs = Math.abs(dt1.getTime() - dt2.getTime());
    return diffMs / (60 * 1000);
  } catch {
    return null;
  }
}

export const requestService = {
  /**
   * Checks whether the student has any confirmed trip (as confirmed passenger or host)
   * within ±45 minutes of the target departure date and time (Rules.md §13).
   */
  async checkTemporalConflict(
    studentId: string,
    departureDate: string,
    departureTime: string,
    excludeRideId?: string
  ): Promise<{ hasConflict: boolean; message?: string }> {
    if (!studentId || !departureDate || !departureTime) {
      return { hasConflict: false };
    }

    // 1. Check passenger confirmed trips (accepted join requests on active rides)
    const requests = await requestRepository.listRequestsByStudent(studentId);
    for (const req of requests) {
      if (req.status === 'ACCEPTED' && req.ride_id !== excludeRideId) {
        const confirmedRide = req.ride || (await rideRepository.getRideById(req.ride_id));
        if (
          confirmedRide &&
          ['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(confirmedRide.status) &&
          confirmedRide.departure_date &&
          confirmedRide.departure_time
        ) {
          const diffMinutes = getMinutesBetweenRides(
            departureDate,
            departureTime,
            confirmedRide.departure_date,
            confirmedRide.departure_time
          );
          if (diffMinutes !== null && diffMinutes <= 45) {
            return {
              hasConflict: true,
              message: `Cannot request ride: You already have a confirmed trip scheduled at ${confirmedRide.departure_time} on ${confirmedRide.departure_date} (within 45 minutes of ${departureTime})`,
            };
          }
        }
      }
    }

    // 2. Check host scheduled trips (rides being hosted by this student)
    const hostedRides = await rideRepository.listRidesByHost(studentId);
    for (const hostedRide of hostedRides) {
      if (
        hostedRide.id !== excludeRideId &&
        ['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(hostedRide.status) &&
        hostedRide.departure_date &&
        hostedRide.departure_time
      ) {
        const diffMinutes = getMinutesBetweenRides(
          departureDate,
          departureTime,
          hostedRide.departure_date,
          hostedRide.departure_time
        );
        if (diffMinutes !== null && diffMinutes <= 45) {
          return {
            hasConflict: true,
            message: `Cannot request ride: You are already hosting a scheduled trip at ${hostedRide.departure_time} on ${hostedRide.departure_date} (within 45 minutes of ${departureTime})`,
          };
        }
      }
    }

    return { hasConflict: false };
  },

  /**
   * Submits a new join request for a ride.
   */
  async createRequest(
    studentId: string,
    rawInput: unknown
  ): Promise<JoinRequest> {
    if (!studentId) {
      throw new RequestServiceError('UNAUTHORIZED', 'Student must be authenticated');
    }

    const parseResult = createJoinRequestSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new RequestServiceError('VALIDATION_ERROR', issue?.message || 'Invalid join request input');
    }

    const input: CreateJoinRequestInput = parseResult.data;

    // Check account blocking invariant (Rules.md §23)
    const ride = await rideRepository.getRideById(input.ride_id);
    if (ride) {
      const isBlocked = await moderationService.isBlocked(studentId, ride.host_id);
      if (isBlocked) {
        throw new RequestServiceError(
          'BLOCKED_INTERACTION',
          'Cannot request a ride with this user due to account blocking'
        );
      }

      // Check cross-ride temporal conflict within ±45 minutes (Rules.md §13)
      const conflict = await this.checkTemporalConflict(
        studentId,
        ride.departure_date,
        ride.departure_time,
        ride.id
      );
      if (conflict.hasConflict) {
        throw new RequestServiceError(
          'SCHEDULE_CONFLICT',
          conflict.message || 'Schedule conflict: Overlapping trip within 45 minutes'
        );
      }
    }

    try {
      return await requestRepository.createRequest(studentId, input);
    } catch (err: unknown) {
      if (err instanceof RequestServiceError) throw err;
      throw new RequestServiceError('REQUEST_FAILED', (err as Error).message);
    }
  },

  /**
   * Retrieves a join request by its ID.
   */
  async getRequest(requestId: string): Promise<JoinRequest> {
    const req = await requestRepository.getRequestById(requestId);
    if (!req) {
      throw new RequestServiceError('NOT_FOUND', `Join request ${requestId} was not found`);
    }
    return req;
  },

  /**
   * Lists all requests submitted for a specific ride (for the host).
   */
  async listRequestsForRide(rideId: string): Promise<JoinRequest[]> {
    if (!rideId) return [];
    return await requestRepository.listRequestsByRide(rideId);
  },

  /**
   * Lists all requests submitted by a specific student (for the passenger).
   */
  async listRequestsByStudent(studentId: string): Promise<JoinRequest[]> {
    if (!studentId) return [];
    return await requestRepository.listRequestsByStudent(studentId);
  },

  /**
   * Lists all confirmed participants for a ride.
   */
  async listParticipants(rideId: string): Promise<RideParticipant[]> {
    if (!rideId) return [];
    return await requestRepository.listParticipantsByRide(rideId);
  },

  /**
   * Host accepts a pending join request.
   * Decrements capacity atomically, updates request, creates confirmed participant, and sends notification.
   */
  async acceptRequest(hostId: string, requestId: string): Promise<AcceptRequestResult> {
    if (!hostId) {
      throw new RequestServiceError('UNAUTHORIZED', 'Host must be authenticated');
    }
    if (!requestId) {
      throw new RequestServiceError('VALIDATION_ERROR', 'Request ID is required');
    }

    try {
      return await requestRepository.acceptRequest(hostId, requestId);
    } catch (err: unknown) {
      throw new RequestServiceError('ACCEPT_FAILED', (err as Error).message);
    }
  },

  /**
   * Host rejects a pending join request.
   */
  async rejectRequest(
    hostId: string,
    rawInput: unknown
  ): Promise<{ success: boolean; status: 'REJECTED' }> {
    if (!hostId) {
      throw new RequestServiceError('UNAUTHORIZED', 'Host must be authenticated');
    }

    const parseResult = rejectJoinRequestSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new RequestServiceError('VALIDATION_ERROR', 'Invalid rejection input');
    }

    try {
      return await requestRepository.rejectRequest(
        hostId,
        parseResult.data.request_id,
        parseResult.data.reason
      );
    } catch (err: unknown) {
      throw new RequestServiceError('REJECT_FAILED', (err as Error).message);
    }
  },

  /**
   * Passenger cancels their own request (pending or accepted).
   */
  async cancelRequest(studentId: string, requestId: string): Promise<CancelRequestResult> {
    if (!studentId) {
      throw new RequestServiceError('UNAUTHORIZED', 'Student must be authenticated');
    }
    if (!requestId) {
      throw new RequestServiceError('VALIDATION_ERROR', 'Request ID is required');
    }

    try {
      return await requestRepository.cancelRequest(studentId, requestId);
    } catch (err: unknown) {
      throw new RequestServiceError('CANCEL_FAILED', (err as Error).message);
    }
  },

  /**
   * Dismisses a join request from the passenger's UI immediately, marking it for 2-day auto-purge from the database.
   */
  async dismissRequest(studentId: string, requestId: string): Promise<void> {
    if (!studentId || !requestId) return;
    await requestRepository.dismissRequest(studentId, requestId);
  },

  /**
   * Dismisses all inactive/cancelled/rejected requests for the student from the UI.
   */
  async clearInactiveRequests(studentId: string): Promise<void> {
    if (!studentId) return;
    const requests = await requestRepository.listRequestsByStudent(studentId);
    for (const req of requests) {
      if (
        ['CANCELLED', 'REJECTED'].includes(req.status) ||
        (req.status === 'ACCEPTED' && req.ride?.status === 'COMPLETED')
      ) {
        await requestRepository.dismissRequest(studentId, req.id);
      }
    }
  },
};
