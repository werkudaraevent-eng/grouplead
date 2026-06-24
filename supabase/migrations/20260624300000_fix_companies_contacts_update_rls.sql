-- ============================================================
-- Fix: align client_companies + contacts write/visibility RLS so the
-- soft-delete (Recycle Bin) flow works for non-admin roles that hold the
-- matrix grant — mirroring how leads already behaves.
--
-- Root cause:
--   • leads keeps a legacy permissive "Enable update access for all users"
--     (USING true) policy alongside its matrix policy, so leads UPDATE always
--     passes. companies/contacts only had the matrix-only *_update_v2 policy.
--   • Soft delete sets deleted_at. The companies/contacts SELECT policy only
--     lets admins see deleted rows, and the matrix-only UPDATE WITH CHECK was
--     stricter than leads. Net effect: a Leader with companies.update +
--     companies.delete grants still got "new row violates RLS".
--
-- Fix (scoped, not wide-open):
--   • UPDATE allowed when the user has the companies/contacts update OR delete
--     matrix grant, OR has company access to the row (membership / holding /
--     unassigned). This matches leads' effective permissiveness while keeping
--     it tied to company scope.
--   • SELECT: keep deleted rows visible to admins, but the active-row branch
--     already covers normal access. (Unchanged structurally.)
-- ============================================================

BEGIN;

-- ── client_companies UPDATE ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_companies_update_v2" ON public.client_companies;
CREATE POLICY "client_companies_update_v2" ON public.client_companies
  FOR UPDATE
  USING (
    public.fn_user_has_matrix_permission(company_id, 'companies', 'update')
    OR public.fn_user_has_matrix_permission(company_id, 'companies', 'delete')
    OR company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  )
  WITH CHECK (
    public.fn_user_has_matrix_permission(company_id, 'companies', 'update')
    OR public.fn_user_has_matrix_permission(company_id, 'companies', 'delete')
    OR company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  );

-- ── contacts UPDATE ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts_update_v2" ON public.contacts;
CREATE POLICY "contacts_update_v2" ON public.contacts
  FOR UPDATE
  USING (
    public.fn_user_has_matrix_permission(company_id, 'contacts', 'update')
    OR public.fn_user_has_matrix_permission(company_id, 'contacts', 'delete')
    OR company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  )
  WITH CHECK (
    public.fn_user_has_matrix_permission(company_id, 'contacts', 'update')
    OR public.fn_user_has_matrix_permission(company_id, 'contacts', 'delete')
    OR company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  );

COMMIT;
