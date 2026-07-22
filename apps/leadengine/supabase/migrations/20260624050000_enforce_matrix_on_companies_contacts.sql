-- ============================================================
-- Enforce the permission matrix on client_companies + contacts writes.
--
-- Problem: INSERT/UPDATE/DELETE on these two tables were RLS = `true`
-- (wide open to any authenticated user). The Roles & Permissions matrix
-- toggles for the `companies` / `contacts` modules therefore only hid UI
-- buttons — a direct client call (or anyone bypassing the UI) could still
-- write. This closes that hole at the database layer, the true security
-- boundary.
--
-- Model (mirrors leads_delete_policy):
--   • Super admin (profiles.role) always allowed.
--   • Otherwise the user must (a) have company access to the row, AND
--     (b) hold the matching matrix grant for the module + action,
--     resolved by role_id OR legacy user_type OR legacy text role.
--   • NULL company_id rows (legacy/unassigned) stay writable by any
--     company member so existing flows don't break.
--
-- A SECURITY DEFINER helper centralises the matrix lookup so the policies
-- stay readable and consistent.
-- ============================================================

BEGIN;

-- ── Helper: does the current user hold `action` on `module` for `target_company`? ──
CREATE OR REPLACE FUNCTION public.fn_user_has_matrix_permission(
    target_company uuid,
    target_module text,
    action text  -- one of: 'create' | 'read' | 'update' | 'delete'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        -- Global super admin bypass.
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND lower(replace(coalesce(p.role, ''), ' ', '_')) = 'super_admin'
        )
        OR (
            target_company IS NOT NULL
            AND target_company = ANY(public.fn_user_company_ids())
            AND EXISTS (
                SELECT 1
                FROM public.profiles p
                LEFT JOIN public.company_members cm
                  ON cm.user_id = p.id
                 AND cm.company_id = target_company
                JOIN public.role_permissions rp
                  ON rp.company_id = target_company
                 AND rp.module_id = target_module
                 AND (
                   (p.role_id IS NOT NULL AND rp.role_id = p.role_id)
                   OR (rp.user_type IS NOT NULL AND rp.user_type = cm.user_type)
                   OR (rp.user_type IS NOT NULL AND rp.user_type = lower(replace(coalesce(p.role, ''), ' ', '_')))
                 )
                WHERE p.id = auth.uid()
                  AND (
                    (action = 'create' AND rp.can_create = true)
                    OR (action = 'update' AND rp.can_update = true)
                    OR (action = 'delete' AND rp.can_delete = true)
                    OR (action = 'read'   AND rp.can_read <> 'none')
                  )
            )
        )
        -- Legacy/unassigned rows (no company) remain writable by members so
        -- existing onboarding/import flows keep working.
        OR target_company IS NULL
$$;

-- ── client_companies ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_companies_insert" ON public.client_companies;
DROP POLICY IF EXISTS "client_companies_update" ON public.client_companies;
DROP POLICY IF EXISTS "client_companies_delete" ON public.client_companies;

CREATE POLICY "client_companies_insert_v2" ON public.client_companies
  FOR INSERT
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'companies', 'create'));

CREATE POLICY "client_companies_update_v2" ON public.client_companies
  FOR UPDATE
  USING (public.fn_user_has_matrix_permission(company_id, 'companies', 'update'))
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'companies', 'update'));

CREATE POLICY "client_companies_delete_v2" ON public.client_companies
  FOR DELETE
  USING (public.fn_user_has_matrix_permission(company_id, 'companies', 'delete'));

-- ── contacts ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;

CREATE POLICY "contacts_insert_v2" ON public.contacts
  FOR INSERT
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'contacts', 'create'));

CREATE POLICY "contacts_update_v2" ON public.contacts
  FOR UPDATE
  USING (public.fn_user_has_matrix_permission(company_id, 'contacts', 'update'))
  WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'contacts', 'update'));

CREATE POLICY "contacts_delete_v2" ON public.contacts
  FOR DELETE
  USING (public.fn_user_has_matrix_permission(company_id, 'contacts', 'delete'));

COMMIT;
