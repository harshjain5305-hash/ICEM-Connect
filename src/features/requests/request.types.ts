import type { JoinRequestStatus, ParticipantStatus } from '@/types/database';
import type { Ride, RideWaypoint } from '@/features/rides/ride.types';

export interface PublicStudentInfo {
  id: string;
  name: string;
  department: string | null;
  year: number | null;
  profile_image_url?: string | null;
  rating?: number;
  is_verified?: boolean;
}

export interface JoinRequest {
  id: string;
  ride_id: string;
  student_id: string;
  pickup_waypoint_id?: string | null;
  drop_waypoint_id?: string | null;
  seat_count: number;
  offered_amount?: number;
  specific_area_note?: string | null;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Hydrated associations
  student?: PublicStudentInfo;
  ride?: Ride;
  pickup_waypoint?: RideWaypoint;
  drop_waypoint?: RideWaypoint;
}

export interface RideParticipant {
  id: string;
  ride_id: string;
  student_id: string;
  pickup_waypoint_id?: string | null;
  drop_waypoint_id?: string | null;
  seat_count: number;
  status: ParticipantStatus;
  joined_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;

  // Hydrated associations
  student?: PublicStudentInfo;
  pickup_waypoint?: RideWaypoint;
  drop_waypoint?: RideWaypoint;
}

export interface CreateJoinRequestInput {
  ride_id: string;
  pickup_waypoint_id?: string | null;
  drop_waypoint_id?: string | null;
  seat_count: number;
  offered_amount?: number;
  specific_area_note?: string | null;
}

export interface AcceptRequestResult {
  success: boolean;
  request_id: string;
  ride_id: string;
  status: 'ACCEPTED';
  available_seats: number;
  ride_status: string;
}

export interface CancelRequestResult {
  success: boolean;
  status: 'CANCELLED';
  restored_seats?: number;
  available_seats?: number;
}
