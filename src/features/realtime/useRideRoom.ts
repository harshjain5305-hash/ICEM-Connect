import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeService } from './realtime.service';
import { rideSessionService } from '@/features/rides/rideSession.service';
import type {
  RealtimeConnectionState,
  RealtimeRideEvent,
  RoomPresenceUser,
  RideSession,
  RideRoomSubscription,
} from './realtime.types';
import type { StudentProfile } from '@/features/auth/auth.types';

export interface UseRideRoomOptions {
  rideId: string;
  user: StudentProfile | null;
  isHost: boolean;
  onEvent?: (event: RealtimeRideEvent) => void;
}

export function useRideRoom({ rideId, user, isHost, onEvent }: UseRideRoomOptions) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('DISCONNECTED');
  const [activeSession, setActiveSession] = useState<RideSession | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<RoomPresenceUser[]>([]);
  const [lastEvent, setLastEvent] = useState<RealtimeRideEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const subscriptionRef = useRef<RideRoomSubscription | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Fetch initial active session state if user is authorized
  const loadInitialSession = useCallback(async () => {
    if (!rideId || !user) return;
    try {
      const session = await rideSessionService.getActiveSession(rideId, user.id);
      setActiveSession(session);
    } catch {
      setActiveSession(null);
    }
  }, [rideId, user]);

  useEffect(() => {
    if (!rideId || !user) {
      setConnectionState('DISCONNECTED');
      setActiveSession(null);
      setPresenceUsers([]);
      return;
    }

    let isMounted = true;
    setError(null);
    loadInitialSession();

    const role: 'HOST' | 'PASSENGER' = isHost ? 'HOST' : 'PASSENGER';

    realtimeService
      .subscribeToRideRoom(rideId, user.id, user.name, role, {
        onConnectionChange: (state) => {
          if (isMounted) setConnectionState(state);
        },
        onPresenceSync: (users) => {
          if (isMounted) setPresenceUsers(users);
        },
        onEvent: (event) => {
          if (!isMounted) return;
          setLastEvent(event);
          onEventRef.current?.(event);

          if (event.type === 'ride:session_started') {
            setActiveSession({
              id: event.payload.session_id,
              ride_id: rideId,
              started_at: event.payload.started_at,
              ended_at: null,
              status: 'ACTIVE',
              location_enabled: true,
              last_location_at: null,
              created_at: event.payload.started_at,
            });
          } else if (event.type === 'ride:session_ended') {
            setActiveSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'ENDED',
                    ended_at: event.payload.ended_at,
                    location_enabled: false,
                  }
                : null
            );
          }
        },
        onError: (err) => {
          if (isMounted) {
            setError(err.message);
            setConnectionState('ERROR');
          }
        },
      })
      .then((sub) => {
        if (isMounted) {
          subscriptionRef.current = sub;
        } else {
          sub.unsubscribe();
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setConnectionState('ERROR');
        }
      });

    return () => {
      isMounted = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [rideId, user, isHost, loadInitialSession]);

  const startSession = useCallback(async () => {
    if (!user || !isHost) return null;
    setIsStarting(true);
    setError(null);
    try {
      const session = await rideSessionService.startSession(user.id, rideId);
      setActiveSession(session);
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start ride session';
      setError(msg);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [rideId, user, isHost]);

  const endSession = useCallback(async () => {
    if (!user || !isHost) return null;
    setIsEnding(true);
    setError(null);
    try {
      const session = await rideSessionService.endSession(user.id, rideId);
      setActiveSession(session);
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to end ride session';
      setError(msg);
      throw err;
    } finally {
      setIsEnding(false);
    }
  }, [rideId, user, isHost]);

  const broadcast = useCallback(
    async (event: RealtimeRideEvent) => {
      if (subscriptionRef.current) {
        return await subscriptionRef.current.broadcast(event);
      }
      return false;
    },
    []
  );

  return {
    connectionState,
    activeSession,
    presenceUsers,
    lastEvent,
    error,
    isStarting,
    isEnding,
    startSession,
    endSession,
    broadcast,
    refreshSession: loadInitialSession,
  };
}
