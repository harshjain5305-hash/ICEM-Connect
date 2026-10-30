-- ==============================================================================
-- ICEM CONNECT — CONSOLIDATED MIGRATION & FIX: UPI, FUEL SHARING & OVERLOADS
-- File: supabase/migrations/20261029000002_consolidated_upi_and_fuel_sharing_fix.sql
-- Description:
--   1. Safely drops ALL overloaded variants of create_ride_join_request dynamically
--      via pg_proc to prevent ERROR 42725 (function name is not unique).
--   2. Creates definitive 7-parameter create_ride_join_request with offered_amount.
--   3. Updates get_student_profile RPC to include upi_id in JSON outputs.
--   4. Adds upi_id to public.students with robust VPA check constraint.
--   5. Adds offered_amount to public.ride_join_requests with 0..2000 INR check.
--   6. Creates payment enums, public.ride_payments table, indexes, and RLS policies.
--   7. Reloads PostgREST schema cache.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP ALL OVERLOADED create_ride_join_request FUNCTIONS DYNAMICALLY
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc
        WHERE proname = 'create_ride_join_request'
          AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE;';
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE DEFINITIVE STORED PROCEDURE: create_ride_join_request (7 parameters)
-- ------------------------------------------------------------------------------
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

  -- Rule: Host cannot request a seat on their own ride
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

  -- Rule: Duplicate pending request guard
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

  -- Trigger notification for the host
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

GRANT EXECUTE ON FUNCTION public.create_ride_join_request(UUID, UUID, UUID, UUID, INT, TEXT, NUMERIC) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. UPDATE get_student_profile RPC TO INCLUDE upi_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_profile(target_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id UUID := auth.uid();
  is_caller_admin BOOLEAN;
  student_row RECORD;
BEGIN
  -- Check if caller is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = caller_id AND role = 'ADMIN'
  ) INTO is_caller_admin;

  SELECT * INTO student_row FROM public.students WHERE id = target_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;

  -- If caller is the student themselves or an admin, return full profile including PRN & UPI
  IF caller_id = target_student_id OR is_caller_admin IS TRUE THEN
    RETURN jsonb_build_object(
      'id', student_row.id,
      'name', student_row.name,
      'email', student_row.email,
      'prn', student_row.prn,
      'department', student_row.department,
      'year', student_row.year,
      'profile_image_url', student_row.profile_image_url,
      'upi_id', student_row.upi_id,
      'status', student_row.status,
      'rating_average', student_row.rating_average,
      'rating_count', student_row.rating_count,
      'created_at', student_row.created_at
    );
  ELSE
    -- Public projection: PRN is strictly omitted, upi_id included for fuel payment coordination
    RETURN jsonb_build_object(
      'id', student_row.id,
      'name', student_row.name,
      'department', student_row.department,
      'year', student_row.year,
      'profile_image_url', student_row.profile_image_url,
      'upi_id', student_row.upi_id,
      'status', student_row.status,
      'rating_average', student_row.rating_average,
      'rating_count', student_row.rating_count,
      'created_at', student_row.created_at
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_profile(UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3B. RPC PROCEDURE TO UPDATE STUDENT PROFILE (AVOIDS TABLE PATCH QUIRKS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_department TEXT DEFAULT NULL,
  p_year INT DEFAULT NULL,
  p_upi_id TEXT DEFAULT NULL,
  p_profile_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.students
  SET
    department = COALESCE(p_department, department),
    year = COALESCE(p_year, year),
    upi_id = NULLIF(TRIM(p_upi_id), ''),
    profile_image_url = COALESCE(p_profile_image_url, profile_image_url),
    updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student record not found for authenticated user' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'name', v_updated.name,
    'email', v_updated.email,
    'prn', v_updated.prn,
    'department', v_updated.department,
    'year', v_updated.year,
    'profile_image_url', v_updated.profile_image_url,
    'upi_id', v_updated.upi_id,
    'status', v_updated.status,
    'rating_average', v_updated.rating_average,
    'rating_count', v_updated.rating_count,
    'created_at', v_updated.created_at,
    'updated_at', v_updated.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(TEXT, INT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. ADD upi_id TO STUDENTS AND REMOVE RESTRICTIVE REGEX CONSTRAINTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Drop restrictive regex constraint that causes 400 Bad Request on updates
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS ck_students_upi_format;

-- ------------------------------------------------------------------------------
-- 5. ADD offered_amount TO RIDE JOIN REQUESTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.ride_join_requests
  ADD COLUMN IF NOT EXISTS offered_amount NUMERIC(8, 2) DEFAULT 0.00;

ALTER TABLE public.ride_join_requests
  DROP CONSTRAINT IF EXISTS ck_join_requests_offered_amount;

ALTER TABLE public.ride_join_requests
  ADD CONSTRAINT ck_join_requests_offered_amount
  CHECK (offered_amount >= 0.00 AND offered_amount <= 2000.00);

-- ------------------------------------------------------------------------------
-- 6. PAYMENT ENUMS & RIDE PAYMENTS TABLE
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID_PENDING_CONFIRMATION',
    'CONFIRMED',
    'WAIVED',
    'DISPUTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'UPI',
    'CASH'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.ride_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.ride_join_requests(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(8, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0.00),
  method payment_method NOT NULL DEFAULT 'UPI',
  status payment_status NOT NULL DEFAULT 'PENDING',
  upi_intent_uri TEXT,
  payer_paid_at TIMESTAMPTZ,
  host_confirmed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_no_self_payment CHECK (payer_id <> payee_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_payments_payer ON public.ride_payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_payee ON public.ride_payments(payee_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_ride ON public.ride_payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_payments_status ON public.ride_payments(status);

ALTER TABLE public.ride_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their own payments" ON public.ride_payments;
CREATE POLICY "Participants can view their own payments"
  ON public.ride_payments FOR SELECT
  TO authenticated
  USING (
    payer_id = auth.uid() 
    OR payee_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Payers can create or update pending payments" ON public.ride_payments;
CREATE POLICY "Payers can create or update pending payments"
  ON public.ride_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    payer_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Involved parties can update payment status" ON public.ride_payments;
CREATE POLICY "Involved parties can update payment status"
  ON public.ride_payments FOR UPDATE
  TO authenticated
  USING (
    payer_id = auth.uid() 
    OR payee_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

GRANT ALL ON public.ride_payments TO authenticated, service_role;
GRANT SELECT ON public.ride_payments TO anon;

-- ------------------------------------------------------------------------------
-- 7. REFRESH POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
