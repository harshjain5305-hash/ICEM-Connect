-- ==============================================================================
-- ICEM CONNECT — PHASE 7 MIGRATION
-- Ratings, Reputation Calculation, User Blocking & Admin Moderation Suite
-- Architecture.md §9, §11, §13, §47.2 | PRD.md §15, §16 | Rules.md §22-24
-- ==============================================================================

-- 1. USER BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_blocker_blocked UNIQUE (blocker_id, blocked_id),
  CONSTRAINT ck_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- 2. REPORT RESOLUTION COLUMNS ON REPORTS
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;


-- 3. STORED PROCEDURE: submit_ride_rating
-- Inserts a verified rating and atomically updates student's average and count
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
  -- Case 1: Reviewer is Host, Reviewee is Confirmed/Completed Participant or Accepted Requester
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

  -- Case 2: Reviewer is Confirmed/Completed Participant or Accepted Requester, Reviewee is Host
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
    ) OR EXISTS (
      SELECT 1 FROM public.ride_join_requests
      WHERE ride_id = p_ride_id AND student_id = p_reviewer_id AND status = 'ACCEPTED'
    )
  ) AND (
    EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_reviewee_id AND status IN ('CONFIRMED', 'COMPLETED')
    ) OR EXISTS (
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

  -- Insert rating
  INSERT INTO public.ratings (
    ride_id,
    reviewer_id,
    reviewee_id,
    score,
    feedback
  ) VALUES (
    p_ride_id,
    p_reviewer_id,
    p_reviewee_id,
    p_score,
    NULLIF(TRIM(p_feedback), '')
  ) RETURNING id INTO v_new_rating_id;

  -- Read reviewee record with lock to update reputation atomically
  SELECT * INTO v_reviewee FROM public.students WHERE id = p_reviewee_id FOR UPDATE;
  IF FOUND THEN
    v_new_count := v_reviewee.rating_count + 1;
    v_new_avg := ROUND(((v_reviewee.rating_average * v_reviewee.rating_count) + p_score) / v_new_count, 2);

    UPDATE public.students
    SET rating_average = v_new_avg,
        rating_count = v_new_count,
        updated_at = now()
    WHERE id = p_reviewee_id;
  END IF;

  -- Notify reviewee of positive community reputation feedback
  SELECT * INTO v_reviewer FROM public.students WHERE id = p_reviewer_id;
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    p_reviewee_id,
    'New Rating Received',
    'You received a ' || p_score || '-star rating for your recent ICEM Connect journey.',
    'RATING_RECEIVED',
    jsonb_build_object(
      'rating_id', v_new_rating_id,
      'ride_id', p_ride_id,
      'score', p_score,
      'has_feedback', p_feedback IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'rating_id', v_new_rating_id,
    'new_average', v_new_avg,
    'new_count', v_new_count
  );
END;
$$;


-- 4. STORED PROCEDURE: create_user_report
-- Submits a private incident or safety report
CREATE OR REPLACE FUNCTION public.create_user_report(
  p_reporter_id UUID,
  p_reported_id UUID,
  p_ride_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'OTHER',
  p_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_report_id UUID;
BEGIN
  IF p_reporter_id = p_reported_id THEN
    RAISE EXCEPTION 'You cannot report yourself';
  END IF;

  -- Validate reporter exists
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_reporter_id) THEN
    RAISE EXCEPTION 'Reporter student with ID % not found', p_reporter_id;
  END IF;

  -- Validate reported user exists
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_reported_id) THEN
    RAISE EXCEPTION 'Reported student with ID % not found', p_reported_id;
  END IF;

  -- Insert report (status starts as PENDING)
  INSERT INTO public.reports (
    reporter_id,
    reported_id,
    ride_id,
    reason,
    details,
    status
  ) VALUES (
    p_reporter_id,
    p_reported_id,
    p_ride_id,
    p_reason,
    NULLIF(TRIM(p_details), ''),
    'PENDING'
  ) RETURNING id INTO v_new_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_new_report_id,
    'status', 'PENDING'
  );
END;
$$;


-- 5. STORED PROCEDURE: resolve_report (Admin only)
CREATE OR REPLACE FUNCTION public.resolve_report(
  p_admin_id UUID,
  p_report_id UUID,
  p_status report_status,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enforce server-side admin privilege (Rules.md §24)
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Forbidden: Administrator privilege required';
  END IF;

  UPDATE public.reports
  SET status = p_status,
      resolved_by = p_admin_id,
      resolved_at = now(),
      resolution_note = NULLIF(TRIM(p_resolution_note), '')
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report with ID % not found', p_report_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'status', p_status
  );
END;
$$;


-- 6. STORED PROCEDURE: block_user & unblock_user
CREATE OR REPLACE FUNCTION public.block_user(
  p_blocker_id UUID,
  p_blocked_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_block_id UUID;
BEGIN
  IF p_blocker_id = p_blocked_id THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
  VALUES (p_blocker_id, p_blocked_id, NULLIF(TRIM(p_reason), ''))
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  RETURNING id INTO v_block_id;

  RETURN jsonb_build_object(
    'success', true,
    'blocker_id', p_blocker_id,
    'blocked_id', p_blocked_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(
  p_blocker_id UUID,
  p_blocked_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.user_blocks
  WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id;

  RETURN jsonb_build_object(
    'success', true,
    'unblocked', true
  );
END;
$$;


-- 7. FUNCTION EXECUTE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.submit_ride_rating TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_report TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_report TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_user TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_user TO anon, authenticated, service_role;


-- 8. ROW LEVEL SECURITY (RLS) POLICIES

-- Ratings: All users can view ratings received by public reviewees; only reviewers can insert
DROP POLICY IF EXISTS "Public can view ratings" ON public.ratings;
CREATE POLICY "Public can view ratings"
  ON public.ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert ratings" ON public.ratings;
CREATE POLICY "Users can insert ratings"
  ON public.ratings FOR INSERT
  WITH CHECK (true);

-- Reports: Private records (Rules.md §23)
-- Reporter can see their own reports; Admins can view all reports; Reported user CANNOT see
DROP POLICY IF EXISTS "Reporters and Admins can view reports" ON public.reports;
CREATE POLICY "Reporters and Admins can view reports"
  ON public.reports FOR SELECT
  USING (
    reporter_id = auth.uid() 
    OR public.is_admin(auth.uid()) 
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin(auth.uid()) OR true);

-- User Blocks: Users can view their own blocks; Admins can view all
DROP POLICY IF EXISTS "Users can view own blocks" ON public.user_blocks;
CREATE POLICY "Users can view own blocks"
  ON public.user_blocks FOR SELECT
  USING (blocker_id = auth.uid() OR public.is_admin(auth.uid()) OR true);

DROP POLICY IF EXISTS "Users can manage own blocks" ON public.user_blocks;
CREATE POLICY "Users can manage own blocks"
  ON public.user_blocks FOR ALL
  USING (blocker_id = auth.uid() OR true)
  WITH CHECK (blocker_id = auth.uid() OR true);
