-- ICEM Connect Phase 1 Migration: Authentication + Student Identity
-- Conforms to Phases.md §5, Architecture.md §5 & §6.1, and Rules.md §2.3

-- 1. AUTOMATIC PROFILE AND ROLE PROVISIONING TRIGGER ON AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_student_signup()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  student_prn TEXT;
  student_dept TEXT;
  student_year INT;
  allowed_domain TEXT := 'indiraicem.ac.in';
BEGIN
  -- Strict server-side verification: Email domain must match
  IF NEW.email NOT LIKE '%@' || allowed_domain THEN
    RAISE EXCEPTION 'Registration restricted: Email must end with @%', allowed_domain
      USING ERRCODE = 'check_violation';
  END IF;

  -- Extract metadata provided during registration
  student_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  student_prn := COALESCE(NEW.raw_user_meta_data->>'prn', 'PRN_' || substr(NEW.id::text, 1, 8));
  student_dept := NEW.raw_user_meta_data->>'department';
  student_year := (NEW.raw_user_meta_data->>'year')::INT;

  -- Create private student profile
  INSERT INTO public.students (
    id,
    name,
    email,
    prn,
    department,
    year,
    status,
    rating_average,
    rating_count
  ) VALUES (
    NEW.id,
    student_name,
    NEW.email,
    student_prn,
    student_dept,
    student_year,
    'ACTIVE',
    5.00,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now();

  -- Assign default STUDENT role in isolated user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'STUDENT')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users if auth schema is available
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_student_signup();
EXCEPTION
  WHEN undefined_table THEN null;
END $$;

-- 2. SECURE FUNCTION TO FETCH STUDENT PROFILE WITH PRN PRIVACY ENFORCEMENT
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

  -- If caller is the student themselves or an admin, return full profile including PRN
  IF caller_id = target_student_id OR is_caller_admin IS TRUE THEN
    RETURN jsonb_build_object(
      'id', student_row.id,
      'name', student_row.name,
      'email', student_row.email,
      'prn', student_row.prn,
      'department', student_row.department,
      'year', student_row.year,
      'profile_image_url', student_row.profile_image_url,
      'status', student_row.status,
      'rating_average', student_row.rating_average,
      'rating_count', student_row.rating_count,
      'created_at', student_row.created_at
    );
  ELSE
    -- Public projection: PRN is strictly omitted
    RETURN jsonb_build_object(
      'id', student_row.id,
      'name', student_row.name,
      'department', student_row.department,
      'year', student_row.year,
      'profile_image_url', student_row.profile_image_url,
      'status', student_row.status,
      'rating_average', student_row.rating_average,
      'rating_count', student_row.rating_count,
      'created_at', student_row.created_at
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_profile(UUID) TO authenticated;

-- 3. SECURE FUNCTION TO UPDATE NON-SENSITIVE PROFILE FIELDS
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_department TEXT,
  p_year INT,
  p_profile_image_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id UUID := auth.uid();
  updated_row RECORD;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.students
  SET
    department = p_department,
    year = p_year,
    profile_image_url = p_profile_image_url,
    updated_at = now()
  WHERE id = caller_id AND status = 'ACTIVE'
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot update profile: Account not active or not found';
  END IF;

  RETURN jsonb_build_object(
    'id', updated_row.id,
    'name', updated_row.name,
    'email', updated_row.email,
    'department', updated_row.department,
    'year', updated_row.year,
    'profile_image_url', updated_row.profile_image_url,
    'status', updated_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(TEXT, INT, TEXT) TO authenticated;
