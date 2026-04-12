-- ============================================================
-- FIX: Break infinite recursion between companies <-> company_members RLS
-- The old policies had circular dependencies:
--   companies SELECT -> fn_user_company_ids() -> company_members SELECT
--   company_members SELECT -> companies JOIN -> companies SELECT (loop)
-- 
-- Solution:
--   1. company_members: flat policies using only user_id = auth.uid()
--   2. companies: use a SECURITY DEFINER helper that bypasses RLS
-- ============================================================

-- Step 1: Drop all existing policies on both tables
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_manage_policy" ON public.companies;
DROP POLICY IF EXISTS "company_members_select_policy" ON public.company_members;
DROP POLICY IF EXISTS "company_members_manage_policy" ON public.company_members;

-- Step 2: Helper function (SECURITY DEFINER bypasses RLS on company_members)
CREATE OR REPLACE FUNCTION public.fn_my_company_ids()
RETURNS SETOF uuid AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_is_company_admin(p_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND user_type IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Step 3: company_members — flat, non-recursive policies
CREATE POLICY "cm_select" ON public.company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cm_insert" ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cm_update" ON public.company_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cm_delete" ON public.company_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Step 4: companies — uses SECURITY DEFINER helpers (no RLS re-entry)
CREATE POLICY "co_select" ON public.companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.fn_my_company_ids()));

CREATE POLICY "co_insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "co_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.fn_is_company_admin(id))
  WITH CHECK (public.fn_is_company_admin(id));

CREATE POLICY "co_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (public.fn_is_company_admin(id));;
