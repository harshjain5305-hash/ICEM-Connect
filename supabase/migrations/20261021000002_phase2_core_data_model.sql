-- ICEM Connect Phase 2 Migration: Locations + Core Data Model
-- Conforms to Phases.md §6, Architecture.md §6.2, §6.3, §7, §8, §12, §14, §47, and Rules.md

-- 1. ENUMS FOR CORE DOMAIN
DO $$ BEGIN
  CREATE TYPE location_type AS ENUM ('ICEM', 'MAIN_ROAD', 'BUS_STOP', 'LANDMARK', 'AREA', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('DRAFT', 'PUBLISHED', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('BIKE', 'SCOOTER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE waypoint_type AS ENUM ('ORIGIN', 'WAYPOINT', 'DESTINATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE join_request_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE participant_status AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. LOCATIONS TABLE (Architecture.md §6.2)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type location_type NOT NULL DEFAULT 'AREA',
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_type ON public.locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);

-- 3. RIDES TABLE (Architecture.md §6.3)
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  origin_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  destination_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  total_seats INT NOT NULL CHECK (total_seats >= 1 AND total_seats <= 4),
  available_seats INT NOT NULL CHECK (available_seats >= 0 AND available_seats <= total_seats),
  vehicle_type vehicle_type NOT NULL DEFAULT 'SCOOTER',
  note TEXT,
  status ride_status NOT NULL DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_host ON public.rides(host_id);
CREATE INDEX IF NOT EXISTS idx_rides_date_status ON public.rides(departure_date, status);
CREATE INDEX IF NOT EXISTS idx_rides_origin_dest ON public.rides(origin_location_id, destination_location_id);

-- 4. RIDE ROUTES TABLE (Architecture.md §7.1)
CREATE TABLE IF NOT EXISTS public.ride_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL UNIQUE REFERENCES public.rides(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'internal',
  provider_route_id TEXT,
  encoded_polyline TEXT,
  geometry_json JSONB,
  distance_meters INT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RIDE WAYPOINTS TABLE (Architecture.md §7.2)
CREATE TABLE IF NOT EXISTS public.ride_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  label TEXT NOT NULL,
  type waypoint_type NOT NULL DEFAULT 'WAYPOINT',
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  distance_from_start_meters INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ride_sequence UNIQUE (ride_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_waypoints_ride_seq ON public.ride_waypoints(ride_id, sequence);

-- 6. RIDE JOIN REQUESTS TABLE (Architecture.md §8.2 & §47.2)
CREATE TABLE IF NOT EXISTS public.ride_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pickup_waypoint_id UUID REFERENCES public.ride_waypoints(id) ON DELETE SET NULL,
  drop_waypoint_id UUID REFERENCES public.ride_waypoints(id) ON DELETE SET NULL,
  seat_count INT NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  specific_area_note TEXT,
  status join_request_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_requests_ride ON public.ride_join_requests(ride_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_student ON public.ride_join_requests(student_id);

-- 7. RIDE PARTICIPANTS TABLE (Architecture.md §8.1)
CREATE TABLE IF NOT EXISTS public.ride_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pickup_waypoint_id UUID REFERENCES public.ride_waypoints(id) ON DELETE SET NULL,
  drop_waypoint_id UUID REFERENCES public.ride_waypoints(id) ON DELETE SET NULL,
  seat_count INT NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  status participant_status NOT NULL DEFAULT 'CONFIRMED',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT uq_ride_student_participant UNIQUE (ride_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_ride ON public.ride_participants(ride_id);
CREATE INDEX IF NOT EXISTS idx_participants_student ON public.ride_participants(student_id);

-- 8. RIDE SESSIONS TABLE (Architecture.md §12.1)
CREATE TABLE IF NOT EXISTS public.ride_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL UNIQUE REFERENCES public.rides(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status session_status NOT NULL DEFAULT 'ACTIVE',
  location_enabled BOOLEAN NOT NULL DEFAULT false,
  last_location_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. RATINGS TABLE (Architecture.md §14)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ride_rating UNIQUE (ride_id, reviewer_id, reviewee_id),
  CONSTRAINT ck_no_self_rating CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_reviewee ON public.ratings(reviewee_id);

-- 10. NOTIFICATIONS TABLE (Architecture.md §14)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SYSTEM',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- 11. REPORTS TABLE (Architecture.md §14)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 12. RIDE COORDINATION MESSAGES (Architecture.md §47.3 - Mandatory 3-hour retention)
CREATE TABLE IF NOT EXISTS public.ride_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 hours')
);

CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON public.ride_messages(ride_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ride_messages_expires ON public.ride_messages(expires_at);

-- 13. SEED DATASET FOR ICEM CAMPUS & TRANSIT NODES (docs/locations_seed.md)
INSERT INTO public.locations (name, type, latitude, longitude, address, is_active)
VALUES
  ('ICEM Main Campus (Parandwadi)', 'ICEM', 18.723800, 73.682300, 'Indira College of Engineering & Management, Parandwadi, Talegaon, Pune 410507', true),
  ('ICEM College Main Gate & Bus Bay', 'ICEM', 18.724500, 73.681100, 'College Campus Gate, Parandwadi Road, Pune', true),
  ('Somatne Phata (Expressway Junction)', 'MAIN_ROAD', 18.718200, 73.689400, 'Old Mumbai-Pune Highway / Expressway Interchange', true),
  ('Talegaon Dabhade Railway Station', 'BUS_STOP', 18.730200, 73.674900, 'Railway Station Road, Talegaon Dabhade, Pune', true),
  ('Talegaon Station Road & Market', 'LANDMARK', 18.731500, 73.678100, 'Station Road Market, Talegaon Dabhade', true),
  ('Dehu Road Station Chowk', 'BUS_STOP', 18.715600, 73.731200, 'Dehu Road Cantonment, Pune', true),
  ('Kiwale Phata / Mukai Chowk (BRTS)', 'MAIN_ROAD', 18.665400, 73.743200, 'Kiwale, Ravet BRTS Corridor, Pune', true),
  ('Ravet Chowk / D.Y. Patil Road', 'AREA', 18.652100, 73.754800, 'Ravet, Pimpri-Chinchwad, Pune', true),
  ('Akurdi Railway Station Chowk', 'BUS_STOP', 18.647800, 73.771100, 'Akurdi Station Road, PCMC, Pune', true),
  ('Chinchwad Station (Old Highway)', 'BUS_STOP', 18.634100, 73.791500, 'Mumbai-Pune Road, Chinchwad, Pune', true),
  ('Pimpri Station & Market Chowk', 'LANDMARK', 18.625800, 73.805200, 'Dr. Ambedkar Chowk, Pimpri, Pune', true),
  ('Nigdi Bus Depot / Bhakti Shakti', 'BUS_STOP', 18.662100, 73.766700, 'Bhakti Shakti Terminal, Nigdi, Pune', true),
  ('Bhosari Bus Stand (Alandi Road)', 'MAIN_ROAD', 18.621400, 73.844100, 'Pune-Nashik Highway, Bhosari, Pune', true),
  ('Wakad Flyover / Ginger Chowk', 'MAIN_ROAD', 18.599800, 73.765400, 'Hinjewadi-Wakad Road Junction, Pune', true),
  ('Hinjewadi Shivaji Chowk (Phase 1)', 'AREA', 18.591200, 73.738900, 'Rajiv Gandhi Infotech Park Phase 1, Hinjewadi, Pune', true)
ON CONFLICT DO NOTHING;

-- 14. SEARCH LOCATIONS STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.search_locations(
  p_query TEXT,
  p_type location_type DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type location_type,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.type,
    l.latitude,
    l.longitude,
    l.address
  FROM public.locations l
  WHERE
    l.is_active = true
    AND (p_type IS NULL OR l.type = p_type)
    AND (
      p_query IS NULL
      OR p_query = ''
      OR l.name ILIKE '%' || p_query || '%'
      OR l.address ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE WHEN l.type = 'ICEM' THEN 0 ELSE 1 END,
    l.name ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_locations(TEXT, location_type, INT) TO anon, authenticated;

-- 15. ROW LEVEL SECURITY (RLS) FOR CORE DATA MODEL

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

-- Locations: Anyone can read active locations; only Admins can create/edit
CREATE POLICY "Anyone can view active locations"
  ON public.locations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage locations"
  ON public.locations FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Rides: Anyone authenticated can view published or active rides
CREATE POLICY "Authenticated users can view open rides"
  ON public.rides FOR SELECT
  TO authenticated
  USING (status IN ('PUBLISHED', 'CONFIRMED', 'ACTIVE', 'COMPLETED') OR host_id = auth.uid());

CREATE POLICY "Hosts can create and manage their own rides"
  ON public.rides FOR ALL
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Ride Waypoints & Routes: Read with ride
CREATE POLICY "Users can view waypoints of visible rides"
  ON public.ride_waypoints FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id));

CREATE POLICY "Hosts can manage waypoints of own rides"
  ON public.ride_waypoints FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id AND host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id AND host_id = auth.uid()));

CREATE POLICY "Users can view routes of visible rides"
  ON public.ride_routes FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id));

-- Ride Join Requests: Requesters and hosts can see requests
CREATE POLICY "Requesters and hosts can view join requests"
  ON public.ride_join_requests FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id AND host_id = auth.uid())
  );

CREATE POLICY "Active students can create join requests"
  ON public.ride_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_active_student(auth.uid()));

CREATE POLICY "Participants and hosts can view participants"
  ON public.ride_participants FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rides WHERE id = ride_id AND host_id = auth.uid())
  );

-- Notifications: Only recipient can view
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
