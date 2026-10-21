-- ==============================================================================
-- ICEM Connect — Migration: Phase 4 Routes & Meaningful Waypoints
-- File: supabase/migrations/20261021000004_phase4_routes_waypoints.sql
-- Description: Route storage helpers, ordered waypoint indexing, and corridor queries.
-- ==============================================================================

-- 1. INDEXES FOR FAST ROUTE AND WAYPOINT LOOKUPS
CREATE INDEX IF NOT EXISTS idx_ride_routes_ride_id ON public.ride_routes(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_waypoints_ride_sequence ON public.ride_waypoints(ride_id, sequence);
CREATE INDEX IF NOT EXISTS idx_ride_waypoints_location_id ON public.ride_waypoints(location_id);

-- 2. STORED PROCEDURE TO RETRIEVE COMPLETE ROUTE AND WAYPOINTS
CREATE OR REPLACE FUNCTION public.get_ride_route_and_waypoints(p_ride_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_route RECORD;
  v_waypoints JSONB;
BEGIN
  -- Fetch route
  SELECT * INTO v_route
  FROM public.ride_routes
  WHERE ride_id = p_ride_id;

  -- Fetch ordered waypoints
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', rw.id,
      'ride_id', rw.ride_id,
      'sequence', rw.sequence,
      'label', rw.label,
      'type', rw.type,
      'latitude', rw.latitude,
      'longitude', rw.longitude,
      'location_id', rw.location_id,
      'distance_from_start_meters', rw.distance_from_start_meters,
      'location_name', l.name,
      'location_type', l.type
    ) ORDER BY rw.sequence ASC
  ) INTO v_waypoints
  FROM public.ride_waypoints rw
  LEFT JOIN public.locations l ON rw.location_id = l.id
  WHERE rw.ride_id = p_ride_id;

  RETURN jsonb_build_object(
    'ride_id', p_ride_id,
    'route', CASE WHEN v_route.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_route.id,
        'provider', v_route.provider,
        'provider_route_id', v_route.provider_route_id,
        'encoded_polyline', v_route.encoded_polyline,
        'geometry_json', v_route.geometry_json,
        'distance_meters', v_route.distance_meters,
        'duration_seconds', v_route.duration_seconds,
        'created_at', v_route.created_at,
        'updated_at', v_route.updated_at
      )
    ELSE NULL END,
    'waypoints', COALESCE(v_waypoints, '[]'::jsonb)
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_ride_route_and_waypoints(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_ride_route_and_waypoints IS
  'Fetches normalized route geometry and strictly ordered waypoints for a ride.';
