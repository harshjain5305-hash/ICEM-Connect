-- ==============================================================================
-- ICEM Connect — Migration: Phase 5 Find Ride + Deterministic Route Segment Matching
-- File: supabase/migrations/20261021000005_phase5_find_matching.sql
-- Description: Stored procedure for server-side corridor segment matching,
--              enforcing pickup-before-drop directionality and capacity constraints.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.search_compatible_rides(
  p_pickup_loc_id UUID,
  p_drop_loc_id UUID,
  p_departure_date DATE,
  p_requested_seats INT DEFAULT 1,
  p_caller_id UUID DEFAULT NULL
)
RETURNS TABLE (
  ride_id UUID,
  host_id UUID,
  origin_location_id UUID,
  destination_location_id UUID,
  departure_date DATE,
  departure_time TIME,
  total_seats INT,
  available_seats INT,
  vehicle_type public.vehicle_type,
  note TEXT,
  status public.ride_status,
  pickup_waypoint_id UUID,
  pickup_sequence INT,
  pickup_label TEXT,
  drop_waypoint_id UUID,
  drop_sequence INT,
  drop_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS ride_id,
    r.host_id,
    r.origin_location_id,
    r.destination_location_id,
    r.departure_date,
    r.departure_time,
    r.total_seats,
    r.available_seats,
    r.vehicle_type,
    r.note,
    r.status,
    wp_pickup.id AS pickup_waypoint_id,
    wp_pickup.sequence AS pickup_sequence,
    wp_pickup.label AS pickup_label,
    wp_drop.id AS drop_waypoint_id,
    wp_drop.sequence AS drop_sequence,
    wp_drop.label AS drop_label
  FROM public.rides r
  -- Join matching pickup waypoint
  JOIN public.ride_waypoints wp_pickup
    ON wp_pickup.ride_id = r.id
    AND wp_pickup.location_id = p_pickup_loc_id
  -- Join matching drop waypoint
  JOIN public.ride_waypoints wp_drop
    ON wp_drop.ride_id = r.id
    AND wp_drop.location_id = p_drop_loc_id
  WHERE
    r.status IN ('PUBLISHED', 'CONFIRMED')
    AND r.departure_date = p_departure_date
    AND r.available_seats >= p_requested_seats
    -- Host cannot join their own ride
    AND (p_caller_id IS NULL OR r.host_id <> p_caller_id)
    -- STRICT ROUTE DIRECTIONALITY: Pickup MUST occur before Drop! (Rules.md §5.4)
    AND wp_pickup.sequence < wp_drop.sequence
  ORDER BY
    r.departure_time ASC,
    r.available_seats DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_compatible_rides(UUID, UUID, DATE, INT, UUID) TO authenticated;

COMMENT ON FUNCTION public.search_compatible_rides IS
  'Finds published rides whose ordered corridor waypoints satisfy the requested passenger segment directionality (pickup < drop) and seat capacity.';
