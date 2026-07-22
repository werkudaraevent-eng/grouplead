-- ============================================================
-- Complete the RLS parity with leads for companies + contacts.
--
-- leads has allow-all permissive policies on BOTH insert and update:
--   • "Enable insert access for all users" WITH CHECK (true)
--   • "Enable update access for all users" USING (true)
-- plus its matrix policies. Because permissive policies are OR'd, leads
-- writes never hit "new row violates row-level security policy" — the real
-- gate lives in the server actions (requirePermission).
--
-- Previous migration added the allow-all UPDATE policy to companies/contacts.
-- This one adds the matching allow-all INSERT policy, which is the piece that
-- was still failing ("new row violates ... contacts"/"client_companies" on
-- create paths). After this, companies + contacts behave exactly like leads
-- at the RLS layer; permission enforcement remains in the guarded actions.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "client_companies_insert_authenticated" ON public.client_companies;
CREATE POLICY "client_companies_insert_authenticated" ON public.client_companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contacts_insert_authenticated" ON public.contacts;
CREATE POLICY "contacts_insert_authenticated" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMIT;
