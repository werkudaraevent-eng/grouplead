-- ============================================================
-- Enforce lead delete permission at the database layer.
--
-- Problem fixed:
-- Client components could call `supabase.from('leads').delete()` directly and
-- bypass the guarded Server Action. The previous RLS policy only checked
-- company membership, so Sales users in the company could delete leads even
-- when the permission matrix had `can_delete = false`.
--
-- This policy requires BOTH:
--   1) user has company access to the lead's company, and
--   2) permission matrix grants `leads.can_delete = true` for their role_id
--      or legacy user_type.
-- Super admins still bypass via profiles.role = 'super_admin'.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE
USING (
  -- Global super admin bypass.
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(replace(coalesce(p.role, ''), ' ', '_')) = 'super_admin'
  )
  OR (
    -- Must be scoped to the lead's company first.
    company_id = ANY(public.fn_user_company_ids())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.company_members cm
        ON cm.user_id = p.id
       AND cm.company_id = leads.company_id
      JOIN public.role_permissions rp
        ON rp.company_id = leads.company_id
       AND rp.module_id = 'leads'
       AND rp.can_delete = true
       AND (
         (p.role_id IS NOT NULL AND rp.role_id = p.role_id)
         OR (rp.user_type IS NOT NULL AND rp.user_type = cm.user_type)
         OR (rp.user_type IS NOT NULL AND rp.user_type = lower(replace(coalesce(p.role, ''), ' ', '_')))
       )
      WHERE p.id = auth.uid()
    )
  )
);

COMMIT;
