-- ============================================================
-- Cleanup: revert the RLS loosening that was added while chasing the
-- soft-delete bug. The real fix now lives in the server actions
-- (deleteClientCompaniesAction / deleteContactsAction): they check
-- permission + business-unit scope, then write via createServiceClient()
-- which bypasses RLS. So the broad allow-all policies are no longer needed —
-- and they were a security hole (any caller could INSERT/UPDATE bypassing the
-- permission matrix).
--
-- This migration:
--   1) Drops the 4 allow-all (`WITH CHECK true`, TO public) policies.
--   2) Restores the *_update_v2 policies to the original matrix-only form
--      (matches migration 20260624050000), removing the extra OR delete/
--      company/holding escape hatch that was only added to force soft-delete
--      through RLS.
--
-- Net result: companies/contacts write RLS is back to the intended
-- matrix-enforced model. Create/update via the app go through createClient()
-- and are gated by the matrix policies; delete goes through the guarded
-- service-client server actions.
-- ============================================================

BEGIN;

-- 1. Drop the allow-all policies.
DROP POLICY IF EXISTS "client_companies_insert_authenticated" ON public.client_companies;
DROP POLICY IF EXISTS "client_companies_update_authenticated" ON public.client_companies;
DROP POLICY IF EXISTS "contacts_insert_authenticated" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_authenticated" ON public.contacts;

-- 2. Restore matrix-only UPDATE policies.
DROP POLICY IF EXISTS "client_companies_update_v2" ON public.client_companies;
CREATE POLICY "client_companies_update_v2" ON public.client_companies
  FOR UPDATE
  USING (public.fn_user_has_matrix_permission(company_id, 'companies', 'update'))
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'companies', 'update'));

DROP POLICY IF EXISTS "contacts_update_v2" ON public.contacts;
CREATE POLICY "contacts_update_v2" ON public.contacts
  FOR UPDATE
  USING (public.fn_user_has_matrix_permission(company_id, 'contacts', 'update'))
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'contacts', 'update'));

COMMIT;
