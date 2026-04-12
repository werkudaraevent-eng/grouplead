-- ============================================================
-- RBAC Matrix Permissions Migration
-- Replaces flat resource/action/is_allowed with granular matrix
-- ============================================================

-- ============================================================
-- STEP 1: Create app_modules lookup table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read modules
CREATE POLICY "app_modules_select" ON public.app_modules
  FOR SELECT TO authenticated USING (true);

-- Only super_admins (via profiles.role) can manage modules
CREATE POLICY "app_modules_manage" ON public.app_modules
  FOR ALL TO authenticated
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

-- ============================================================
-- STEP 2: Seed app_modules
-- ============================================================
INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('leads',          'Leads',          'Lead pipeline and management',       1),
  ('lead_tasks',     'Tasks',          'Department task workflows',          2),
  ('companies',      'Companies',      'Company/subsidiary management',      3),
  ('contacts',       'Contacts',       'Client contacts',                    4),
  ('users',          'Users',          'User and profile management',        5),
  ('master_options', 'Master Options', 'Dropdown and configuration options', 6),
  ('pipeline',       'Pipeline',       'Pipeline stage settings',            7),
  ('analytics',      'Analytics',      'Dashboard and reporting',            8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Drop old role_permissions and recreate as matrix
-- ============================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_manage_policy" ON public.role_permissions;

-- Drop old table
DROP TABLE IF EXISTS public.role_permissions;

-- Recreate with matrix columns
CREATE TABLE public.role_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_type text NOT NULL
    CHECK (user_type IN ('staff', 'leader', 'executive', 'admin', 'super_admin')),
  module_id text NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
  can_create boolean DEFAULT false NOT NULL,
  can_read text DEFAULT 'none' NOT NULL
    CHECK (can_read IN ('none', 'own', 'company', 'all')),
  can_update boolean DEFAULT false NOT NULL,
  can_delete boolean DEFAULT false NOT NULL,
  UNIQUE (company_id, user_type, module_id)
);

CREATE INDEX idx_role_permissions_lookup
  ON public.role_permissions(company_id, user_type);

-- ============================================================
-- STEP 4: RLS on role_permissions
-- ============================================================
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the company can read permissions
CREATE POLICY "rp_select" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only admins/super_admins can manage permissions
CREATE POLICY "rp_manage" ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = role_permissions.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = role_permissions.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );;
