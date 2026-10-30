-- ==============================================================================
-- ICEM CONNECT — MIGRATION: FIX JOIN REQUEST OFFERED AMOUNT (P2P FUEL SHARING)
-- File: supabase/migrations/20261029000001_fix_join_request_offered_amount.sql
-- Description: Unambiguously replaces create_ride_join_request stored procedure
--              to accept and persist p_offered_amount in public.ride_join_requests.
-- ==============================================================================

-- 1. DROP ALL OLD OVERLOADED VARIANTS UNAMBIGUOUSLY
DROP FUNCTION IF EXISTS public.create_ride_join_request(UUID, UUID, UUID, UUID, INT, TEXT);
DROP FUNCTION IF EXISTS public.create_ride_join_request(UUID, UUID, UUID, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.create_ride_join_request(UUID, UUID, UUID, UUID, INT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.create_ride_join_request(UUID, UUID, UUID, UUID, INTEGER, TEXT, NUMERIC);

-- 2. CREATE NEW DEFINITIVE STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.create_ride_join_request(
  p_student_id UUID,
  p_ride_id UUID,
  p_pickup_waypoint_id UUID DEFAULT NULL,
  p_drop_waypoint_id UUID DEFAULT NULL,
  p_seat_count INT DEFAULT 1,
  p_specific_area_note TEXT DEFAULT NULL,
  p_offered_amount NUMERIC DEFAULT 0.00
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
  v_offered NUMERIC(8, 2);
BEGIN
  v_offered := COALESCE(p_offered_amount, 0.00);

  -- Validate student exists and is active in public.students
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    -- If user exists in auth.users, auto-provision active student profile
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

  -- Insert join request with offered fuel contribution
  INSERT INTO public.ride_join_requests (
    ride_id,
    student_id,
    pickup_waypoint_id,
    drop_waypoint_id,
    seat_count,
    specific_area_note,
    offered_amount,
    status
  ) VALUES (
    p_ride_id,
    p_student_id,
    p_pickup_waypoint_id,
    p_drop_waypoint_id,
    p_seat_count,
    NULLIF(TRIM(p_specific_area_note), ''),
    v_offered,
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
    COALESCE(v_student.name, 'A student') || ' requested ' || p_seat_count || ' seat(s)' ||
      CASE WHEN v_offered > 0 THEN ' (Fuel share: ₹' || v_offered::text || ' offered)' ELSE '' END ||
      ' for your ride.',
    'REQUEST_RECEIVED',
    jsonb_build_object(
      'request_id', v_new_req_id,
      'ride_id', p_ride_id,
      'seat_count', p_seat_count,
      'offered_amount', v_offered,
      'specific_area_note', NULLIF(TRIM(p_specific_area_note), '')
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'request_id', v_new_req_id,
    'status', 'PENDING',
    'offered_amount', v_offered,
    'message', 'Join request submitted successfully'
  );

  RETURN v_result;
END;
$$;

-- 3. GRANT PERMISSION WITH EXPLICIT ARGUMENT LIST
GRANT EXECUTE ON FUNCTION public.create_ride_join_request(UUID, UUID, UUID, UUID, INT, TEXT, NUMERIC) TO anon, authenticated, service_role;
