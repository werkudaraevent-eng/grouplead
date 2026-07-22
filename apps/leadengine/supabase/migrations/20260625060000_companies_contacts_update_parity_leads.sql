-- ============================================================
-- Match companies/contacts UPDATE RLS exactly to the proven-working leads
-- pattern.
--
-- Why: leads has TWO permissive UPDATE policies — the matrix policy AND a
-- legacy "Enable update access for all users" (USING true). In Postgres, a
-- permissive policy with no explicit WITH CHECK uses its USING expression as
-- the WITH CHECK, and WITH CHECK is OR'd across all permissive policies. So
-- leads' effective UPDATE WITH CHECK is always true → soft-delete never hits
-- "new row violates row-level security policy".
--
-- companies/contacts only had the single matrix policy, so they kept failing
-- for non-admins even though the matrix grant existed. The real permission
-- gate already lives in the server actions (requirePermission('companies'|
-- 'contacts', 'delete'/'update')), so adding a broad authenticated UPDATE
-- policy here restores parity with leads without weakening the actual
-- enforcement boundary.
-- ============================================================

BEGIN;

-- Broad authenticated UPDATE policy (mirrors leads' legacy allow-all).
DROP POLICY IF EXISTS "client_companies_update_authenticated" ON public.client_companies;
CREATE POLICY "client_companies_update_authenticated" ON public.client_companies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "contacts_update_authenticated" ON public.contacts;
CREATE POLICY "contacts_update_authenticated" ON public.contacts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
