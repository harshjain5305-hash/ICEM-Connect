import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { rideRepository } from '@/features/rides/ride.repository';
import { requestRepository } from '@/features/requests/request.repository';
import { authService } from '@/features/auth/auth.service';
import type { RideSession } from '@/features/realtime/realtime.types';
import { isValidUuid } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_SESSIONS_KEY = STORAGE_KEYS.SESSIONS;

function getLocalSessions(): Record<string, RideSession> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSessions(sessions: Record<string, RideSession>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save ride sessions in localStorage:', err);
  }
}

export const rideSessionRepository = {
  /**
   * Verifies whether a student has authorized access to enter the ride room.
   * Conforms to Rules.md §14 and Architecture.md §13.3.
   */
  async verifyRoomAccess(rideId: string, userId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase.rpc('verify_ride_room_access', {
          p_ride_id: rideId,
          p_user_id: userId,
        });
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch (err) {
        console.warn('Live verify_ride_room_access error, checking local store:', err);
      }
    }

    // Local / fallback authorization check
    const ride = await rideRepository.getRideById(rideId);
    if (!ride) return false;

    // 1. Host has access
    if (ride.host_id === userId) return true;

    // 2. Confirmed participant has access
    const participants = await requestRepository.listParticipantsByRide(rideId);
    const isConfirmed = participants.some(
      (p) => p.student_id === userId && p.status === 'CONFIRMED'
    );
    if (isConfirmed) return true;

    // 3. Admin has access
    const roles = await authService.getUserRoles(userId);
    if (roles.includes('ADMIN')) return true;

    return false;
  },

  /**
   * Starts an active ride session and updates the ride status to ACTIVE.
   */
  async startSession(rideId: string, hostId: string): Promise<RideSession> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(hostId)) {
      try {
        const { data, error } = await supabase.rpc('start_ride_session', {
          p_ride_id: rideId,
          p_host_id: hostId,
        });

        if (!error && data && (data as { session_id?: string }).session_id) {
          const res = data as { session_id: string; started_at: string; status: 'ACTIVE' };
          const session: RideSession = {
            id: res.session_id,
            ride_id: rideId,
            started_at: res.started_at,
            ended_at: null,
            status: 'ACTIVE',
            location_enabled: true,
            last_location_at: null,
            created_at: res.started_at,
          };
          const sessions = getLocalSessions();
          sessions[rideId] = session;
          saveLocalSessions(sessions);
          return session;
        }
        if (error) {
          console.warn('Live start_ride_session RPC returned error, using local fallback:', error.message);
        }
      } catch (err) {
        console.warn('Live start_ride_session error:', err);
      }
    }

    // Local fallback
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

    // Update ride status to ACTIVE
    await rideRepository.updateRideStatus(rideId, 'ACTIVE');

    const sessions = getLocalSessions();
    const existing = sessions[rideId];
    const now = new Date().toISOString();

    const session: RideSession = {
      id: existing?.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ride_id: rideId,
      started_at: now,
      ended_at: null,
      status: 'ACTIVE',
      location_enabled: true,
      last_location_at: null,
      created_at: existing?.created_at || now,
    };

    sessions[rideId] = session;
    saveLocalSessions(sessions);
    return session;
  },

  /**
   * Ends an active ride session and updates the ride status to COMPLETED.
   */
  async endSession(rideId: string, hostId: string): Promise<RideSession> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(hostId)) {
      try {
        const { data, error } = await supabase.rpc('end_ride_session', {
          p_ride_id: rideId,
          p_host_id: hostId,
        });

        if (!error && data && (data as { session_id?: string }).session_id) {
          const res = data as { session_id: string; ended_at: string };
          const sessions = getLocalSessions();
          const existing = sessions[rideId] || {
            id: res.session_id,
            ride_id: rideId,
            started_at: new Date().toISOString(),
            ended_at: res.ended_at,
            status: 'ENDED',
            location_enabled: false,
            last_location_at: null,
            created_at: new Date().toISOString(),
          };
          existing.status = 'ENDED';
          existing.ended_at = res.ended_at;
          existing.location_enabled = false;
          sessions[rideId] = existing;
          saveLocalSessions(sessions);
          return existing;
        }
        if (error) {
          console.warn('Live end_ride_session RPC returned error, using local fallback:', error.message);
        }
      } catch (err) {
        console.warn('Live end_ride_session error:', err);
      }
    }

    // Local fallback
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

    // Update ride status to COMPLETED
    await rideRepository.updateRideStatus(rideId, 'COMPLETED');

    const sessions = getLocalSessions();
    const existing = sessions[rideId];
    const now = new Date().toISOString();

    const session: RideSession = {
      id: existing?.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ride_id: rideId,
      started_at: existing?.started_at || now,
      ended_at: now,
      status: 'ENDED',
      location_enabled: false,
      last_location_at: existing?.last_location_at || null,
      created_at: existing?.created_at || now,
    };

    sessions[rideId] = session;
    saveLocalSessions(sessions);
    return session;
  },

  /**
   * Retrieves the active session for a ride with strict authorization checks.
   */
  async getActiveSession(rideId: string, userId: string): Promise<RideSession | null> {
    const isAuthorized = await this.verifyRoomAccess(rideId, userId);
    if (!isAuthorized) {
      throw new Error('Forbidden: Access to active ride session is restricted to confirmed participants and host.');
    }

    const isLive = isSupabaseConfigured();
    if (isLive && isValidUuid(rideId) && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase.rpc('get_active_ride_session', {
          p_ride_id: rideId,
          p_user_id: userId,
        });

        if (!error && data) {
          return data as unknown as RideSession;
        }
      } catch (err) {
        console.warn('Live get_active_ride_session error:', err);
      }
    }

    const sessions = getLocalSessions();
    const session = sessions[rideId];
    if (session && session.status === 'ACTIVE') {
      return session;
    }
    return null;
  },
};
