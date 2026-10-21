import type { PublicStudentInfo } from '@/features/requests/request.types';

export type ReportCategory =
  | 'UNSAFE_DRIVING'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_BEHAVIOUR'
  | 'NO_SHOW'
  | 'MISREPRESENTATION'
  | 'ROUTE_PICKUP_ABUSE'
  | 'SUSPICIOUS_ACTIVITY'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_id: string;
  ride_id?: string | null;
  reason: ReportCategory;
  details?: string | null;
  status: ReportStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  created_at: string;
  reporter?: PublicStudentInfo;
  reported?: PublicStudentInfo;
}

export interface CreateReportInput {
  reported_id: string;
  ride_id?: string | null;
  reason: ReportCategory;
  details?: string | null;
}

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason?: string | null;
  created_at: string;
  blocked_user?: PublicStudentInfo;
}

export interface CreateBlockInput {
  blocked_id: string;
  reason?: string | null;
}
