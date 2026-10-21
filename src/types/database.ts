export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type UserRoleType = 'STUDENT' | 'ADMIN' | 'MODERATOR';

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
    };
  };
}
