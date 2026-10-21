export interface RideMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  expires_at: string;
}

export interface SendRideMessageInput {
  ride_id: string;
  message: string;
}

export interface ChatAccessCheckResult {
  can_read: boolean;
  can_send: boolean;
  is_read_only: boolean;
  reason?: string;
}
