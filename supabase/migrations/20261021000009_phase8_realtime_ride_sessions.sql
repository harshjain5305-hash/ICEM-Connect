-- ============================================================================
-- ICEM Connect — Phase 8 Database Migration
-- Active Ride Sessions & Realtime Foundation (Phases.md §12, Architecture.md §10, §12)
-- ============================================================================

-- 1. RLS POLICIES FOR public.ride_sessions
ALTER TABLE public.ride_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants and hosts can view ride sessions" ON public.ride_sessions;
CREATE POLICY "Participants and hosts can view ride sessions"
  ON public.ride_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = public.ride_sessions.ride_id
        AND r.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_participants rp
      WHERE rp.ride_id = public.ride_sessions.ride_id
        AND rp.student_id = auth.uid()
        AND rp.status = 'CONFIRMED'
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Hosts can manage ride sessions" ON public.ride_sessions;
CREATE POLICY "Hosts can manage ride sessions"
  ON public.ride_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = public.ride_sessions.ride_id
        AND r.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = public.ride_sessions.ride_id
        AND r.host_id = auth.uid()
    )
  );

-- 2. VERIFY RIDE ROOM ACCESS STORED PROCEDURE (Rules.md §14, Architecture.md §13.3)
CREATE OR REPLACE FUNCTION public.verify_ride_room_access(
  p_ride_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_host BOOLEAN;
  v_is_confirmed_participant BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if host
  SELECT EXISTS (
    SELECT 1 FROM public.rides
    WHERE id = p_ride_id AND host_id = p_user_id
  ) INTO v_is_host;

  IF v_is_host THEN
    RETURN TRUE;
  END IF;

  -- Check if confirmed participant
  SELECT EXISTS (
    SELECT 1 FROM public.ride_participants
    WHERE ride_id = p_ride_id
      AND student_id = p_user_id
      AND status = 'CONFIRMED'
  ) INTO v_is_confirmed_participant;

  IF v_is_confirmed_participant THEN
    RETURN TRUE;
  END IF;

  -- Check if admin
  SELECT public.is_admin(p_user_id) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_ride_room_access(UUID, UUID) TO anon, authenticated, service_role;

-- 3. START RIDE SESSION STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.start_ride_session(
  p_ride_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_session RECORD;
  v_participant RECORD;
BEGIN
  -- 1. Verify ride exists and caller is host
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', p_ride_id;
  END IF;

  IF v_ride.host_id <> p_host_id THEN
    RAISE EXCEPTION 'Forbidden: Only the ride host can start an active ride session';
  END IF;

  IF v_ride.status NOT IN ('PUBLISHED', 'CONFIRMED') THEN
    RAISE EXCEPTION 'Cannot start ride with status %. Ride must be PUBLISHED or CONFIRMED', v_ride.status;
  END IF;

  -- 2. Create or activate session
  INSERT INTO public.ride_sessions (
    ride_id,
    started_at,
    ended_at,
    status,
    location_enabled,
    created_at
  )
  VALUES (
    p_ride_id,
    now(),
    NULL,
    'ACTIVE',
    TRUE,
    now()
  )
  ON CONFLICT (ride_id) DO UPDATE
  SET
    status = 'ACTIVE',
    started_at = now(),
    ended_at = NULL,
    location_enabled = TRUE
  RETURNING * INTO v_session;

  -- 3. Transition ride status to ACTIVE
  UPDATE public.rides
  SET
    status = 'ACTIVE',
    updated_at = now()
  WHERE id = p_ride_id;

  -- 4. Notify confirmed participants that the ride has started
  FOR v_participant IN
    SELECT rp.student_id
    FROM public.ride_participants rp
    WHERE rp.ride_id = p_ride_id AND rp.status = 'CONFIRMED'
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data,
      created_at
    )
    VALUES (
      v_participant.student_id,
      'Ride Started — Live Trip Active',
      'Your host has started the ride. Tap to view live ride session and trip updates.',
      'SYSTEM',
      jsonb_build_object(
        'ride_id', p_ride_id,
        'session_id', v_session.id,
        'action', 'RIDE_STARTED'
      ),
      now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'session_id', v_session.id,
    'ride_id', p_ride_id,
    'started_at', v_session.started_at,
    'status', v_session.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_ride_session(UUID, UUID) TO anon, authenticated, service_role;

-- 4. END RIDE SESSION STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.end_ride_session(
  p_ride_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_session RECORD;
  v_participant RECORD;
BEGIN
  -- 1. Verify ride exists and caller is host
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', p_ride_id;
  END IF;

  IF v_ride.host_id <> p_host_id THEN
    RAISE EXCEPTION 'Forbidden: Only the ride host can end this ride session';
  END IF;

  IF v_ride.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Cannot complete ride with status %. Ride must be ACTIVE', v_ride.status;
  END IF;

  -- 2. Update session to ENDED
  UPDATE public.ride_sessions
  SET
    status = 'ENDED',
    ended_at = now(),
    location_enabled = FALSE
  WHERE ride_id = p_ride_id
  RETURNING * INTO v_session;

  -- 3. Transition ride status to COMPLETED
  UPDATE public.rides
  SET
    status = 'COMPLETED',
    updated_at = now()
  WHERE id = p_ride_id;

  -- 4. Update participants to COMPLETED
  UPDATE public.ride_participants
  SET status = 'COMPLETED'
  WHERE ride_id = p_ride_id AND status = 'CONFIRMED';

  -- 5. Notify confirmed participants that trip is completed and prompt for rating
  FOR v_participant IN
    SELECT rp.student_id
    FROM public.ride_participants rp
    WHERE rp.ride_id = p_ride_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data,
      created_at
    )
    VALUES (
      v_participant.student_id,
      'Trip Completed — Rate Your Host',
      'You have arrived safely at your destination. Tap to leave a rating and review.',
      'SYSTEM',
      jsonb_build_object(
        'ride_id', p_ride_id,
        'action', 'RIDE_COMPLETED'
      ),
      now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'session_id', COALESCE(v_session.id, gen_random_uuid()),
    'ride_id', p_ride_id,
    'ended_at', now(),
    'status', 'ENDED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_ride_session(UUID, UUID) TO anon, authenticated, service_role;

-- 5. GET ACTIVE RIDE SESSION STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.get_active_ride_session(
  p_ride_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_session RECORD;
BEGIN
  -- Enforce authorization boundary
  SELECT public.verify_ride_room_access(p_ride_id, p_user_id) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Forbidden: You are not authorized to access this ride session.';
  END IF;

  SELECT * INTO v_session
  FROM public.ride_sessions
  WHERE ride_id = p_ride_id AND status = 'ACTIVE'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'ride_id', v_session.ride_id,
    'started_at', v_session.started_at,
    'ended_at', v_session.ended_at,
    'status', v_session.status,
    'location_enabled', v_session.location_enabled,
    'last_location_at', v_session.last_location_at,
    'created_at', v_session.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_ride_session(UUID, UUID) TO anon, authenticated, service_role;
