import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { authService } from '@/features/auth/auth.service';
import { notificationService } from '@/features/notifications/notification.service';
import type { RideRating, CreateRatingInput, RatingResult } from './rating.types';
import type { PublicStudentInfo } from '@/features/requests/request.types';

const LOCAL_STORAGE_RATINGS_KEY = 'icem_ratings_v1';

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function getLocalData<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalData<T>(key: string, data: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save localStorage key ${key}:`, err);
  }
}

async function getPublicStudentInfo(studentId: string): Promise<PublicStudentInfo> {
  const profile = await authService.getProfile(studentId);
  if (profile) {
    return {
      id: profile.id,
      name: profile.name,
      department: profile.department,
      year: profile.year,
      profile_image_url: profile.profile_image_url,
      rating: profile.rating_average,
      is_verified: profile.status === 'ACTIVE',
    };
  }
  return {
    id: studentId,
    name: 'ICEM Student',
    department: 'Engineering',
    year: 3,
    rating: 5.0,
    is_verified: true,
  };
}

export const ratingRepository = {
  async submitRating(reviewerId: string, input: CreateRatingInput): Promise<RatingResult> {
    const isLive = isSupabaseConfigured();

    if (
      isLive &&
      isValidUuid(input.ride_id) &&
      isValidUuid(reviewerId) &&
      isValidUuid(input.reviewee_id)
    ) {
      try {
        const { data, error } = await supabase.rpc('submit_ride_rating', {
          p_ride_id: input.ride_id,
          p_reviewer_id: reviewerId,
          p_reviewee_id: input.reviewee_id,
          p_score: input.score,
          p_feedback: input.feedback || null,
        });

        if (error) {
          console.warn('Supabase submit_ride_rating returned error:', error.message);
          throw new Error(error.message);
        }

        if (data && (data as { rating_id?: string }).rating_id) {
          const res = data as RatingResult;
          // Mirror in local store
          const ratings = getLocalData<RideRating>(LOCAL_STORAGE_RATINGS_KEY);
          ratings[res.rating_id] = {
            id: res.rating_id,
            ride_id: input.ride_id,
            reviewer_id: reviewerId,
            reviewee_id: input.reviewee_id,
            score: input.score,
            feedback: input.feedback || null,
            created_at: new Date().toISOString(),
          };
          saveLocalData(LOCAL_STORAGE_RATINGS_KEY, ratings);
          return res;
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('already rated')) {
          throw err;
        }
        console.warn('Live rating error, falling back to local calculation:', err);
      }
    }

    // Local / Offline mode
    const ratings = getLocalData<RideRating>(LOCAL_STORAGE_RATINGS_KEY);
    const existing = Object.values(ratings).find(
      (r) =>
        r.ride_id === input.ride_id &&
        r.reviewer_id === reviewerId &&
        r.reviewee_id === input.reviewee_id
    );

    if (existing) {
      throw new Error('You have already rated this user for this ride');
    }

    const ratingId = `rate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRating: RideRating = {
      id: ratingId,
      ride_id: input.ride_id,
      reviewer_id: reviewerId,
      reviewee_id: input.reviewee_id,
      score: input.score,
      feedback: input.feedback || null,
      created_at: new Date().toISOString(),
    };

    ratings[ratingId] = newRating;
    saveLocalData(LOCAL_STORAGE_RATINGS_KEY, ratings);

    // Update reviewee profile reputation in local storage
    const revieweeProfile = await authService.getProfile(input.reviewee_id);
    let newAvg = input.score;
    let newCount = 1;

    if (revieweeProfile) {
      const oldCount = revieweeProfile.rating_count || 0;
      const oldAvg = revieweeProfile.rating_average || 5.0;
      newCount = oldCount + 1;
      newAvg = Number((((oldAvg * oldCount) + input.score) / newCount).toFixed(2));

      await authService.updateStudentReputation(input.reviewee_id, newAvg, newCount);
    }

    // Trigger in-app notification to reviewee
    await notificationService.notify({
      user_id: input.reviewee_id,
      title: 'New Rating Received',
      message: `You received a ${input.score}-star rating for your recent ICEM Connect journey.`,
      type: 'RATING_RECEIVED',
      data: {
        rating_id: ratingId,
        ride_id: input.ride_id,
        score: input.score,
      },
    });

    return {
      success: true,
      rating_id: ratingId,
      new_average: newAvg,
      new_count: newCount,
    };
  },

  async listRatingsByRide(rideId: string): Promise<RideRating[]> {
    const isLive = isSupabaseConfigured();
    const liveRatings: RideRating[] = [];

    if (isLive && isValidUuid(rideId)) {
      try {
        const { data, error } = await supabase
          .from('ratings')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          for (const item of data) {
            const r = item as unknown as RideRating;
            r.reviewer = await getPublicStudentInfo(r.reviewer_id);
            r.reviewee = await getPublicStudentInfo(r.reviewee_id);
            liveRatings.push(r);
          }
        }
      } catch (err) {
        console.warn('Live listRatingsByRide error, falling back to local mode:', err);
      }
    }

    const localRatings = getLocalData<RideRating>(LOCAL_STORAGE_RATINGS_KEY);
    const localList = Object.values(localRatings).filter((r) => r.ride_id === rideId);

    const map = new Map<string, RideRating>();
    for (const r of liveRatings) map.set(r.id, r);
    for (const r of localList) {
      if (!map.has(r.id)) {
        if (!r.reviewer) r.reviewer = await getPublicStudentInfo(r.reviewer_id);
        if (!r.reviewee) r.reviewee = await getPublicStudentInfo(r.reviewee_id);
        map.set(r.id, r);
      }
    }

    return Array.from(map.values());
  },

  async listRatingsForUser(userId: string): Promise<RideRating[]> {
    const isLive = isSupabaseConfigured();
    const liveRatings: RideRating[] = [];

    if (isLive && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase
          .from('ratings')
          .select('*')
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          for (const item of data) {
            const r = item as unknown as RideRating;
            r.reviewer = await getPublicStudentInfo(r.reviewer_id);
            liveRatings.push(r);
          }
        }
      } catch (err) {
        console.warn('Live listRatingsForUser error:', err);
      }
    }

    const localRatings = getLocalData<RideRating>(LOCAL_STORAGE_RATINGS_KEY);
    const localList = Object.values(localRatings).filter((r) => r.reviewee_id === userId);

    const map = new Map<string, RideRating>();
    for (const r of liveRatings) map.set(r.id, r);
    for (const r of localList) {
      if (!map.has(r.id)) {
        if (!r.reviewer) r.reviewer = await getPublicStudentInfo(r.reviewer_id);
        map.set(r.id, r);
      }
    }

    return Array.from(map.values());
  },

  async hasUserRated(rideId: string, reviewerId: string, revieweeId: string): Promise<boolean> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(rideId) && isValidUuid(reviewerId) && isValidUuid(revieweeId)) {
      try {
        const { data } = await supabase
          .from('ratings')
          .select('id')
          .eq('ride_id', rideId)
          .eq('reviewer_id', reviewerId)
          .eq('reviewee_id', revieweeId)
          .maybeSingle();

        if (data) return true;
      } catch {
        // ignore
      }
    }

    const ratings = getLocalData<RideRating>(LOCAL_STORAGE_RATINGS_KEY);
    return Object.values(ratings).some(
      (r) =>
        r.ride_id === rideId &&
        r.reviewer_id === reviewerId &&
        r.reviewee_id === revieweeId
    );
  },
};
