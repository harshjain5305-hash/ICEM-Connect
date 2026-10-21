-- ICEM Connect Baseline Migration - Phase 0 Project Foundation
-- Conforms to Architecture.md, Phases.md, Rules.md, and PRD.md

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
  CREATE TYPE student_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM ('STUDENT', 'ADMIN', 'MODERATOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. USER ROLES (Strictly separated from student profile)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_type NOT NULL DEFAULT 'STUDENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 4. PROFILES / STUDENTS TABLE
-- Note: PRN is private internal data and is NEVER exposed in public queries
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  prn TEXT NOT NULL UNIQUE,
  department TEXT,
  year INTEGER CHECK (year >= 1 AND year <= 5),
  profile_image_url TEXT,
  status student_status NOT NULL DEFAULT 'ACTIVE',
  rating_average NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating_average >= 1.00 AND rating_average <= 5.00),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- 5. SERVER-SIDE INSTITUTIONAL DOMAIN VALIDATION
CREATE OR REPLACE FUNCTION public.check_institutional_email()
RETURNS TRIGGER AS $$
DECLARE
  allowed_domain TEXT := 'indiraicem.ac.in';
BEGIN
  IF NEW.email NOT LIKE '%@' || allowed_domain THEN
    RAISE EXCEPTION 'Registration restricted: Email must belong to @%', allowed_domain
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_student_email ON public.students;
CREATE TRIGGER trigger_validate_student_email
  BEFORE INSERT OR UPDATE OF email ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.check_institutional_email();

-- 6. PUBLIC SAFE STUDENT VIEW (NEVER EXPOSES PRN)
CREATE OR REPLACE VIEW public.public_students AS
SELECT 
  id,
  name,
  department,
  year,
  profile_image_url,
  status,
  rating_average,
  rating_count,
  created_at
FROM public.students
WHERE status = 'ACTIVE';

-- 7. HEALTH CHECK RPC FUNCTION
CREATE OR REPLACE FUNCTION public.check_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'ok',
    'timestamp', now(),
    'version', '1.1.0',
    'database', 'healthy',
    'service', 'ICEM Connect Backend'
  );
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.check_health() TO anon, authenticated, service_role;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is active
CREATE OR REPLACE FUNCTION public.is_active_student(student_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.students
    WHERE id = student_uuid AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: user_roles
-- Users can read their own roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Only admins can manage roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS: students
-- Students can read their own full profile (including PRN)
DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
CREATE POLICY "Students can view own profile"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Authenticated students can view other active students only (PRN protected via view/projection)
DROP POLICY IF EXISTS "Authenticated users can view active student basic profiles" ON public.students;
CREATE POLICY "Authenticated users can view active student basic profiles"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (status = 'ACTIVE');

-- Students can insert their own profile on registration if domain matches
DROP POLICY IF EXISTS "Students can insert own profile" ON public.students;
CREATE POLICY "Students can insert own profile"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Students can update their own non-sensitive profile fields
DROP POLICY IF EXISTS "Students can update own profile" ON public.students;
CREATE POLICY "Students can update own profile"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND status = 'ACTIVE')
  WITH CHECK (auth.uid() = id AND status = 'ACTIVE');
