import { rideMessageRepository } from './rideMessage.repository';
import { sendRideMessageSchema } from './rideMessage.schema';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { RideMessage, ChatAccessCheckResult } from './rideMessage.types';

// Rate limiting map: sender_id -> last_sent_timestamp
const lastMessageTimeBySender = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 500; // Minimum 500ms between messages

export const rideMessageService = {
  /**
   * Validates and sends a coordination message for a specific ride.
   * Conforms to Architecture.md §47.5 & §47.10.
   */
  async sendMessage(rideId: string, senderId: string, messageText: string): Promise<RideMessage> {
    // 1. Zod schema validation
    const validation = sendRideMessageSchema.safeParse({
      ride_id: rideId,
      message: messageText,
    });

    if (!validation.success) {
      const errorMsg = validation.error.errors[0]?.message || 'Invalid message';
      throw new Error(errorMsg);
    }

    // 2. Client-side rate-limiting guard (Architecture.md §47.10)
    const now = Date.now();
    const lastSent = lastMessageTimeBySender.get(senderId);
    if (lastSent && now - lastSent < RATE_LIMIT_COOLDOWN_MS) {
      throw new Error('Please wait a moment before sending another message.');
    }
    lastMessageTimeBySender.set(senderId, now);

    // 3. Persist message to repository (database / server boundary)
    const savedMessage = await rideMessageRepository.sendMessage(
      rideId,
      senderId,
      validation.data.message
    );

    // 4. Security & Privacy Audit: Log metadata ONLY, NEVER message body (Architecture.md §47.10)
    console.info('ride.message.sent', {
      rideId,
      senderId,
      messageId: savedMessage.id,
      timestamp: savedMessage.created_at,
    });

    // 5. Broadcast to ride room via Supabase Realtime (Architecture.md §47.6)
    try {
      await realtimeService.broadcastRideEvent(rideId, {
        type: 'ride:message:new',
        ride_id: rideId,
        timestamp: savedMessage.created_at,
        payload: {
          message_id: savedMessage.id,
          ride_id: savedMessage.ride_id,
          sender_id: savedMessage.sender_id,
          sender_name: savedMessage.sender_name,
          message: savedMessage.message,
          created_at: savedMessage.created_at,
          expires_at: savedMessage.expires_at,
        },
      });
    } catch (err) {
      console.warn('Realtime broadcast failed, message safely saved in DB:', err);
    }

    return savedMessage;
  },

  /**
   * Retrieves active, non-expired coordination messages for an authorized user.
   * Conforms to Architecture.md §47.5.
   */
  async getMessages(rideId: string, userId: string): Promise<RideMessage[]> {
    if (!rideId || !userId) {
      throw new Error('Ride ID and User ID are required');
    }
    return rideMessageRepository.getMessages(rideId, userId);
  },

  /**
   * Checks authorization and read-only status for chat access.
   */
  async checkChatAccess(rideId: string, userId: string): Promise<ChatAccessCheckResult> {
    if (!rideId || !userId) {
      return {
        can_read: false,
        can_send: false,
        is_read_only: false,
        reason: 'Missing credentials',
      };
    }
    return rideMessageRepository.checkChatAccess(rideId, userId);
  },

  /**
   * Cleans up expired messages across the system.
   * Conforms to Architecture.md §47.7.
   */
  async cleanupExpiredMessages(): Promise<number> {
    return rideMessageRepository.cleanupExpiredMessages();
  },

  /**
   * Caps message expiry to 3 hours upon ride completion.
   * Conforms to Architecture.md §47.7 & §47.8.
   */
  async capMessagesExpiryOnCompletion(rideId: string): Promise<void> {
    return rideMessageRepository.capMessagesExpiryOnCompletion(rideId);
  },

  /**
   * Clears internal rate limit cache (used in testing and session reset).
   */
  clearRateLimitCache(): void {
    lastMessageTimeBySender.clear();
  },
};
