import { createRatingSchema } from './rating.schema';
import { ratingRepository } from './rating.repository';
import { rideRepository } from '@/features/rides/ride.repository';
import { requestRepository } from '@/features/requests/request.repository';
import type { RideRating, CreateRatingInput, RatingResult } from './rating.types';

export const ratingService = {
  /**
   * Submits a rating from a verified ride participant/host after trip completion.
   * Conforms to Architecture.md §9, PRD.md §14, and Rules.md §22.
   */
  async submitRating(reviewerId: string, input: CreateRatingInput): Promise<RatingResult> {
    const parseResult = createRatingSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(parseResult.error.errors[0]?.message || 'Invalid rating data');
    }

    if (reviewerId === input.reviewee_id) {
      throw new Error('Self-rating is strictly prohibited');
    }

    // 1. Verify ride exists and is in COMPLETED state
    const ride = await rideRepository.getRideById(input.ride_id);
    if (!ride) {
      throw new Error(`Ride with ID ${input.ride_id} not found`);
    }

    if (ride.status !== 'COMPLETED') {
      throw new Error(
        `Ratings can only be submitted after the ride is COMPLETED (Current status: ${ride.status})`
      );
    }

    // 2. Verify eligibility (Rules.md §22: participant or host relationship required)
    const isReviewerHost = ride.host_id === reviewerId;
    const isRevieweeHost = ride.host_id === input.reviewee_id;

    const participants = await requestRepository.listParticipantsByRide(input.ride_id);
    let isReviewerParticipant = participants.some((p) => p.student_id === reviewerId);
    let isRevieweeParticipant = participants.some((p) => p.student_id === input.reviewee_id);

    // Direct join request fallback check
    if (!isReviewerParticipant && !isReviewerHost) {
      try {
        const studentReqs = await requestRepository.listRequestsByStudent(reviewerId);
        isReviewerParticipant = studentReqs.some(
          (r) => r.ride_id === input.ride_id && r.status === 'ACCEPTED'
        );
      } catch {
        // ignore
      }
    }

    if (!isRevieweeParticipant && !isRevieweeHost) {
      try {
        const studentReqs = await requestRepository.listRequestsByStudent(input.reviewee_id);
        isRevieweeParticipant = studentReqs.some(
          (r) => r.ride_id === input.ride_id && r.status === 'ACCEPTED'
        );
      } catch {
        // ignore
      }
    }

    const isEligible =
      (isReviewerHost && isRevieweeParticipant) ||
      (isReviewerParticipant && isRevieweeHost) ||
      (isReviewerParticipant && isRevieweeParticipant);

    if (!isEligible) {
      throw new Error('Unauthorized: only confirmed participants and host of this ride may rate each other');
    }

    // 3. Duplicate rating check
    const alreadyRated = await ratingRepository.hasUserRated(
      input.ride_id,
      reviewerId,
      input.reviewee_id
    );
    if (alreadyRated) {
      throw new Error('You have already rated this user for this ride');
    }

    return await ratingRepository.submitRating(reviewerId, input);
  },

  /**
   * Lists all ratings associated with a specific completed ride.
   */
  async getRatingsForRide(rideId: string): Promise<RideRating[]> {
    return await ratingRepository.listRatingsByRide(rideId);
  },

  /**
   * Lists all received ratings for a student profile.
   */
  async getRatingsForUser(userId: string): Promise<RideRating[]> {
    return await ratingRepository.listRatingsForUser(userId);
  },

  /**
   * Checks whether the current user has already rated a specific target student on a ride.
   */
  async hasRated(rideId: string, reviewerId: string, revieweeId: string): Promise<boolean> {
    return await ratingRepository.hasUserRated(rideId, reviewerId, revieweeId);
  },
};
