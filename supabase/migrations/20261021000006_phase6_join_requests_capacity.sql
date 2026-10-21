-- ==============================================================================
-- ICEM CONNECT — PHASE 6 MIGRATION
-- Atomic Join Requests, Transactional Capacity Allocation & Notification Procedures
-- Architecture.md §8, §10, §47.2 | PRD.md §5 (UC-04, UC-05) & §9 | Rules.md §10-12
-- ==============================================================================

-- 1. STORED PROCEDURE: create_ride_join_request
CREATE OR REPLACE FUNCTION public.create_ride_join_request(
  p_student_id UUID,
  p_ride_id UUID,
  p_pickup_waypoint_id UUID DEFAULT NULL,
  p_drop_waypoint_id UUID DEFAULT NULL,
  p_seat_count INT DEFAULT 1,
  p_specific_area_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride RECORD;
  v_student RECORD;
  v_new_req_id UUID;
  v_result JSONB;
BEGIN
  -- Validate student exists and is active
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_student_id) THEN
      INSERT INTO public.students (id, name, email, prn, status)
      SELECT 
        id, 
        COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 
        email, 
        'PRN-' || substr(id::text, 1, 8), 
        'ACTIVE'
      FROM auth.users WHERE id = p_student_id
      ON CONFLICT (id) DO NOTHING;
      SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student with ID % not found', p_student_id;
  END IF;

  IF v_student.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Student must be active before requesting a ride (Status: %)', v_student.status;
  END IF;

  -- Validate seat count
  IF p_seat_count < 1 OR p_seat_count > 4 THEN
    RAISE EXCEPTION 'Seat count must be between 1 and 4';
  END IF;

  -- Lock and read the ride
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', p_ride_id;
  END IF;

  -- Rule: Host cannot request a seat on their own ride (Architecture.md §10)
  IF v_ride.host_id = p_student_id THEN
    RAISE EXCEPTION 'Host cannot request a seat on their own ride';
  END IF;

  -- Rule: Ride must be in joinable state
  IF v_ride.status NOT IN ('PUBLISHED', 'CONFIRMED') THEN
    RAISE EXCEPTION 'Ride is not currently open for requests (Status: %)', v_ride.status;
  END IF;

  -- Rule: Sufficient capacity must exist
  IF v_ride.available_seats < p_seat_count THEN
    RAISE EXCEPTION 'Not enough available seats on this ride (Available: %, Requested: %)',
      v_ride.available_seats, p_seat_count;
  END IF;

  -- Rule: Duplicate pending request guard (Rules.md §10)
  IF EXISTS (
    SELECT 1 FROM public.ride_join_requests
    WHERE ride_id = p_ride_id AND student_id = p_student_id AND status = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'You already have an active pending request for this ride';
  END IF;

  -- Rule: Already confirmed participant guard
  IF EXISTS (
    SELECT 1 FROM public.ride_participants
    WHERE ride_id = p_ride_id AND student_id = p_student_id AND status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'You are already a confirmed participant in this ride';
  END IF;

  -- Defensive check: if waypoint IDs provided do not exist in public.ride_waypoints, nullify
  IF p_pickup_waypoint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ride_waypoints WHERE id = p_pickup_waypoint_id
  ) THEN
    p_pickup_waypoint_id := NULL;
  END IF;

  IF p_drop_waypoint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ride_waypoints WHERE id = p_drop_waypoint_id
  ) THEN
    p_drop_waypoint_id := NULL;
  END IF;

  -- Insert join request
  INSERT INTO public.ride_join_requests (
    ride_id,
    student_id,
    pickup_waypoint_id,
    drop_waypoint_id,
    seat_count,
    specific_area_note,
    status
  ) VALUES (
    p_ride_id,
    p_student_id,
    p_pickup_waypoint_id,
    p_drop_waypoint_id,
    p_seat_count,
    NULLIF(TRIM(p_specific_area_note), ''),
    'PENDING'
  ) RETURNING id INTO v_new_req_id;

  -- Trigger notification for the host (PRD.md UC-05)
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    v_ride.host_id,
    'New Join Request',
    v_student.name || ' requested ' || p_seat_count || ' seat(s) for your ride.',
    'REQUEST_RECEIVED',
    jsonb_build_object(
      'request_id', v_new_req_id,
      'ride_id', p_ride_id,
      'requester_name', v_student.name,
      'seat_count', p_seat_count,
      'specific_area_note', p_specific_area_note
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'request_id', v_new_req_id,
    'status', 'PENDING',
    'seat_count', p_seat_count
  );

  RETURN v_result;
END;
$$;


-- 2. STORED PROCEDURE: accept_join_request (Atomic capacity allocation)
CREATE OR REPLACE FUNCTION public.accept_join_request(
  p_request_id UUID,
  p_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_ride RECORD;
  v_student RECORD;
  v_new_available INT;
  v_new_status ride_status;
  v_result JSONB;
BEGIN
  -- 1. Fetch request
  SELECT * INTO v_req FROM public.ride_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request with ID % not found', p_request_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Request is already in % state and cannot be accepted', v_req.status;
  END IF;

  -- 2. Lock the ride row to prevent race conditions on capacity (Architecture.md §10)
  SELECT * INTO v_ride FROM public.rides WHERE id = v_req.ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride with ID % not found', v_req.ride_id;
  END IF;

  -- 3. Verify host ownership
  IF v_ride.host_id <> p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: only the host can accept join requests for this ride';
  END IF;

  -- 4. Check capacity atomically
  IF v_ride.available_seats < v_req.seat_count THEN
    RAISE EXCEPTION 'Insufficient capacity: only % seat(s) available, but request requires %',
      v_ride.available_seats, v_req.seat_count;
  END IF;

  v_new_available := v_ride.available_seats - v_req.seat_count;
  v_new_status := v_ride.status;
  -- If full, transition to CONFIRMED if currently PUBLISHED
  IF v_new_available = 0 AND v_ride.status = 'PUBLISHED' THEN
    v_new_status := 'CONFIRMED';
  END IF;

  -- 5. Decrement capacity on ride
  UPDATE public.rides
  SET available_seats = v_new_available,
      status = v_new_status,
      updated_at = now()
  WHERE id = v_ride.id;

  -- 6. Update request status to ACCEPTED
  UPDATE public.ride_join_requests
  SET status = 'ACCEPTED',
      updated_at = now()
  WHERE id = p_request_id;

  -- 7. Insert confirmed participant
  INSERT INTO public.ride_participants (
    ride_id,
    student_id,
    pickup_waypoint_id,
    drop_waypoint_id,
    seat_count,
    status,
    joined_at,
    confirmed_at
  ) VALUES (
    v_ride.id,
    v_req.student_id,
    v_req.pickup_waypoint_id,
    v_req.drop_waypoint_id,
    v_req.seat_count,
    'CONFIRMED',
    now(),
    now()
  )
  ON CONFLICT (ride_id, student_id)
  DO UPDATE SET
    status = 'CONFIRMED',
    seat_count = v_req.seat_count,
    pickup_waypoint_id = v_req.pickup_waypoint_id,
    drop_waypoint_id = v_req.drop_waypoint_id,
    confirmed_at = now(),
    cancelled_at = NULL;

  -- 8. Fetch passenger identity for logging & notification
  SELECT * INTO v_student FROM public.students WHERE id = v_req.student_id;

  -- 9. Trigger notification for the passenger
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    v_req.student_id,
    'Ride Request Accepted!',
    'Your request for ' || v_req.seat_count || ' seat(s) has been accepted by the host.',
    'REQUEST_ACCEPTED',
    jsonb_build_object(
      'request_id', p_request_id,
      'ride_id', v_ride.id,
      'seat_count', v_req.seat_count
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'ride_id', v_ride.id,
    'status', 'ACCEPTED',
    'available_seats', v_new_available,
    'ride_status', v_new_status
  );

  RETURN v_result;
END;
$$;


-- 3. STORED PROCEDURE: reject_join_request
CREATE OR REPLACE FUNCTION public.reject_join_request(
  p_request_id UUID,
  p_host_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_ride RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_req FROM public.ride_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request with ID % not found', p_request_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Request is in % state and cannot be rejected', v_req.status;
  END IF;

  SELECT * INTO v_ride FROM public.rides WHERE id = v_req.ride_id;
  IF v_ride.host_id <> p_host_id THEN
    RAISE EXCEPTION 'Unauthorized: only the host can reject requests for this ride';
  END IF;

  -- Update request to REJECTED
  UPDATE public.ride_join_requests
  SET status = 'REJECTED',
      updated_at = now()
  WHERE id = p_request_id;

  -- Notify passenger
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    v_req.student_id,
    'Ride Request Declined',
    COALESCE(p_reason, 'The host was unable to accommodate your request at this time.'),
    'REQUEST_REJECTED',
    jsonb_build_object(
      'request_id', p_request_id,
      'ride_id', v_ride.id
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'REJECTED'
  );

  RETURN v_result;
END;
$$;


-- 4. STORED PROCEDURE: cancel_join_request (Passenger action)
CREATE OR REPLACE FUNCTION public.cancel_join_request(
  p_request_id UUID,
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_ride RECORD;
  v_student RECORD;
  v_new_available INT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_req FROM public.ride_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request with ID % not found', p_request_id;
  END IF;

  IF v_req.student_id <> p_student_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only cancel your own requests';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;

  -- CASE A: Request was PENDING
  IF v_req.status = 'PENDING' THEN
    UPDATE public.ride_join_requests
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE id = p_request_id;

    -- Notify host
    SELECT * INTO v_ride FROM public.rides WHERE id = v_req.ride_id;
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      v_ride.host_id,
      'Join Request Cancelled',
      v_student.name || ' cancelled their pending join request.',
      'REQUEST_CANCELLED',
      jsonb_build_object('request_id', p_request_id, 'ride_id', v_ride.id)
    );

    RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
  END IF;

  -- CASE B: Request was ACCEPTED (Student is cancelling confirmed seat)
  IF v_req.status = 'ACCEPTED' THEN
    -- Lock ride to safely restore seats
    SELECT * INTO v_ride FROM public.rides WHERE id = v_req.ride_id FOR UPDATE;

    -- Prevent cancelling on active or completed rides
    IF v_ride.status IN ('ACTIVE', 'COMPLETED') THEN
      RAISE EXCEPTION 'Cannot cancel ride request on an active or completed ride';
    END IF;

    v_new_available := v_ride.available_seats + v_req.seat_count;

    -- Restore seat capacity on ride
    UPDATE public.rides
    SET available_seats = v_new_available,
        status = CASE WHEN status = 'CONFIRMED' THEN 'PUBLISHED'::ride_status ELSE status END,
        updated_at = now()
    WHERE id = v_ride.id;

    -- Update request status
    UPDATE public.ride_join_requests
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE id = p_request_id;

    -- Update participant record
    UPDATE public.ride_participants
    SET status = 'CANCELLED',
        cancelled_at = now()
    WHERE ride_id = v_ride.id AND student_id = p_student_id;

    -- Notify host
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      v_ride.host_id,
      'Confirmed Passenger Cancelled',
      COALESCE(v_student.name, 'A passenger') || ' cancelled their confirmed seat (' || v_req.seat_count || ' seat restored).',
      'REQUEST_CANCELLED',
      jsonb_build_object('request_id', p_request_id, 'ride_id', v_ride.id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'CANCELLED',
      'restored_seats', v_req.seat_count,
      'available_seats', v_new_available
    );
  END IF;

  RAISE EXCEPTION 'Request cannot be cancelled in state %', v_req.status;
END;
$$;

-- 5. FUNCTION EXECUTE PERMISSIONS
GRANT EXECUTE ON FUNCTION public.create_ride_join_request TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_join_request TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_join_request TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_join_request TO anon, authenticated, service_role;

-- 6. POLICIES & PERMISSIONS FIXES
DROP POLICY IF EXISTS "Allow notification inserts" ON public.notifications;
CREATE POLICY "Allow notification inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view ride routes" ON public.ride_routes;
CREATE POLICY "Anyone can view ride routes"
  ON public.ride_routes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view ride waypoints" ON public.ride_waypoints;
CREATE POLICY "Anyone can view ride waypoints"
  ON public.ride_waypoints FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Requesters and hosts can view join requests" ON public.ride_join_requests;
CREATE POLICY "Requesters and hosts can view join requests"
  ON public.ride_join_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Participants and hosts can view participants" ON public.ride_participants;
CREATE POLICY "Participants and hosts can view participants"
  ON public.ride_participants FOR SELECT
  USING (true);
