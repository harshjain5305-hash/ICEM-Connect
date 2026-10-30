import type { StudentStatus, UserRoleType } from '@/types/database';

export type { StudentStatus, UserRoleType };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  prn: string; // Private internal identifier
  department: string | null;
  year: number | null;
  profile_image_url: string | null;
  upi_id?: string | null;
  status: StudentStatus;
  rating_average: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Publicly exposed student profile.
 * PRN, phone, and internal credentials MUST NEVER be present here.
 * Architecture.md §6.1 & Phases.md §5 Security Requirements.
 */
export interface PublicStudentProfile {
  id: string;
  name: string;
  department: string | null;
  year: number | null;
  profile_image_url: string | null;
  upi_id?: string | null;
  status: StudentStatus;
  rating_average: number;
  rating_count: number;
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface AuthSessionState {
  user: AuthUser | null;
  profile: StudentProfile | null;
  roles: UserRoleType[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: string | null;
}
