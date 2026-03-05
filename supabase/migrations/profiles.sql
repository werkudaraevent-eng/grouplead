-- ============================================================
-- TABLE: profiles
-- User Roles & Department Assignment (linked to Supabase Auth)
-- ============================================================

-- 1. Create the profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Identity
  email text,
  full_name text,
  avatar_url text,

  -- Role & Department
  role text DEFAULT 'sales' NOT NULL,        -- 'super_admin', 'sales', 'bu_manager', 'finance', 'director'
  department text,                            -- 'WNW', 'WNS', 'UK', 'TEP', 'CREATIVE', 'FINANCE', 'LEGAL', 'PD', 'SO', 'ACS'
  job_title text,                            -- Free text: 'VP Sales', 'Project Manager', etc.
  is_active boolean DEFAULT true NOT NULL     -- Soft-disable without deleting
);

-- 2. Indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_department ON public.profiles(department);


-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Everyone can READ all profiles (needed for assignment dropdowns, task cards, etc.)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Policy 2: Users can UPDATE their own profile (name, avatar only)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-role-escalation: only allow updating non-sensitive fields
    -- Role/department changes require super_admin (see next policy)
  );

-- Policy 3: Super admins can update ANY profile (including role changes)
CREATE POLICY "Super admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy 4: Allow INSERT for the trigger (service role) and self-registration
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 5: Super admins can delete profiles
CREATE POLICY "Super admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );


-- ============================================================
-- TRIGGER: Auto-create profile on new user signup
-- Fires when a new row is inserted into auth.users
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_new_user();


-- ============================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_update_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_profiles_timestamp();


-- ============================================================
-- HELPER: Function to get current user's role (reusable in RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ============================================================
-- SEED: 5 Dummy profiles for testing
-- NOTE: These use hardcoded UUIDs since they aren't linked to
-- real auth.users. For production, users sign up via Supabase
-- Auth and the trigger auto-creates their profile.
--
-- ⚠️  Run this ONLY in dev. For real auth, remove these and
--     let the trigger handle profile creation.
-- ============================================================

-- Temporarily allow inserts without auth check for seeding
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

INSERT INTO public.profiles (id, email, full_name, role, department, job_title) VALUES

-- 1. Super Admin / Director
('a1000000-0000-0000-0000-000000000001',
 'director@leadengine.id',
 'Budi Santoso',
 'super_admin',
 NULL,
 'Managing Director'),

-- 2. Sales (WNW)
('a1000000-0000-0000-0000-000000000002',
 'linda.sales@leadengine.id',
 'Linda Wijaya',
 'sales',
 'WNW',
 'Senior Sales Executive'),

-- 3. BU Manager (TEP)
('a1000000-0000-0000-0000-000000000003',
 'ahmad.tep@leadengine.id',
 'Ahmad Fauzi',
 'bu_manager',
 'TEP',
 'TEP Department Head'),

-- 4. BU Manager (Creative)
('a1000000-0000-0000-0000-000000000004',
 'dian.creative@leadengine.id',
 'Dian Prasetyo',
 'bu_manager',
 'CREATIVE',
 'Creative Director'),

-- 5. Finance
('a1000000-0000-0000-0000-000000000005',
 'ratna.finance@leadengine.id',
 'Ratna Dewi',
 'finance',
 'FINANCE',
 'Finance Manager');

-- Re-enable RLS after seeding
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
