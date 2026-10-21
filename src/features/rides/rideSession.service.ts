import { rideSessionRepository } from './rideSession.repository';
import { rideRepository } from './ride.repository';
import { requestRepository } from '@/features/requests/request.repository';
import { notificationService } from '@/features/notifications/notification.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { RideSession } from '@/features/realtime/realtime.types';

export const rideSessionService = {
  /**
   * Starts an active ride session.
   * Conforms to Phases.md §12, Architecture.md §12.1, and Rules.md §14.
   */
  async startSession(hostId: string, rideId: string): Promise<RideSession> {
    const ride = await rideRepository.getRideById(rideId);
    if (!ride) {
      throw new Error(`Ride with ID ${rideId} not found`);
    }

    if (ride.host_id !== hostId) {
      throw new Error('Forbidden: Only the ride host can start an active ride session');
    }

    if (!['PUBLISHED', 'CONFIRMED', 'ACTIVE'].includes(ride.status)) {
      throw new Error(`Cannot start ride with status ${ride.status}. Ride must be PUBLISHED or CONFIRMED.`);
    }

    const session = await rideSessionRepository.startSession(rideId, hostId);

    // Broadcast session started event to ride room
    await realtimeService.broadcastRideEvent(rideId, {
      type: 'ride:session_started',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        session_id: session.id,
        host_id: hostId,
        started_at: session.started_at,
      },
    });

    // Broadcast ride status changed event
    await realtimeService.broadcastRideEvent(rideId, {
      type: 'ride:status_changed',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        old_status: ride.status,
        new_status: 'ACTIVE',
        updated_at: session.started_at,
      },
    });

    // Notify all confirmed participants
    const participants = await requestRepository.listParticipantsByRide(rideId);
    for (const p of participants) {
      if (p.status === 'CONFIRMED') {
        await notificationService.notify({
          user_id: p.student_id,
          title: 'Ride Started — Live Trip Active',
          message: 'Your host has departed and started the journey. Tap to view active ride session.',
          type: 'RIDE_CONFIRMED',
          data: {
            ride_id: rideId,
            session_id: session.id,
            action: 'RIDE_STARTED',
          },
        });
      }
    }

    return session;
  },

  /**
   * Ends an active ride session and completes the journey.
   */
  async endSession(hostId: string, rideId: string): Promise<RideSession> {
    const ride = await rideRepository.getRideById(rideId);
    if (!ride) {
      throw new Error(`Ride with ID ${rideId} not found`);
    }

    if (ride.host_id !== hostId) {
      throw new Error('Forbidden: Only the ride host can end this ride session');
    }

    if (!['ACTIVE', 'COMPLETED'].includes(ride.status)) {
      throw new Error(`Cannot complete ride with status ${ride.status}. Ride must be ACTIVE.`);
    }

    const session = await rideSessionRepository.endSession(rideId, hostId);

    // Broadcast session ended event to ride room
    await realtimeService.broadcastRideEvent(rideId, {
      type: 'ride:session_ended',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        session_id: session.id,
        host_id: hostId,
        ended_at: session.ended_at || new Date().toISOString(),
      },
    });

    // Broadcast ride status changed event
    await realtimeService.broadcastRideEvent(rideId, {
      type: 'ride:status_changed',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        old_status: 'ACTIVE',
        new_status: 'COMPLETED',
        updated_at: session.ended_at || new Date().toISOString(),
      },
    });

    // Notify all participants to rate the host
    const participants = await requestRepository.listParticipantsByRide(rideId);
    for (const p of participants) {
      await notificationService.notify({
        user_id: p.student_id,
        title: 'Trip Completed — Rate Your Host',
        message: 'You have safely arrived at your destination. Tap to rate your ride experience.',
        type: 'SYSTEM',
        data: {
          ride_id: rideId,
          action: 'RIDE_COMPLETED',
        },
      });
    }

    return session;
  },

  /**
   * Retrieves the current active session for a ride with participant authorization.
   */
  async getActiveSession(rideId: string, userId: string): Promise<RideSession | null> {
    return await rideSessionRepository.getActiveSession(rideId, userId);
  },

  /**
   * Checks whether a ride currently has an active session.
   */
  async isSessionActive(rideId: string, hostOrParticipantId?: string): Promise<boolean> {
    const ride = await rideRepository.getRideById(rideId);
    if (!ride || ride.status !== 'ACTIVE') {
      return false;
    }
    if (hostOrParticipantId) {
      try {
        const session = await rideSessionRepository.getActiveSession(rideId, hostOrParticipantId);
        return Boolean(session && session.status === 'ACTIVE');
      } catch {
        return false;
      }
    }
    return ride.status === 'ACTIVE';
  },
};
