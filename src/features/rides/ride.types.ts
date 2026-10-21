import type {
  RideStatus,
  VehicleType,
  WaypointType,
  JoinRequestStatus,
  ParticipantStatus,
  SessionStatus,
  LocationType,
} from '@/types/database';

export interface LocationReference {
  id: string;
  name: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  address?: string | null;
}

export interface Ride {
  id: string;
  host_id: string;
  origin_location_id: string | null;
  destination_location_id: string | null;
  origin?: LocationReference;
  destination?: LocationReference;
  departure_date: string;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  vehicle_type: VehicleType;
  note: string | null;
  status: RideStatus;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface RideRoute {
  id: string;
  ride_id: string;
  provider: string;
  provider_route_id?: string | null;
  encoded_polyline?: string | null;
  geometry_json?: Record<string, unknown> | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RideWaypoint {
  id: string;
  ride_id: string;
  sequence: number;
  label: string;
  type: WaypointType;
  latitude: number;
  longitude: number;
  location_id?: string | null;
  distance_from_start_meters?: number | null;
  created_at: string;
}

export interface RideJoinRequest {
  id: string;
  ride_id: string;
  student_id: string;
  pickup_waypoint_id: string | null;
  drop_waypoint_id: string | null;
  seat_count: number;
  specific_area_note: string | null;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface RideParticipant {
  id: string;
  ride_id: string;
  student_id: string;
  pickup_waypoint_id: string | null;
  drop_waypoint_id: string | null;
  seat_count: number;
  status: ParticipantStatus;
  joined_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
}

export interface RideSession {
  id: string;
  ride_id: string;
  started_at: string;
  ended_at?: string | null;
  status: SessionStatus;
  location_enabled: boolean;
  last_location_at?: string | null;
  created_at: string;
}

export interface RideMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  expires_at: string;
}
