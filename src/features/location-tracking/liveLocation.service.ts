import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { rideRepository } from '@/features/rides/ride.repository';
import { rideSessionRepository } from '@/features/rides/rideSession.repository';
import { requestRepository } from '@/features/requests/request.repository';
import { authService } from '@/features/auth/auth.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import { liveLocationUpdateSchema } from './location.schema';
import type { LiveLocationUpdate } from './location.types';

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Approximate Haversine distance in meters
function computeDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const THROTTLE_INTERVAL_MS = 5000; // Minimum 5 seconds between regular updates (Rules.md §15)
const MIN_DISTANCE_METERS = 15; // Or 15 meters moved

interface LastBroadcastRecord {
  timestamp: number;
  latitude: number;
  longitude: number;
}

const lastBroadcasts = new Map<string, LastBroadcastRecord>();
const latestLocations = new Map<string, LiveLocationUpdate>();

export const liveLocationService = {
  /**
   * Enforces that ONLY the host of an ACTIVE ride with an active session can publish location.
   * Conforms to Rules.md §14.3 and Architecture.md §13.2.
   */
  async canPublishLocation(rideId: string, hostId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(hostId)) {
      try {
        const { data, error } = await supabase.rpc('verify_location_publish_access', {
          p_ride_id: rideId,
          p_host_id: hostId,
        });
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch (err) {
        console.warn('Live verify_location_publish_access error, checking fallback:', err);
      }
    }

    // Local / fallback validation
    const ride = await rideRepository.getRideById(rideId);
    if (!ride || ride.host_id !== hostId || ride.status !== 'ACTIVE') {
      return false;
    }

    try {
      const session = await rideSessionRepository.getActiveSession(rideId, hostId);
      return Boolean(session && session.status === 'ACTIVE' && session.location_enabled);
    } catch {
      return false;
    }
  },

  /**
   * Enforces that ONLY confirmed participants or host can receive live location.
   * Unauthorized passengers receive false / rejected.
   */
  async canSubscribeLocation(rideId: string, userId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase.rpc('verify_location_subscribe_access', {
          p_ride_id: rideId,
          p_user_id: userId,
        });
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch (err) {
        console.warn('Live verify_location_subscribe_access error, checking fallback:', err);
      }
    }

    // Local / fallback validation
    const ride = await rideRepository.getRideById(rideId);
    if (!ride || ride.status !== 'ACTIVE') {
      return false;
    }

    try {
      const session = await rideSessionRepository.getActiveSession(rideId, userId);
      if (!session || session.status !== 'ACTIVE' || !session.location_enabled) {
        return false;
      }
    } catch {
      return false;
    }

    // Host has access
    if (ride.host_id === userId) return true;

    // Confirmed participant has access
    const participants = await requestRepository.listParticipantsByRide(rideId);
    if (participants.some((p) => p.student_id === userId)) {
      return true;
    }

    // Accepted join requester has access
    const requests = await requestRepository.listRequestsByRide(rideId);
    if (requests.some((r) => r.student_id === userId && r.status === 'ACCEPTED')) {
      return true;
    }

    // Admin has access
    const roles = await authService.getUserRoles(userId);
    return roles.includes('ADMIN');
  },

  /**
   * Evaluates movement and time throttling rules (Rules.md §15).
   */
  shouldBroadcast(rideId: string, latitude: number, longitude: number): boolean {
    const now = Date.now();
    const last = lastBroadcasts.get(rideId);
    if (!last) return true;

    const timeElapsed = now - last.timestamp;
    if (timeElapsed >= THROTTLE_INTERVAL_MS) return true;

    const distanceMoved = computeDistanceMeters(last.latitude, last.longitude, latitude, longitude);
    if (distanceMoved >= MIN_DISTANCE_METERS) return true;

    return false;
  },

  /**
   * Publishes a live location update from the host.
   */
  async publishLocation(
    hostId: string,
    update: LiveLocationUpdate,
    bypassThrottle = false
  ): Promise<boolean> {
    const parseResult = liveLocationUpdateSchema.safeParse(update);
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid location data');
    }

    const canPublish = await this.canPublishLocation(update.ride_id, hostId);
    if (!canPublish) {
      throw new Error('Forbidden: Unauthorized to publish live location for this ride.');
    }

    if (!bypassThrottle && !this.shouldBroadcast(update.ride_id, update.latitude, update.longitude)) {
      return false; // Throttled
    }

    // Update transient cache
    latestLocations.set(update.ride_id, update);
    lastBroadcasts.set(update.ride_id, {
      timestamp: Date.now(),
      latitude: update.latitude,
      longitude: update.longitude,
    });

    // Record heartbeat on server if live
    const isLive = isSupabaseConfigured();
    if (isLive && isValidUuid(update.ride_id) && isValidUuid(hostId)) {
      void supabase.rpc('record_location_heartbeat', {
        p_ride_id: update.ride_id,
        p_host_id: hostId,
      });
    }

    // Broadcast location update over Realtime ride room
    await realtimeService.broadcastRideEvent(update.ride_id, {
      type: 'location:update',
      ride_id: update.ride_id,
      timestamp: update.timestamp,
      payload: {
        rideId: update.ride_id,
        latitude: update.latitude,
        longitude: update.longitude,
        accuracyMeters: update.accuracy,
        heading: update.heading ?? null,
        speed: update.speed ?? null,
        timestamp: update.timestamp,
      },
    });

    return true;
  },

  /**
   * Signals that host has started GPS location streaming.
   */
  async startLocationSharing(hostId: string, rideId: string): Promise<void> {
    const canPublish = await this.canPublishLocation(rideId, hostId);
    if (!canPublish) {
      throw new Error('Forbidden: Unauthorized to start location sharing.');
    }

    await realtimeService.broadcastRideEvent(rideId, {
      type: 'location:started',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        rideId,
        hostId,
        startedAt: new Date().toISOString(),
      },
    });
  },

  /**
   * Signals that host has stopped GPS location streaming.
   */
  async stopLocationSharing(hostId: string, rideId: string): Promise<void> {
    latestLocations.delete(rideId);
    lastBroadcasts.delete(rideId);

    await realtimeService.broadcastRideEvent(rideId, {
      type: 'location:stopped',
      ride_id: rideId,
      timestamp: new Date().toISOString(),
      payload: {
        rideId,
        hostId,
        stoppedAt: new Date().toISOString(),
      },
    });
  },

  /**
   * Retrieves the latest known transient location for authorized users.
   */
  async getLatestLocation(rideId: string, userId: string): Promise<LiveLocationUpdate | null> {
    const canSubscribe = await this.canSubscribeLocation(rideId, userId);
    if (!canSubscribe) {
      throw new Error('Forbidden: Unauthorized to receive live location.');
    }
    return latestLocations.get(rideId) || null;
  },

  /**
   * Cleans up all transient location states (used in test teardown).
   */
  reset(): void {
    lastBroadcasts.clear();
    latestLocations.clear();
  },
};
