import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { rideSessionRepository } from '@/features/rides/rideSession.repository';
import type {
  RealtimeConnectionState,
  RealtimeRideEvent,
  RoomPresenceUser,
  RideRoomSubscription,
  RideRoomSubscriptionOptions,
} from './realtime.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Internal event bus for deterministic multi-client testing & offline fallback
type EventCallback = (event: RealtimeRideEvent) => void;
type PresenceCallback = (users: RoomPresenceUser[]) => void;
type ConnectionCallback = (state: RealtimeConnectionState) => void;

interface RoomRegistration {
  userId: string;
  user: RoomPresenceUser;
  onEvent?: EventCallback;
  onPresence?: PresenceCallback;
  onConnection?: ConnectionCallback;
}

const localRoomRegistrations = new Map<string, Set<RoomRegistration>>();
const localLiveChannels = new Map<string, RealtimeChannel>();

export const realtimeService = {
  /**
   * Generates the canonical private channel name for a ride room.
   * Conforms to Phases.md §12: ride:{rideId}.
   */
  getChannelName(rideId: string): string {
    return `ride:${rideId}`;
  },

  /**
   * Authorizes whether a student can access the private ride room.
   * Conforms to Rules.md §14 and Architecture.md §13.3.
   */
  async canAccessRideRoom(rideId: string, userId: string): Promise<boolean> {
    return await rideSessionRepository.verifyRoomAccess(rideId, userId);
  },

  /**
   * Subscribes an authorized user to a private ride room channel.
   * Enforces server authorization, connection state tracking, event dispatch, and presence sync.
   */
  async subscribeToRideRoom(
    rideId: string,
    userId: string,
    userName: string,
    role: 'HOST' | 'PASSENGER',
    options?: RideRoomSubscriptionOptions
  ): Promise<RideRoomSubscription> {
    const channelName = this.getChannelName(rideId);

    // 1. Enforce authorization boundary
    const isAuthorized = await this.canAccessRideRoom(rideId, userId);
    if (!isAuthorized) {
      options?.onConnectionChange?.('ERROR');
      const err = new Error(`Forbidden: User ${userId} is not authorized to access ride room ${channelName}`);
      options?.onError?.(err);
      throw err;
    }

    options?.onConnectionChange?.('CONNECTING');

    const currentUser: RoomPresenceUser = {
      user_id: userId,
      name: userName,
      role,
      online_at: new Date().toISOString(),
    };

    const registration: RoomRegistration = {
      userId,
      user: currentUser,
      onEvent: options?.onEvent,
      onPresence: options?.onPresenceSync,
      onConnection: options?.onConnectionChange,
    };

    if (!localRoomRegistrations.has(rideId)) {
      localRoomRegistrations.set(rideId, new Set());
    }
    const roomSet = localRoomRegistrations.get(rideId)!;
    roomSet.add(registration);

    // Trigger local presence sync
    const notifyPresence = () => {
      const currentUsers = Array.from(roomSet).map((r) => r.user);
      for (const reg of roomSet) {
        reg.onPresence?.(currentUsers);
      }
    };
    notifyPresence();

    const isLive = isSupabaseConfigured();
    let supabaseChannel: RealtimeChannel | null = null;

    if (isLive) {
      try {
        supabaseChannel = supabase.channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: userId },
          },
        });

        // Listen for all broadcast events on the ride channel
        supabaseChannel
          .on('broadcast', { event: '*' }, ({ payload }) => {
            if (payload && payload.type) {
              const rideEvent = payload as RealtimeRideEvent;
              for (const reg of roomSet) {
                reg.onEvent?.(rideEvent);
              }
            }
          })
          .on('presence', { event: 'sync' }, () => {
            const state = supabaseChannel?.presenceState<{ name: string; role: 'HOST' | 'PASSENGER' }>() || {};
            const liveUsers: RoomPresenceUser[] = [];
            for (const [key, presences] of Object.entries(state)) {
              for (const p of presences) {
                liveUsers.push({
                  user_id: key,
                  name: p.name || 'Student',
                  role: p.role || 'PASSENGER',
                  online_at: new Date().toISOString(),
                });
              }
            }
            if (liveUsers.length > 0) {
              for (const reg of roomSet) {
                reg.onPresence?.(liveUsers);
              }
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              supabaseChannel?.track({ name: userName, role });
              options?.onConnectionChange?.('CONNECTED');
            } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
              options?.onConnectionChange?.('RECONNECTING');
            } else if (status === 'CHANNEL_ERROR') {
              options?.onConnectionChange?.('ERROR');
            }
          });

        localLiveChannels.set(rideId, supabaseChannel);
      } catch (err) {
        console.warn('Realtime channel subscription error, falling back to local bus:', err);
        options?.onConnectionChange?.('CONNECTED');
      }
    } else {
      // Deterministic immediate connected status in test/mock mode
      options?.onConnectionChange?.('CONNECTED');
    }

    let connectionState: RealtimeConnectionState = 'CONNECTED';

    const subscription: RideRoomSubscription = {
      ride_id: rideId,
      getConnectionState: () => connectionState,
      broadcast: async (event: RealtimeRideEvent): Promise<boolean> => {
        // Enforce re-authorization check on every emission
        const stillAuthorized = await this.canAccessRideRoom(rideId, userId);
        if (!stillAuthorized) {
          throw new Error('Forbidden: Unauthorized to broadcast on ride channel.');
        }

        // Broadcast to local room subscribers
        const subscribers = localRoomRegistrations.get(rideId);
        if (subscribers) {
          for (const sub of subscribers) {
            sub.onEvent?.(event);
          }
        }

        // Broadcast to live Supabase channel if active
        if (supabaseChannel) {
          try {
            await supabaseChannel.send({
              type: 'broadcast',
              event: event.type,
              payload: event,
            });
          } catch (err) {
            console.warn('Supabase Realtime broadcast send error:', err);
          }
        }

        return true;
      },
      unsubscribe: () => {
        connectionState = 'DISCONNECTED';
        options?.onConnectionChange?.('DISCONNECTED');
        roomSet.delete(registration);
        notifyPresence();

        if (roomSet.size === 0) {
          localRoomRegistrations.delete(rideId);
          if (supabaseChannel) {
            supabase.removeChannel(supabaseChannel);
            localLiveChannels.delete(rideId);
          }
        }
      },
    };

    return subscription;
  },

  /**
   * Directly broadcasts a lifecycle event to all subscribers of a ride room.
   */
  async broadcastRideEvent(rideId: string, event: RealtimeRideEvent): Promise<void> {
    const subscribers = localRoomRegistrations.get(rideId);
    if (subscribers) {
      for (const sub of subscribers) {
        sub.onEvent?.(event);
      }
    }

    const liveChannel = localLiveChannels.get(rideId);
    if (liveChannel) {
      try {
        await liveChannel.send({
          type: 'broadcast',
          event: event.type,
          payload: event,
        });
      } catch (err) {
        console.warn('Supabase Realtime broadcast send error:', err);
      }
    }
  },

  /**
   * Cleans up all active subscriptions and presence (useful in test teardown).
   */
  reset(): void {
    localRoomRegistrations.clear();
    for (const channel of localLiveChannels.values()) {
      supabase.removeChannel(channel);
    }
    localLiveChannels.clear();
  },
};
