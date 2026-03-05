-- ============================================================
-- RLS: Multi-Company Row Level Security
-- Helper functions and company-scoped policies
-- Run AFTER migration_multi_company.sql
-- ============================================================

-- ========================================================
-- HELPER FUNCTIONS
-- ========================================================

-- Returns array of company IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.fn_user_company_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    array_agg(cm.company_id),
    '{}'::uuid[]
  )
  FROM public.company_members cm
  WHERE cm.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Returns true if the current user is a member of a holding company
CREATE OR REPLACE FUNCTION public.fn_user_has_holding_access()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.user_id = auth.uid() AND c.is_holding = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ========================================================
-- LEADS RLS (replace existing permissive policy)
-- ========================================================

DROP POLICY IF EXISTS "Allow public access to leads" ON public.leads;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_policy" ON public.leads FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "leads_insert_policy" ON public.leads FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "leads_update_policy" ON public.leads FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "leads_delete_policy" ON public.leads FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ========================================================
-- LEAD TASKS RLS (replace existing permissive policy)
-- ========================================================

DROP POLICY IF EXISTS "Allow public access to lead_tasks" ON public.lead_tasks;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_tasks_select_policy" ON public.lead_tasks FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "lead_tasks_insert_policy" ON public.lead_tasks FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "lead_tasks_update_policy" ON public.lead_tasks FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "lead_tasks_delete_policy" ON public.lead_tasks FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ========================================================
-- MASTER OPTIONS RLS (replace existing permissive policy)
-- ========================================================

DROP POLICY IF EXISTS "Allow public access to master_options" ON public.master_options;
ALTER TABLE public.master_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_options_select_policy" ON public.master_options FOR SELECT
  USING (
    company_id IS NULL
    OR company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "master_options_insert_policy" ON public.master_options FOR INSERT
  WITH CHECK (
    company_id IS NULL
    OR company_id = ANY(public.fn_user_company_ids())
  );

CREATE POLICY "master_options_update_policy" ON public.master_options FOR UPDATE
  USING (company_id IS NULL OR company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id IS NULL OR company_id = ANY(public.fn_user_company_ids()));

-- ========================================================
-- COMPANY MEMBERS RLS
-- ========================================================

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_policy" ON public.company_members FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "company_members_manage_policy" ON public.company_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = company_members.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
  );

-- ========================================================
-- COMPANIES RLS
-- ========================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_policy" ON public.companies FOR SELECT
  USING (
    id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "companies_manage_policy" ON public.companies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.companies c ON c.id = cm.company_id
      WHERE cm.user_id = auth.uid()
        AND c.is_holding = true
        AND cm.user_type = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.companies c ON c.id = cm.company_id
      WHERE cm.user_id = auth.uid()
        AND c.is_holding = true
        AND cm.user_type = 'super_admin'
    )
  );

-- ========================================================
-- ROLE PERMISSIONS RLS
-- ========================================================

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_policy" ON public.role_permissions FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "role_permissions_manage_policy" ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = role_permissions.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = role_permissions.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
  );
