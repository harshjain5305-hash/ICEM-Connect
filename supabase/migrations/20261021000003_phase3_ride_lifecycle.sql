-- ==============================================================================
-- ICEM Connect — Migration: Phase 3 Ride Creation & State Machine Lifecycle
-- File: supabase/migrations/20261021000003_phase3_ride_lifecycle.sql
-- Description: Stored procedure for atomic server-enforced ride state transitions,
--              cancellation hooks, and host query helpers.
-- ==============================================================================

-- 1. ATOMIC STATE TRANSITION STORED PROCEDURE (Architecture.md §11 & Rules.md §6-9)
CREATE OR REPLACE FUNCTION public.transition_ride_status(
  p_ride_id UUID,
  p_target_status public.ride_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_ride public.rides%ROWTYPE;
  v_is_admin BOOLEAN := false;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to transition ride status';
  END IF;

  -- Fetch ride with lock
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RIDE_NOT_FOUND: Ride % does not exist', p_ride_id;
  END IF;

  -- Check if caller is host or admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'ADMIN'
  ) INTO v_is_admin;

  IF v_ride.host_id <> v_caller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the host or an administrator can update ride status';
  END IF;

  -- If status is already the target, return unmodified
  IF v_ride.status = p_target_status THEN
    RETURN v_ride;
  END IF;

  -- Validate deterministic transitions (Architecture.md §11.1)
  CASE v_ride.status
    WHEN 'DRAFT' THEN
      IF p_target_status NOT IN ('PUBLISHED', 'CANCELLED') THEN
        RAISE EXCEPTION 'RIDE_INVALID_STATE: Cannot transition DRAFT ride to %', p_target_status;
      END IF;

    WHEN 'PUBLISHED' THEN
      IF p_target_status NOT IN ('CONFIRMED', 'ACTIVE', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'RIDE_INVALID_STATE: Cannot transition PUBLISHED ride to %', p_target_status;
      END IF;

    WHEN 'CONFIRMED' THEN
      IF p_target_status NOT IN ('ACTIVE', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION 'RIDE_INVALID_STATE: Cannot transition CONFIRMED ride to %', p_target_status;
      END IF;

    WHEN 'ACTIVE' THEN
      IF p_target_status NOT IN ('COMPLETED', 'CANCELLED') THEN
        RAISE EXCEPTION 'RIDE_INVALID_STATE: Cannot transition ACTIVE ride to %', p_target_status;
      END IF;

    WHEN 'COMPLETED', 'CANCELLED', 'EXPIRED' THEN
      RAISE EXCEPTION 'RIDE_INVALID_STATE: Cannot transition from terminal state %', v_ride.status;

    ELSE
      RAISE EXCEPTION 'RIDE_INVALID_STATE: Unknown status %', v_ride.status;
  END CASE;

  -- Perform the status update
  UPDATE public.rides
  SET
    status = p_target_status,
    updated_at = now(),
    published_at = CASE
      WHEN p_target_status = 'PUBLISHED' AND published_at IS NULL THEN now()
      ELSE published_at
    END
  WHERE id = p_ride_id
  RETURNING * INTO v_ride;

  -- If ride is entering a terminal state, terminate any active sessions
  IF p_target_status IN ('COMPLETED', 'CANCELLED') THEN
    UPDATE public.ride_sessions
    SET
      status = 'ENDED',
      ended_at = now(),
      location_enabled = false
    WHERE ride_id = p_ride_id AND status = 'ACTIVE';
  END IF;

  RETURN v_ride;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.transition_ride_status(UUID, public.ride_status, TEXT) TO authenticated;

-- Comment for migration documentation
COMMENT ON FUNCTION public.transition_ride_status IS
  'Atomically transitions a ride through verified lifecycle states and enforces host ownership and active session cleanup.';
