export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type UserRoleType = 'STUDENT' | 'ADMIN' | 'MODERATOR';
export type LocationType = 'ICEM' | 'MAIN_ROAD' | 'BUS_STOP' | 'LANDMARK' | 'AREA' | 'CUSTOM';
export type RideStatus = 'DRAFT' | 'PUBLISHED' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type VehicleType = 'BIKE' | 'SCOOTER' | 'OTHER';
export type WaypointType = 'ORIGIN' | 'WAYPOINT' | 'DESTINATION';
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type ParticipantStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type SessionStatus = 'ACTIVE' | 'ENDED';
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface Database {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRoleType;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: UserRoleType;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRoleType;
          created_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          name: string;
          email: string;
          prn: string;
          department: string | null;
          year: number | null;
          profile_image_url: string | null;
          status: StudentStatus;
          rating_average: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          prn: string;
          department?: string | null;
          year?: number | null;
          profile_image_url?: string | null;
          status?: StudentStatus;
          rating_average?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          prn?: string;
          department?: string | null;
          year?: number | null;
          profile_image_url?: string | null;
          status?: StudentStatus;
          rating_average?: number;
          rating_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          name: string;
          type: LocationType;
          latitude: number;
          longitude: number;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: LocationType;
          latitude: number;
          longitude: number;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: LocationType;
          latitude?: number;
          longitude?: number;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rides: {
        Row: {
          id: string;
          host_id: string;
          origin_location_id: string | null;
          destination_location_id: string | null;
          departure_date: string;
          departure_time: string;
          total_seats: number;
          available_seats: number;
          vehicle_type: VehicleType;
          note: string | null;
          status: RideStatus;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          host_id: string;
          origin_location_id?: string | null;
          destination_location_id?: string | null;
          departure_date: string;
          departure_time: string;
          total_seats: number;
          available_seats: number;
          vehicle_type?: VehicleType;
          note?: string | null;
          status?: RideStatus;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          host_id?: string;
          origin_location_id?: string | null;
          destination_location_id?: string | null;
          departure_date?: string;
          departure_time?: string;
          total_seats?: number;
          available_seats?: number;
          vehicle_type?: VehicleType;
          note?: string | null;
          status?: RideStatus;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      ride_routes: {
        Row: {
          id: string;
          ride_id: string;
          provider: string;
          provider_route_id: string | null;
          encoded_polyline: string | null;
          geometry_json: Json | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          provider?: string;
          provider_route_id?: string | null;
          encoded_polyline?: string | null;
          geometry_json?: Json | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          provider?: string;
          provider_route_id?: string | null;
          encoded_polyline?: string | null;
          geometry_json?: Json | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ride_waypoints: {
        Row: {
          id: string;
          ride_id: string;
          sequence: number;
          label: string;
          type: WaypointType;
          latitude: number;
          longitude: number;
          location_id: string | null;
          distance_from_start_meters: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          sequence: number;
          label: string;
          type?: WaypointType;
          latitude: number;
          longitude: number;
          location_id?: string | null;
          distance_from_start_meters?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          sequence?: number;
          label?: string;
          type?: WaypointType;
          latitude?: number;
          longitude?: number;
          location_id?: string | null;
          distance_from_start_meters?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ride_join_requests: {
        Row: {
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
        };
        Insert: {
          id?: string;
          ride_id: string;
          student_id: string;
          pickup_waypoint_id?: string | null;
          drop_waypoint_id?: string | null;
          seat_count?: number;
          specific_area_note?: string | null;
          status?: JoinRequestStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          student_id?: string;
          pickup_waypoint_id?: string | null;
          drop_waypoint_id?: string | null;
          seat_count?: number;
          specific_area_note?: string | null;
          status?: JoinRequestStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ride_participants: {
        Row: {
          id: string;
          ride_id: string;
          student_id: string;
          pickup_waypoint_id: string | null;
          drop_waypoint_id: string | null;
          seat_count: number;
          status: ParticipantStatus;
          joined_at: string;
          confirmed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          ride_id: string;
          student_id: string;
          pickup_waypoint_id?: string | null;
          drop_waypoint_id?: string | null;
          seat_count?: number;
          status?: ParticipantStatus;
          joined_at?: string;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          ride_id?: string;
          student_id?: string;
          pickup_waypoint_id?: string | null;
          drop_waypoint_id?: string | null;
          seat_count?: number;
          status?: ParticipantStatus;
          joined_at?: string;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
      ride_sessions: {
        Row: {
          id: string;
          ride_id: string;
          started_at: string;
          ended_at: string | null;
          status: SessionStatus;
          location_enabled: boolean;
          last_location_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          started_at?: string;
          ended_at?: string | null;
          status?: SessionStatus;
          location_enabled?: boolean;
          last_location_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: SessionStatus;
          location_enabled?: boolean;
          last_location_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          ride_id: string;
          reviewer_id: string;
          reviewee_id: string;
          score: number;
          feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          reviewer_id: string;
          reviewee_id: string;
          score: number;
          feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          score?: number;
          feedback?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          read: boolean;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: string;
          read?: boolean;
          data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          read?: boolean;
          data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          ride_id: string | null;
          reason: string;
          details: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_id: string;
          ride_id?: string | null;
          reason: string;
          details?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_id?: string;
          ride_id?: string | null;
          reason?: string;
          details?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      ride_messages: {
        Row: {
          id: string;
          ride_id: string;
          sender_id: string;
          message: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          sender_id: string;
          message: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          sender_id?: string;
          message?: string;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_students: {
        Row: {
          id: string;
          name: string;
          department: string | null;
          year: number | null;
          profile_image_url: string | null;
          status: StudentStatus;
          rating_average: number;
          rating_count: number;
          created_at: string;
        };
      };
    };
    Functions: {
      check_health: {
        Args: Record<PropertyKey, never>;
        Returns: {
          status: string;
          timestamp: string;
          version: string;
          database: string;
          service: string;
        };
      };
      is_admin: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      is_active_student: {
        Args: { student_uuid: string };
        Returns: boolean;
      };
      search_locations: {
        Args: {
          p_query?: string;
          p_type?: LocationType;
          p_limit?: number;
        };
        Returns: {
          id: string;
          name: string;
          type: LocationType;
          latitude: number;
          longitude: number;
          address: string | null;
        }[];
      };
    };
    Enums: {
      student_status: StudentStatus;
      user_role_type: UserRoleType;
      location_type: LocationType;
      ride_status: RideStatus;
      vehicle_type: VehicleType;
      waypoint_type: WaypointType;
      join_request_status: JoinRequestStatus;
      participant_status: ParticipantStatus;
      session_status: SessionStatus;
      report_status: ReportStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
