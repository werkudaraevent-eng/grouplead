-- ============================================================
-- RBAC Matrix Permissions Migration
-- Replaces flat resource/action/is_allowed with granular matrix
-- ============================================================

BEGIN;

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
  );


-- ============================================================
-- STEP 5: Seed baseline permissions for all companies
-- Uses a cross join to apply defaults to every existing company
-- ============================================================

-- staff: read-own on leads/tasks, no access to admin modules
INSERT INTO public.role_permissions (company_id, user_type, module_id, can_create, can_read, can_update, can_delete)
SELECT c.id, 'staff', m.module_id, m.can_create, m.can_read, m.can_update, m.can_delete
FROM public.companies c
CROSS JOIN (VALUES
  ('leads',          false, 'own',     false, false),
  ('lead_tasks',     false, 'own',     false, false),
  ('contacts',       false, 'own',     false, false),
  ('companies',      false, 'none',    false, false),
  ('users',          false, 'none',    false, false),
  ('master_options', false, 'company', false, false),
  ('pipeline',       false, 'company', false, false),
  ('analytics',      false, 'own',     false, false)
) AS m(module_id, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

-- leader (maps to sales/bu_manager): create + read-company + update on leads/tasks
INSERT INTO public.role_permissions (company_id, user_type, module_id, can_create, can_read, can_update, can_delete)
SELECT c.id, 'leader', m.module_id, m.can_create, m.can_read, m.can_update, m.can_delete
FROM public.companies c
CROSS JOIN (VALUES
  ('leads',          true,  'company', true,  false),
  ('lead_tasks',     true,  'company', true,  false),
  ('contacts',       true,  'company', true,  false),
  ('companies',      false, 'company', false, false),
  ('users',          false, 'company', false, false),
  ('master_options', false, 'company', false, false),
  ('pipeline',       false, 'company', false, false),
  ('analytics',      false, 'company', false, false)
) AS m(module_id, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

-- executive (maps to director): full CRUD on leads/tasks, read on admin
INSERT INTO public.role_permissions (company_id, user_type, module_id, can_create, can_read, can_update, can_delete)
SELECT c.id, 'executive', m.module_id, m.can_create, m.can_read, m.can_update, m.can_delete
FROM public.companies c
CROSS JOIN (VALUES
  ('leads',          true,  'all',     true,  true),
  ('lead_tasks',     true,  'all',     true,  true),
  ('contacts',       true,  'all',     true,  false),
  ('companies',      false, 'company', false, false),
  ('users',          false, 'company', false, false),
  ('master_options', false, 'company', true,  false),
  ('pipeline',       false, 'company', true,  false),
  ('analytics',      false, 'all',     false, false)
) AS m(module_id, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

-- admin: full access to everything within their company
INSERT INTO public.role_permissions (company_id, user_type, module_id, can_create, can_read, can_update, can_delete)
SELECT c.id, 'admin', m.module_id, m.can_create, m.can_read, m.can_update, m.can_delete
FROM public.companies c
CROSS JOIN (VALUES
  ('leads',          true,  'all', true,  true),
  ('lead_tasks',     true,  'all', true,  true),
  ('contacts',       true,  'all', true,  true),
  ('companies',      true,  'all', true,  true),
  ('users',          true,  'all', true,  true),
  ('master_options', true,  'all', true,  true),
  ('pipeline',       true,  'all', true,  true),
  ('analytics',      true,  'all', true,  true)
) AS m(module_id, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

-- super_admin bypasses all checks in the frontend,
-- but we seed full-access rows for completeness / UI display
INSERT INTO public.role_permissions (company_id, user_type, module_id, can_create, can_read, can_update, can_delete)
SELECT c.id, 'super_admin', m.module_id, true, 'all', true, true
FROM public.companies c
CROSS JOIN public.app_modules m
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

COMMIT;
