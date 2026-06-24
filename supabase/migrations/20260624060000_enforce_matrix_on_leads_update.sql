-- ============================================================
-- Enforce the permission matrix on leads UPDATE.
--
-- Problem: leads_update_policy only checked company membership, so a user
-- whose `leads.can_update = false` could still edit leads through any path
-- that writes directly (inline editor, kanban drag, etc.). Server actions
-- now guard with requirePermission, but RLS is the true boundary — this
-- closes the hole for every path at once.
--
-- Mirrors leads_delete_policy and fn_user_has_matrix_permission():
--   • Super admin always allowed.
--   • Otherwise: company access to the lead AND `leads.can_update = true`
--     resolved by role_id / legacy user_type / legacy text role.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;

CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE
USING (public.fn_user_has_matrix_permission(company_id, 'leads', 'update'))
WITH CHECK (public.fn_user_has_matrix_permission(company_id, 'leads', 'update'));

COMMIT;
