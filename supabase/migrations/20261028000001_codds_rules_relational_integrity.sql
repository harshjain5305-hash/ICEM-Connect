-- ==============================================================================
-- ICEM Connect — Migration: Codd's Rules Relational Integrity Enforcement
-- File: supabase/migrations/20261028000001_codds_rules_relational_integrity.sql
-- Description: Enforces E.F. Codd's Relational Database Rules (Rule 1, Rule 2,
--              Rule 10: Integrity Independence, and Rule 12: Nonsubversion).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CODD RULE 10 (DOMAIN INTEGRITY): GEOGRAPHIC & STRING BOUNDS ON LOCATIONS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.locations
    ADD CONSTRAINT ck_locations_latitude_range CHECK (latitude >= -90.0 AND latitude <= 90.0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.locations
    ADD CONSTRAINT ck_locations_longitude_range CHECK (longitude >= -180.0 AND longitude <= 180.0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.locations
    ADD CONSTRAINT ck_locations_name_not_blank CHECK (length(trim(name)) > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 2. CODD RULE 10 (RELATIONAL & DOMAIN INTEGRITY): WAYPOINT CONSTRAINTS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.ride_waypoints
    ADD CONSTRAINT ck_waypoints_latitude_range CHECK (latitude >= -90.0 AND latitude <= 90.0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_waypoints
    ADD CONSTRAINT ck_waypoints_longitude_range CHECK (longitude >= -180.0 AND longitude <= 180.0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_waypoints
    ADD CONSTRAINT ck_waypoints_sequence_non_negative CHECK (sequence >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_waypoints
    ADD CONSTRAINT ck_waypoints_distance_non_negative 
    CHECK (distance_from_start_meters IS NULL OR distance_from_start_meters >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_waypoints
    ADD CONSTRAINT ck_waypoints_label_not_blank CHECK (length(trim(label)) > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 3. CODD RULE 10: RIDE LOGICAL INTEGRITY (DISTINCT ORIGIN & DESTINATION)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.rides
    ADD CONSTRAINT ck_rides_distinct_origin_destination 
    CHECK (
      origin_location_id IS NULL 
      OR destination_location_id IS NULL 
      OR origin_location_id <> destination_location_id
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 4. CODD RULE 10: ROUTE METRICS INTEGRITY
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.ride_routes
    ADD CONSTRAINT ck_routes_distance_non_negative 
    CHECK (distance_meters IS NULL OR distance_meters >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_routes
    ADD CONSTRAINT ck_routes_duration_non_negative 
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 5. CODD RULE 10 & RULE 12: JOIN REQUESTS DECLARATIVE INTEGRITY
-- Enforce duplicate pending prevention in catalog (Rule 10) & seat upper bounds
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.ride_join_requests
    ADD CONSTRAINT ck_join_requests_seat_range CHECK (seat_count >= 1 AND seat_count <= 4);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Declarative partial uniqueness on pending requests (Rule 10 & Rule 12)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pending_request 
  ON public.ride_join_requests (ride_id, student_id) 
  WHERE status = 'PENDING';

-- ------------------------------------------------------------------------------
-- 6. CODD RULE 10: PARTICIPANT CAPACITY INTEGRITY
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.ride_participants
    ADD CONSTRAINT ck_participants_seat_range CHECK (seat_count >= 1 AND seat_count <= 4);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 7. CODD RULE 10: MODERATION & REPORTS INTEGRITY (NO SELF-REPORTING)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.reports
    ADD CONSTRAINT ck_no_self_report CHECK (reporter_id <> reported_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.reports
    ADD CONSTRAINT ck_reports_reason_not_blank CHECK (length(trim(reason)) > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 8. CODD RULE 10: TEMPORAL INTEGRITY (SESSIONS & MESSAGES)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.ride_sessions
    ADD CONSTRAINT ck_sessions_ended_after_started 
    CHECK (ended_at IS NULL OR ended_at >= started_at);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_messages
    ADD CONSTRAINT ck_messages_expires_after_created 
    CHECK (expires_at >= created_at);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.ride_messages
    ADD CONSTRAINT ck_messages_not_blank CHECK (length(trim(message)) > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 9. CODD RULE 12 (NONSUBVERSION): PREVENT HOST SELF-REQUEST VIA TRIGGER
-- Enforces at catalog level that low-level SQL/REST cannot subvert host-request rule
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_no_host_self_join_request()
RETURNS TRIGGER AS $$
DECLARE
  v_host_id UUID;
BEGIN
  SELECT host_id INTO v_host_id FROM public.rides WHERE id = NEW.ride_id;
  IF v_host_id IS NOT NULL AND v_host_id = NEW.student_id THEN
    RAISE EXCEPTION 'CODD_RULE_12_VIOLATION: Ride host cannot create a join request for their own ride'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_host_self_join_request ON public.ride_join_requests;
CREATE TRIGGER trg_prevent_host_self_join_request
  BEFORE INSERT OR UPDATE ON public.ride_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_no_host_self_join_request();
