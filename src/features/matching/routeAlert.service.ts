import type { RouteAlert, CreateRouteAlertInput } from './routeAlert.types';
import type { Ride } from '@/features/rides/ride.types';
import { notificationService } from '@/features/notifications/notification.service';

const ROUTE_ALERTS_STORAGE_KEY = 'icem_connect_route_alerts_v1';

function getLocalAlerts(): RouteAlert[] {
  try {
    const raw = localStorage.getItem(ROUTE_ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAlerts(alerts: RouteAlert[]): void {
  try {
    localStorage.setItem(ROUTE_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore
  }
}

export const routeAlertService = {
  /**
   * Registers a new route alert / waitlist subscription.
   */
  async createAlert(input: CreateRouteAlertInput): Promise<RouteAlert> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Valid student email is required to set a route alert');
    }

    const alerts = getLocalAlerts();

    // Check for an existing identical active alert
    const existing = alerts.find(
      (a) =>
        a.email === email &&
        a.pickupLocationId === input.pickupLocationId &&
        a.dropLocationId === input.dropLocationId &&
        a.date === input.date &&
        a.status === 'ACTIVE'
    );

    if (existing) {
      return existing;
    }

    const newAlert: RouteAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: input.userId || null,
      email,
      pickupLocationId: input.pickupLocationId,
      dropLocationId: input.dropLocationId,
      pickupName: input.pickupName,
      dropName: input.dropName,
      date: input.date,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    alerts.push(newAlert);
    saveLocalAlerts(alerts);
    return newAlert;
  },

  /**
   * Retrieves active alerts for a user by student ID or email.
   */
  async getUserAlerts(userId?: string | null, email?: string | null): Promise<RouteAlert[]> {
    const alerts = getLocalAlerts();
    return alerts.filter((a) => {
      if (a.status !== 'ACTIVE') return false;
      if (userId && a.userId === userId) return true;
      if (email && a.email.toLowerCase() === email.toLowerCase()) return true;
      return false;
    });
  },

  /**
   * Cancels a route alert.
   */
  async cancelAlert(alertId: string): Promise<void> {
    const alerts = getLocalAlerts();
    const updated = alerts.map((a) =>
      a.id === alertId ? { ...a, status: 'CANCELLED' as const } : a
    );
    saveLocalAlerts(updated);
  },

  /**
   * Checks for and notifies students who subscribed to alerts matching a newly offered ride.
   */
  async notifySubscribersOnNewRide(ride: Ride): Promise<number> {
    const alerts = getLocalAlerts();
    let notifiedCount = 0;

    const updatedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        if (alert.status !== 'ACTIVE') return alert;
        if (alert.date !== ride.departure_date) return alert;

        // Check if ride matches alert corridor (origin -> destination or via waypoints)
        const matchesOriginDest =
          alert.pickupLocationId === ride.origin_location_id &&
          alert.dropLocationId === ride.destination_location_id;

        const waypointLocationIds = (ride.waypoints || []).map((w) => w.location_id).filter(Boolean);
        const allLocationIds = [
          ride.origin_location_id,
          ...waypointLocationIds,
          ride.destination_location_id,
        ].filter(Boolean);

        const pickupIdx = allLocationIds.indexOf(alert.pickupLocationId);
        const dropIdx = allLocationIds.indexOf(alert.dropLocationId);
        const matchesCorridor = matchesOriginDest || (pickupIdx !== -1 && dropIdx !== -1 && pickupIdx < dropIdx);

        if (!matchesCorridor) return alert;

        // Dispatch in-app notification if user is known
        if (alert.userId) {
          try {
            await notificationService.notify({
              user_id: alert.userId,
              title: 'Route Alert: Ride Available!',
              message: `A student posted a ride from ${alert.pickupName} to ${alert.dropName} leaving at ${ride.departure_time}. Tap to view or request a seat.`,
              type: 'SYSTEM',
              data: {
                rideId: ride.id,
                origin: alert.pickupName,
                destination: alert.dropName,
                time: ride.departure_time,
              },
            });
          } catch (e) {
            console.warn('Failed to send route alert in-app notification:', e);
          }
        }

        notifiedCount++;
        return {
          ...alert,
          status: 'NOTIFIED' as const,
        };
      })
    );

    saveLocalAlerts(updatedAlerts);
    return notifiedCount;
  },
};
