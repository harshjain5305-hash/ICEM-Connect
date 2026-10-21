export type NotificationType =
  | 'REQUEST_RECEIVED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CANCELLED'
  | 'RIDE_CANCELLED'
  | 'RIDE_CONFIRMED'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  data?: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  data?: Record<string, unknown> | null;
}
