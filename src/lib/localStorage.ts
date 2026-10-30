/**
 * Unified Local Storage access helpers and typed storage keys
 * for ICEM Connect client offline cache and mock database.
 */

export const STORAGE_KEYS = {
  RIDES: 'icem_connect_rides_db_v1',
  DISMISSED_RIDES: 'icem_dismissed_ride_ids_v1',
  WAYPOINTS: 'icem_connect_waypoints_db_v1',
  ROUTES: 'icem_connect_routes_db_v1',
  LOCATIONS: 'icem_connect_custom_locations_v1',
  REQUESTS: 'icem_join_requests_v1',
  DISMISSED_REQUESTS: 'icem_dismissed_request_ids_v1',
  PARTICIPANTS: 'icem_participants_v1',
  RECURRING_SCHEDULES: 'icem_recurring_schedules_v1',
  NOTIFICATIONS: 'icem_connect_notifications_v1',
  RATINGS: 'icem_connect_ratings_v1',
  REPORTS: 'icem_connect_reports_v1',
  MODERATION_ACTIONS: 'icem_connect_moderation_actions_v1',
  BLOCKED_USERS: 'icem_connect_blocked_users_v1',
  SESSIONS: 'icem_connect_ride_sessions_v1',
  MESSAGES: 'icem_ride_messages_v1',
  ROUTE_ALERTS: 'icem_route_alerts_v1',
  PAYMENTS: 'icem_connect_payments_v1',
  USERS: 'icem_connect_mock_users_v1',
  SESSION: 'icem_connect_auth_session_v1',
  THEME: 'icem_connect_theme_v1',
  PWA_DISMISSED: 'icem_pwa_dismissed_until',
} as const;

export function getLocalData<T>(key: string): Record<string, T> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalData<T>(key: string, data: Record<string, T>): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`Failed to save data to localStorage key ${key}:`, err);
  }
}
