import type { PublicStudentInfo } from '@/features/requests/request.types';

export interface RideRating {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  score: number; // 1..5
  feedback?: string | null;
  created_at: string;
  reviewer?: PublicStudentInfo;
  reviewee?: PublicStudentInfo;
}

export interface CreateRatingInput {
  ride_id: string;
  reviewee_id: string;
  score: number;
  feedback?: string | null;
}

export interface RatingResult {
  success: boolean;
  rating_id: string;
  new_average: number;
  new_count: number;
}
