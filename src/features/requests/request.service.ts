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

export const requestService = {
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
};
