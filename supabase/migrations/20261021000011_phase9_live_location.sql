-- ============================================================================
-- ICEM Connect — Phase 9 Database Migration
-- Live Location Authorization & Heartbeat (Architecture.md §13, Rules.md §14)
-- ============================================================================

-- 1. STORED PROCEDURE: verify_location_publish_access
-- Enforces that ONLY the host of an ACTIVE ride with an ACTIVE session and location_enabled = true may publish GPS.
CREATE OR REPLACE FUNCTION public.verify_location_publish_access(
  p_ride_id UUID,
  p_host_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_valid BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.rides r
    JOIN public.ride_sessions rs ON rs.ride_id = r.id
    WHERE r.id = p_ride_id
      AND r.host_id = p_host_id
      AND r.status = 'ACTIVE'
      AND rs.status = 'ACTIVE'
      AND rs.location_enabled = true
  ) INTO v_is_valid;

  RETURN v_is_valid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_location_publish_access(UUID, UUID) TO anon, authenticated, service_role;

-- 2. STORED PROCEDURE: verify_location_subscribe_access
-- Enforces that ONLY host, confirmed participants, or admins may receive live GPS during ACTIVE session.
CREATE OR REPLACE FUNCTION public.verify_location_subscribe_access(
  p_ride_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_active BOOLEAN := false;
  v_is_participant BOOLEAN := false;
BEGIN
  -- Verify ride and session are ACTIVE with location_enabled = true
  SELECT EXISTS (
    SELECT 1 
    FROM public.rides r
    JOIN public.ride_sessions rs ON rs.ride_id = r.id
    WHERE r.id = p_ride_id
      AND r.status = 'ACTIVE'
      AND rs.status = 'ACTIVE'
      AND rs.location_enabled = true
  ) INTO v_session_active;

  IF NOT v_session_active THEN
    RETURN false;
  END IF;

  -- Check if host, confirmed participant, or accepted requester
  SELECT (
    EXISTS (
      SELECT 1 FROM public.rides WHERE id = p_ride_id AND host_id = p_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_participants 
      WHERE ride_id = p_ride_id AND student_id = p_user_id AND status IN ('CONFIRMED', 'COMPLETED')
    )
    OR EXISTS (
      SELECT 1 FROM public.ride_join_requests 
      WHERE ride_id = p_ride_id AND student_id = p_user_id AND status = 'ACCEPTED'
    )
    OR public.is_admin(p_user_id)
  ) INTO v_is_participant;

  RETURN v_is_participant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_location_subscribe_access(UUID, UUID) TO anon, authenticated, service_role;

-- 3. STORED PROCEDURE: record_location_heartbeat
-- Updates last_location_at timestamp on active session without persisting permanent GPS traces.
CREATE OR REPLACE FUNCTION public.record_location_heartbeat(
  p_ride_id UUID,
  p_host_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_can_publish BOOLEAN;
BEGIN
  SELECT public.verify_location_publish_access(p_ride_id, p_host_id) INTO v_can_publish;

  IF NOT v_can_publish THEN
    RAISE EXCEPTION 'Forbidden: You are not authorized to publish location for this ride.';
  END IF;

  UPDATE public.ride_sessions
  SET last_location_at = now()
  WHERE ride_id = p_ride_id AND status = 'ACTIVE';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_location_heartbeat(UUID, UUID) TO anon, authenticated, service_role;
