export type SessionStatus = 'ACTIVE' | 'ENDED';

export interface RideSession {
  id: string;
  ride_id: string;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  location_enabled: boolean;
  last_location_at: string | null;
  created_at: string;
}

export type RealtimeConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type RideEventType =
  | 'ride:session_started'
  | 'ride:session_ended'
  | 'ride:status_changed'
  | 'ride:participant_joined'
  | 'ride:participant_left'
  | 'ride:join_request_created'
  | 'ride:join_request_accepted'
  | 'ride:join_request_rejected'
  | 'ride:seat_capacity_updated';

export interface BaseRideEvent<T extends RideEventType, P> {
  type: T;
  ride_id: string;
  payload: P;
  timestamp: string;
}

export type SessionStartedEvent = BaseRideEvent<
  'ride:session_started',
  {
    session_id: string;
    host_id: string;
    started_at: string;
  }
>;

export type SessionEndedEvent = BaseRideEvent<
  'ride:session_ended',
  {
    session_id: string;
    host_id: string;
    ended_at: string;
  }
>;

export type StatusChangedEvent = BaseRideEvent<
  'ride:status_changed',
  {
    old_status: string;
    new_status: string;
    updated_at: string;
  }
>;

export type ParticipantJoinedEvent = BaseRideEvent<
  'ride:participant_joined',
  {
    participant_id: string;
    student_id: string;
    student_name: string;
    seat_count: number;
    available_seats: number;
  }
>;

export type ParticipantLeftEvent = BaseRideEvent<
  'ride:participant_left',
  {
    participant_id: string;
    student_id: string;
    available_seats: number;
  }
>;

export type JoinRequestCreatedEvent = BaseRideEvent<
  'ride:join_request_created',
  {
    request_id: string;
    requester_id: string;
    requester_name: string;
    seat_count: number;
  }
>;

export type JoinRequestAcceptedEvent = BaseRideEvent<
  'ride:join_request_accepted',
  {
    request_id: string;
    passenger_id: string;
    available_seats: number;
  }
>;

export type JoinRequestRejectedEvent = BaseRideEvent<
  'ride:join_request_rejected',
  {
    request_id: string;
    passenger_id: string;
  }
>;

export type SeatCapacityUpdatedEvent = BaseRideEvent<
  'ride:seat_capacity_updated',
  {
    available_seats: number;
    total_seats: number;
  }
>;

export type RealtimeRideEvent =
  | SessionStartedEvent
  | SessionEndedEvent
  | StatusChangedEvent
  | ParticipantJoinedEvent
  | ParticipantLeftEvent
  | JoinRequestCreatedEvent
  | JoinRequestAcceptedEvent
  | JoinRequestRejectedEvent
  | SeatCapacityUpdatedEvent;

export interface RoomPresenceUser {
  user_id: string;
  name: string;
  role: 'HOST' | 'PASSENGER';
  online_at: string;
}

export interface RideRoomSubscriptionOptions {
  onEvent?: (event: RealtimeRideEvent) => void;
  onConnectionChange?: (state: RealtimeConnectionState) => void;
  onPresenceSync?: (users: RoomPresenceUser[]) => void;
  onError?: (error: Error) => void;
}

export interface RideRoomSubscription {
  ride_id: string;
  unsubscribe: () => void;
  broadcast: (event: RealtimeRideEvent) => Promise<boolean>;
  getConnectionState: () => RealtimeConnectionState;
}
