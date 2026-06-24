-- ============================================================
-- Recycle Bin RLS: who can see trashed rows, and who can hard-delete.
--
-- SELECT: a user sees a row if it's active (deleted_at IS NULL) under the
--   existing company-scope rules, OR it's trashed AND they are admin/
--   super_admin (so the Recycle Bin can list trashed items).
-- DELETE (hard/permanent): restricted to admin/super_admin. Normal "delete"
--   in the app is a soft delete (UPDATE deleted_at), already governed by the
--   matrix update policy.
--
-- We add a helper fn_user_is_admin() for the admin/super-admin check.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND lower(replace(coalesce(p.role, ''), ' ', '_')) IN ('super_admin', 'admin')
    )
$$;

-- ── leads SELECT ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT
USING (
    (
        (deleted_at IS NULL)
        AND (
            company_id = ANY(public.fn_user_company_ids())
            OR public.fn_user_has_holding_access()
        )
    )
    OR (deleted_at IS NOT NULL AND public.fn_user_is_admin())
);

-- ── client_companies SELECT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_companies_select_v2" ON public.client_companies;
CREATE POLICY "client_companies_select_v2" ON public.client_companies
FOR SELECT
USING (
    (
        (deleted_at IS NULL)
        AND (
            company_id = ANY(public.fn_user_company_ids())
            OR public.fn_user_has_holding_access()
            OR company_id IS NULL
        )
    )
    OR (deleted_at IS NOT NULL AND public.fn_user_is_admin())
);

-- ── contacts SELECT ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts_select_v2" ON public.contacts;
CREATE POLICY "contacts_select_v2" ON public.contacts
FOR SELECT
USING (
    (
        (deleted_at IS NULL)
        AND (
            company_id = ANY(public.fn_user_company_ids())
            OR public.fn_user_has_holding_access()
            OR company_id IS NULL
        )
    )
    OR (deleted_at IS NOT NULL AND public.fn_user_is_admin())
);

-- ── Hard delete (permanent) — admin/super_admin only ─────────────────────────
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;
CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE USING (public.fn_user_is_admin());

DROP POLICY IF EXISTS "client_companies_delete_v2" ON public.client_companies;
CREATE POLICY "client_companies_delete_v2" ON public.client_companies
FOR DELETE USING (public.fn_user_is_admin());

DROP POLICY IF EXISTS "contacts_delete_v2" ON public.contacts;
CREATE POLICY "contacts_delete_v2" ON public.contacts
FOR DELETE USING (public.fn_user_is_admin());

COMMIT;
