-- ============================================================================
-- ICEM Connect — Phase 10 Database Migration
-- Ride Coordination Chat, Retention Policy, and Security Hardening
-- (Phases.md §14, §30; Architecture.md §44, §47; Rules.md §14, §15)
-- ============================================================================

-- 1. RLS POLICIES FOR public.ride_messages
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eligible participants can view non-expired messages" ON public.ride_messages;
CREATE POLICY "Eligible participants can view non-expired messages"
  ON public.ride_messages FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND (
      -- Host of the ride
      EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.id = public.ride_messages.ride_id
          AND r.host_id = auth.uid()
      )
      -- Confirmed participant of the ride
      OR EXISTS (
        SELECT 1 FROM public.ride_participants rp
        WHERE rp.ride_id = public.ride_messages.ride_id
          AND rp.student_id = auth.uid()
          AND rp.status IN ('CONFIRMED', 'COMPLETED')
      )
      -- Pending requester for coordination (Architecture.md §47.4)
      OR EXISTS (
        SELECT 1 FROM public.ride_join_requests rjr
        WHERE rjr.ride_id = public.ride_messages.ride_id
          AND rjr.passenger_id = auth.uid()
          AND rjr.status = 'PENDING'
      )
      -- Admin override
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authorized users can send ride messages" ON public.ride_messages;
CREATE POLICY "Authorized users can send ride messages"
  ON public.ride_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = public.ride_messages.ride_id
        AND r.status NOT IN ('COMPLETED', 'CANCELLED')
        AND (
          r.host_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.ride_participants rp
            WHERE rp.ride_id = r.id
              AND rp.student_id = auth.uid()
              AND rp.status = 'CONFIRMED'
          )
          OR (
            EXISTS (
              SELECT 1 FROM public.ride_join_requests rjr
              WHERE rjr.ride_id = r.id
                AND rjr.passenger_id = auth.uid()
                AND rjr.status = 'PENDING'
            )
            AND r.available_seats > 0
          )
        )
    )
  );

-- 2. VERIFY CHAT ACCESS FUNCTION
CREATE OR REPLACE FUNCTION public.verify_ride_chat_access(
  p_ride_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_is_host BOOLEAN := FALSE;
  v_is_confirmed BOOLEAN := FALSE;
  v_is_pending BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
  v_can_read BOOLEAN := FALSE;
  v_can_send BOOLEAN := FALSE;
  v_reason TEXT := 'OK';
BEGIN
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_read', FALSE,
      'can_send', FALSE,
      'reason', 'Ride not found'
    );
  END IF;

  v_is_admin := public.is_admin(p_user_id);
  v_is_host := (v_ride.host_id = p_user_id);

  SELECT EXISTS (
    SELECT 1 FROM public.ride_participants
    WHERE ride_id = p_ride_id
      AND student_id = p_user_id
      AND status IN ('CONFIRMED', 'COMPLETED')
  ) INTO v_is_confirmed;

  SELECT EXISTS (
    SELECT 1 FROM public.ride_join_requests
    WHERE ride_id = p_ride_id
      AND passenger_id = p_user_id
      AND status = 'PENDING'
  ) INTO v_is_pending;

  IF v_is_admin OR v_is_host OR v_is_confirmed OR v_is_pending THEN
    v_can_read := TRUE;
  ELSE
    RETURN jsonb_build_object(
      'can_read', FALSE,
      'can_send', FALSE,
      'reason', 'Forbidden: You are not authorized to view coordination chat for this ride'
    );
  END IF;

  -- Sending constraints
  IF v_ride.status IN ('COMPLETED', 'CANCELLED') THEN
    v_can_send := FALSE;
    v_reason := 'Ride is concluded. Chat is read-only.';
  ELSIF v_is_host OR v_is_confirmed THEN
    v_can_send := TRUE;
  ELSIF v_is_pending THEN
    IF v_ride.available_seats <= 0 THEN
      v_can_send := FALSE;
      v_reason := 'Ride is at full capacity. Coordination chat is restricted to confirmed passengers.';
    ELSE
      v_can_send := TRUE;
    END IF;
  ELSE
    v_can_send := FALSE;
    v_reason := 'Forbidden: Not authorized to send messages in this room';
  END IF;

  RETURN jsonb_build_object(
    'can_read', v_can_read,
    'can_send', v_can_send,
    'is_read_only', (v_ride.status IN ('COMPLETED', 'CANCELLED')),
    'reason', v_reason
  );
END;
$$;

-- 3. SEND RIDE MESSAGE RPC (Architecture.md §47.5)
CREATE OR REPLACE FUNCTION public.send_ride_message(
  p_ride_id UUID,
  p_sender_id UUID,
  p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_sender_name TEXT;
  v_is_host BOOLEAN;
  v_is_confirmed BOOLEAN;
  v_is_pending BOOLEAN;
  v_trimmed_msg TEXT;
  v_new_msg RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Input sanitization and length bounds
  v_trimmed_msg := btrim(p_message);
  IF v_trimmed_msg IS NULL OR length(v_trimmed_msg) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  IF length(v_trimmed_msg) > 500 THEN
    RAISE EXCEPTION 'Message exceeds 500 characters limit';
  END IF;

  -- 2. Fetch ride and verify status
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', p_ride_id;
  END IF;

  IF v_ride.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot send message: trip is % and chat is closed (read-only)', v_ride.status;
  END IF;

  -- 3. Authorization check
  v_is_host := (v_ride.host_id = p_sender_id);

  SELECT EXISTS (
    SELECT 1 FROM public.ride_participants
    WHERE ride_id = p_ride_id
      AND student_id = p_sender_id
      AND status IN ('CONFIRMED', 'COMPLETED')
  ) INTO v_is_confirmed;

  SELECT EXISTS (
    SELECT 1 FROM public.ride_join_requests
    WHERE ride_id = p_ride_id
      AND passenger_id = p_sender_id
      AND status = 'PENDING'
  ) INTO v_is_pending;

  IF NOT v_is_host AND NOT v_is_confirmed THEN
    IF v_is_pending THEN
      IF v_ride.available_seats <= 0 THEN
        RAISE EXCEPTION 'Forbidden: Ride is at full capacity. Coordination chat is restricted to confirmed passengers';
      END IF;
    ELSE
      RAISE EXCEPTION 'Forbidden: You are not authorized to send messages in this ride room';
    END IF;
  END IF;

  -- 4. Get sender name
  SELECT full_name INTO v_sender_name
  FROM public.students
  WHERE id = p_sender_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'Student';
  END IF;

  -- 5. Calculate expiration: 24h default while ride is active/scheduled (Architecture.md §47.7)
  v_expires_at := now() + interval '24 hours';

  -- 6. Insert message
  INSERT INTO public.ride_messages (
    ride_id,
    sender_id,
    message,
    created_at,
    expires_at
  ) VALUES (
    p_ride_id,
    p_sender_id,
    v_trimmed_msg,
    now(),
    v_expires_at
  )
  RETURNING * INTO v_new_msg;

  RETURN jsonb_build_object(
    'id', v_new_msg.id,
    'ride_id', v_new_msg.ride_id,
    'sender_id', v_new_msg.sender_id,
    'sender_name', v_sender_name,
    'message', v_new_msg.message,
    'created_at', v_new_msg.created_at,
    'expires_at', v_new_msg.expires_at
  );
END;
$$;

-- 4. GET RIDE MESSAGES RPC (Architecture.md §47.5)
CREATE OR REPLACE FUNCTION public.get_ride_messages(
  p_ride_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_access JSONB;
  v_messages JSONB;
BEGIN
  -- Verify read authorization
  v_access := public.verify_ride_chat_access(p_ride_id, p_user_id);
  IF NOT (v_access->>'can_read')::BOOLEAN THEN
    RAISE EXCEPTION 'Forbidden: %', (v_access->>'reason');
  END IF;

  -- Fetch active non-expired messages
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rm.id,
        'ride_id', rm.ride_id,
        'sender_id', rm.sender_id,
        'sender_name', coalesce(s.full_name, 'Student'),
        'message', rm.message,
        'created_at', rm.created_at,
        'expires_at', rm.expires_at
      )
      ORDER BY rm.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_messages
  FROM public.ride_messages rm
  LEFT JOIN public.students s ON s.id = rm.sender_id
  WHERE rm.ride_id = p_ride_id
    AND rm.expires_at > now();

  RETURN v_messages;
END;
$$;

-- 5. CLEANUP EXPIRED RIDE MESSAGES (Architecture.md §47.7)
CREATE OR REPLACE FUNCTION public.cleanup_expired_ride_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.ride_messages
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 6. UPDATE END RIDE SESSION TO APPLY 3-HOUR RETENTION (Architecture.md §47.7 & §47.8)
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

  -- 5. CAP MESSAGE EXPIRY TO 3 HOURS FROM COMPLETION (Architecture.md §47.7, §47.8; Phases.md §30)
  UPDATE public.ride_messages
  SET expires_at = LEAST(expires_at, now() + interval '3 hours')
  WHERE ride_id = p_ride_id;

  -- 6. Notify confirmed participants that trip is completed and prompt for rating
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
      related_entity_id,
      related_entity_type
    ) VALUES (
      v_participant.student_id,
      'Trip Concluded — Rate Your Host',
      format('Your ride "%s" has concluded. Please rate your travel experience with your host.', v_ride.title),
      'RATING_RECEIVED',
      p_ride_id,
      'ride'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'ride_id', p_ride_id,
    'status', 'ENDED',
    'ride_status', 'COMPLETED',
    'ended_at', v_session.ended_at
  );
END;
$$;

-- 7. GRANTS
GRANT EXECUTE ON FUNCTION public.verify_ride_chat_access(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_ride_message(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ride_messages(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_ride_messages() TO anon, authenticated, service_role;
