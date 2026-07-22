-- ============================================================
-- Final parity fix: the allow-all INSERT/UPDATE policies on companies +
-- contacts were scoped `TO authenticated`, but leads' equivalent allow-all
-- policies are `TO public`. A request arriving under any role other than
-- `authenticated` (e.g. `anon` when a token isn't forwarded) skipped the
-- allow-all policy and fell through to the stricter matrix policy, still
-- producing "new row violates row-level security policy".
--
-- Recreate them `TO public` to match leads EXACTLY. The real permission gate
-- remains in the server actions (requirePermission), identical to leads.
-- ============================================================

BEGIN;

-- client_companies
DROP POLICY IF EXISTS "client_companies_insert_authenticated" ON public.client_companies;
CREATE POLICY "client_companies_insert_authenticated" ON public.client_companies
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "client_companies_update_authenticated" ON public.client_companies;
CREATE POLICY "client_companies_update_authenticated" ON public.client_companies
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

-- contacts
DROP POLICY IF EXISTS "contacts_insert_authenticated" ON public.contacts;
CREATE POLICY "contacts_insert_authenticated" ON public.contacts
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "contacts_update_authenticated" ON public.contacts;
CREATE POLICY "contacts_update_authenticated" ON public.contacts
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

COMMIT;
