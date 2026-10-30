import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { rideRepository } from '@/features/rides/ride.repository';
import { requestRepository } from '@/features/requests/request.repository';
import { authService } from '@/features/auth/auth.service';
import type { RideMessage, ChatAccessCheckResult } from './rideMessage.types';
import { isValidUuid } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/localStorage';

const LOCAL_STORAGE_MESSAGES_KEY = STORAGE_KEYS.MESSAGES;

function getLocalMessages(): RideMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(messages: RideMessage[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save ride messages to localStorage:', err);
  }
}

export const rideMessageRepository = {
  /**
   * Check whether a student has authorized access to read/send in ride chat.
   * Conforms to Architecture.md §47.4.
   */
  async checkChatAccess(rideId: string, userId: string): Promise<ChatAccessCheckResult> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase.rpc('verify_ride_chat_access', {
          p_ride_id: rideId,
          p_user_id: userId,
        });

        if (!error && data && typeof data === 'object') {
          return {
            can_read: Boolean(data.can_read),
            can_send: Boolean(data.can_send),
            is_read_only: Boolean(data.is_read_only),
            reason: data.reason,
          };
        }
      } catch (err) {
        console.warn('Live verify_ride_chat_access error, falling back to local:', err);
      }
    }

    // Local / fallback authorization check
    const ride = await rideRepository.getRideById(rideId);
    if (!ride) {
      return {
        can_read: false,
        can_send: false,
        is_read_only: false,
        reason: 'Ride not found',
      };
    }

    const isReadOnly = ['COMPLETED', 'CANCELLED'].includes(ride.status);
    const roles = await authService.getUserRoles(userId);
    const isAdmin = roles.includes('ADMIN');

    // 1. Host
    if (ride.host_id === userId) {
      return {
        can_read: true,
        can_send: !isReadOnly,
        is_read_only: isReadOnly,
        reason: isReadOnly ? 'Ride completed or cancelled. Chat is read-only.' : undefined,
      };
    }

    // 2. Confirmed or completed participant
    const participants = await requestRepository.listParticipantsByRide(rideId);
    const isConfirmed = participants.some(
      (p) => p.student_id === userId && ['CONFIRMED', 'COMPLETED'].includes(p.status)
    );
    if (isConfirmed) {
      return {
        can_read: true,
        can_send: !isReadOnly,
        is_read_only: isReadOnly,
        reason: isReadOnly ? 'Ride completed or cancelled. Chat is read-only.' : undefined,
      };
    }

    // 3. Pending requester
    const requests = await requestRepository.listRequestsByRide(rideId);
    const hasPendingRequest = requests.some(
      (r) => r.student_id === userId && r.status === 'PENDING'
    );

    if (hasPendingRequest) {
      if (ride.available_seats <= 0) {
        return {
          can_read: true,
          can_send: false,
          is_read_only: isReadOnly,
          reason: 'Ride is at full capacity. Coordination chat is restricted to confirmed passengers.',
        };
      }
      return {
        can_read: true,
        can_send: !isReadOnly,
        is_read_only: isReadOnly,
        reason: isReadOnly ? 'Ride completed or cancelled. Chat is read-only.' : undefined,
      };
    }

    // 4. Admin
    if (isAdmin) {
      return {
        can_read: true,
        can_send: !isReadOnly,
        is_read_only: isReadOnly,
      };
    }

    return {
      can_read: false,
      can_send: false,
      is_read_only: isReadOnly,
      reason: 'Forbidden: You are not authorized to view coordination chat for this ride',
    };
  },

  /**
   * Sends a coordination message for a specific ride.
   * Conforms to Architecture.md §47.5.
   */
  async sendMessage(rideId: string, senderId: string, message: string): Promise<RideMessage> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(senderId)) {
      try {
        const { data, error } = await supabase.rpc('send_ride_message', {
          p_ride_id: rideId,
          p_sender_id: senderId,
          p_message: message,
        });

        if (!error && data) {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          return {
            id: parsed.id,
            ride_id: parsed.ride_id,
            sender_id: parsed.sender_id,
            sender_name: parsed.sender_name,
            message: parsed.message,
            created_at: parsed.created_at,
            expires_at: parsed.expires_at,
          };
        } else if (error) {
          throw new Error(error.message);
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Forbidden') || err.message.includes('read-only') || err.message.includes('full capacity'))) {
          throw err;
        }
        console.warn('Live send_ride_message error, falling back to local storage:', err);
      }
    }

    // Local / fallback handling
    const access = await this.checkChatAccess(rideId, senderId);
    if (!access.can_send) {
      throw new Error(access.reason || 'Forbidden: You cannot send messages for this ride');
    }

    const senderProfile = await authService.getProfile(senderId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const newMsg: RideMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ride_id: rideId,
      sender_id: senderId,
      sender_name: senderProfile?.name || 'Student',
      message: message.trim(),
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };

    const messages = getLocalMessages();
    messages.push(newMsg);
    saveLocalMessages(messages);

    return newMsg;
  },

  /**
   * Retrieves active, non-expired messages for a ride.
   * Conforms to Architecture.md §47.5 & §47.7.
   */
  async getMessages(rideId: string, userId: string): Promise<RideMessage[]> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase.rpc('get_ride_messages', {
          p_ride_id: rideId,
          p_user_id: userId,
        });

        if (!error && data) {
          const list = typeof data === 'string' ? JSON.parse(data) : data;
          if (Array.isArray(list)) {
            return list.map((item: any) => ({
              id: item.id,
              ride_id: item.ride_id,
              sender_id: item.sender_id,
              sender_name: item.sender_name,
              message: item.message,
              created_at: item.created_at,
              expires_at: item.expires_at,
            }));
          }
        } else if (error) {
          throw new Error(error.message);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Forbidden')) {
          throw err;
        }
        console.warn('Live get_ride_messages error, falling back to local:', err);
      }
    }

    // Local / fallback handling
    const access = await this.checkChatAccess(rideId, userId);
    if (!access.can_read) {
      throw new Error(access.reason || 'Forbidden: You do not have access to messages for this ride');
    }

    const nowIso = new Date().toISOString();
    const messages = getLocalMessages().filter(
      (m) => m.ride_id === rideId && m.expires_at > nowIso
    );

    return messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  /**
   * Deletes expired messages from storage.
   * Conforms to Architecture.md §47.7.
   */
  async cleanupExpiredMessages(): Promise<number> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data, error } = await supabase.rpc('cleanup_expired_ride_messages');
        if (!error && typeof data === 'number') {
          return data;
        }
      } catch (err) {
        console.warn('Live cleanup_expired_ride_messages error:', err);
      }
    }

    const nowIso = new Date().toISOString();
    const all = getLocalMessages();
    const kept = all.filter((m) => m.expires_at > nowIso);
    const deletedCount = all.length - kept.length;
    saveLocalMessages(kept);
    return deletedCount;
  },

  /**
   * Sets the expiry of all messages for a completed ride to 3 hours from now.
   * Conforms to Architecture.md §47.7 & §47.8.
   */
  async capMessagesExpiryOnCompletion(rideId: string): Promise<void> {
    const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const all = getLocalMessages();
    let updated = false;

    const modified = all.map((m) => {
      if (m.ride_id === rideId) {
        updated = true;
        return {
          ...m,
          expires_at: m.expires_at < threeHoursFromNow ? m.expires_at : threeHoursFromNow,
        };
      }
      return m;
    });

    if (updated) {
      saveLocalMessages(modified);
    }
  },
};
