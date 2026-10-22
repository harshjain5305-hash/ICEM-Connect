-- Migration: 20261022000001_soft_delete_and_auto_purge_2days.sql
-- Description: Adds deleted_at column for 2-day soft-delete auto-purge on rides and join requests,
--              and provides stored procedures for 2-day garbage collection and notification clear all.

-- 1. ADD DELETED_AT COLUMNS
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.ride_join_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. STORED PROCEDURE: cleanup_dismissed_rides_and_requests
-- Purges rides and join requests soft-deleted more than 2 days ago (48 hours)
CREATE OR REPLACE FUNCTION public.cleanup_dismissed_rides_and_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_requests INT := 0;
  v_deleted_rides INT := 0;
BEGIN
  -- 1. Purge join requests soft-deleted > 2 days ago
  DELETE FROM public.ride_join_requests
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - INTERVAL '2 days');
  GET DIAGNOSTICS v_deleted_requests = ROW_COUNT;

  -- 2. Purge rides soft-deleted > 2 days ago
  DELETE FROM public.rides
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - INTERVAL '2 days');
  GET DIAGNOSTICS v_deleted_rides = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'purged_requests', v_deleted_requests,
    'purged_rides', v_deleted_rides,
    'timestamp', now()
  );
END;
$$;

-- 3. STORED PROCEDURE: clear_user_notifications
-- Permanently deletes all notifications for a given user
CREATE OR REPLACE FUNCTION public.clear_user_notifications(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_count,
    'user_id', p_user_id
  );
END;
$$;

-- 4. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.cleanup_dismissed_rides_and_requests() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_user_notifications(UUID) TO anon, authenticated, service_role;
