-- ============================================================================
-- ICEM Connect — Phase 8/Hotfix Database Migration
-- Fix submit_ride_rating eligibility for completed rides & accepted requests
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_ride_rating(
  p_ride_id UUID,
  p_reviewer_id UUID,
  p_reviewee_id UUID,
  p_score INT,
  p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_reviewer RECORD;
  v_reviewee RECORD;
  v_new_rating_id UUID;
  v_new_count INT;
  v_new_avg NUMERIC(3, 2);
  v_is_eligible BOOLEAN := false;
BEGIN
  -- Validate score bounds (1..5)
  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Rating score must be between 1 and 5';
  END IF;

  -- Validate no self-rating
  IF p_reviewer_id = p_reviewee_id THEN
    RAISE EXCEPTION 'Self-rating is strictly prohibited';
  END IF;

  -- Lock and verify ride
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', p_ride_id;
  END IF;

  -- Ride must be completed
  IF v_ride.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Ratings can only be submitted for completed rides (Current: %)', v_ride.status;
  END IF;

  -- Verify participation eligibility (Rules.md §22)
  -- Allows CONFIRMED or COMPLETED participants, and ACCEPTED join requesters
  -- Case 1: Reviewer is Host, Reviewee is Participant
  IF v_ride.host_id = p_reviewer_id AND (
    EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_reviewee_id AND status IN ('CONFIRMED', 'COMPLETED')
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_join_requests
      WHERE ride_id = p_ride_id AND student_id = p_reviewee_id AND status = 'ACCEPTED'
    )
  ) THEN
    v_is_eligible := true;
  END IF;

  -- Case 2: Reviewer is Participant, Reviewee is Host
  IF v_ride.host_id = p_reviewee_id AND (
    EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_reviewer_id AND status IN ('CONFIRMED', 'COMPLETED')
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_join_requests
      WHERE ride_id = p_ride_id AND student_id = p_reviewer_id AND status = 'ACCEPTED'
    )
  ) THEN
    v_is_eligible := true;
  END IF;

  -- Case 3: Co-passengers on the same ride
  IF (
    EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_reviewer_id AND status IN ('CONFIRMED', 'COMPLETED')
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_join_requests
      WHERE ride_id = p_ride_id AND student_id = p_reviewer_id AND status = 'ACCEPTED'
    )
  ) AND (
    EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_reviewee_id AND status IN ('CONFIRMED', 'COMPLETED')
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_join_requests
      WHERE ride_id = p_ride_id AND student_id = p_reviewee_id AND status = 'ACCEPTED'
    )
  ) THEN
    v_is_eligible := true;
  END IF;

  IF NOT v_is_eligible THEN
    RAISE EXCEPTION 'Unauthorized: only confirmed participants and host of this ride may submit ratings';
  END IF;

  -- Duplicate rating check (Architecture.md §21)
  IF EXISTS (
    SELECT 1 FROM public.ratings 
    WHERE ride_id = p_ride_id AND reviewer_id = p_reviewer_id AND reviewee_id = p_reviewee_id
  ) THEN
    RAISE EXCEPTION 'You have already rated this user for this ride';
  END IF;

  -- Verify reviewer and reviewee exist in students table
  SELECT * INTO v_reviewer FROM public.students WHERE id = p_reviewer_id;
  SELECT * INTO v_reviewee FROM public.students WHERE id = p_reviewee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reviewee profile not found';
  END IF;

  -- Insert rating record
  INSERT INTO public.ratings (
    ride_id,
    reviewer_id,
    reviewee_id,
    score,
    feedback,
    created_at
  )
  VALUES (
    p_ride_id,
    p_reviewer_id,
    p_reviewee_id,
    p_score,
    p_feedback,
    now()
  )
  RETURNING id INTO v_new_rating_id;

  -- Atomically recalculate reviewee reputation
  v_new_count := COALESCE(v_reviewee.rating_count, 0) + 1;
  v_new_avg := ROUND(
    ( (COALESCE(v_reviewee.rating_average, 5.0) * COALESCE(v_reviewee.rating_count, 0)) + p_score )::numeric / v_new_count,
    2
  );

  UPDATE public.students
  SET
    rating_average = v_new_avg,
    rating_count = v_new_count,
    updated_at = now()
  WHERE id = p_reviewee_id;

  -- Dispatch in-app notification to reviewee
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data,
    created_at
  )
  VALUES (
    p_reviewee_id,
    'New Rating Received',
    format('You received a %s-star rating for your recent ride.', p_score),
    'RATING_RECEIVED',
    jsonb_build_object(
      'rating_id', v_new_rating_id,
      'ride_id', p_ride_id,
      'reviewer_id', p_reviewer_id,
      'score', p_score
    ),
    now()
  );

  RETURN jsonb_build_object(
    'rating_id', v_new_rating_id,
    'ride_id', p_ride_id,
    'reviewer_id', p_reviewer_id,
    'reviewee_id', p_reviewee_id,
    'score', p_score,
    'new_average', v_new_avg,
    'new_count', v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ride_rating(UUID, UUID, UUID, INT, TEXT) TO anon, authenticated, service_role;
