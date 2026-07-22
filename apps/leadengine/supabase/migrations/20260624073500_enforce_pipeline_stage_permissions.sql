-- ============================================================
-- Enforce pipeline stage management permissions at the DB layer.
--
-- Problem fixed:
-- `pipeline_stages` had fully open RLS — any authenticated user could
-- INSERT / UPDATE / DELETE stages directly via the Supabase client
-- (and the kanban / settings UIs did exactly that). There was no link to
-- the RBAC matrix, so every signed-in user could rename, clone, reorder,
-- recolor, and delete pipeline stages.
--
-- This migration:
--   1) Adds a SECURITY DEFINER helper `fn_user_has_pipeline_perm(action)`
--      that resolves the caller's `pipeline` grant from `role_permissions`
--      across any of their companies (role_id first, then legacy user_type),
--      with a global super_admin bypass.
--   2) Replaces the open INSERT / UPDATE / DELETE policies on
--      `pipeline_stages` with ones gated by that helper. SELECT stays open
--      (every user needs to read stages to render the board).
--
-- NOTE: `pipeline_stages` is a GLOBAL table (no company_id column), so the
-- grant is evaluated as "has the pipeline.<action> grant in at least one of
-- the user's companies". This matches how the UI resolves `activeCompany`.
-- ============================================================

BEGIN;

-- ── Ensure the `pipeline` module exists ─────────────────────────────────────
-- The original RBAC seed (20260311031441) was never applied to some installs,
-- so `app_modules.pipeline` may be missing. role_permissions.module_id has an
-- FK to app_modules(id), so the grant backfill below would fail without this.
INSERT INTO public.app_modules (id, name, description, sort_order)
VALUES ('pipeline', 'Pipeline', 'Pipeline stage settings', 7)
ON CONFLICT (id) DO NOTHING;

-- ── Helper: does the current user hold pipeline.<action>? ───────────────────
CREATE OR REPLACE FUNCTION public.fn_user_has_pipeline_perm(p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Global super admin bypass.
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(replace(coalesce(p.role, ''), ' ', '_')) = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.company_members cm
        ON cm.user_id = p.id
      JOIN public.role_permissions rp
        ON rp.module_id = 'pipeline'
       -- Match the grant to the user's role within the same company scope.
       AND (
         (p.role_id IS NOT NULL AND rp.role_id = p.role_id)
         OR (rp.user_type IS NOT NULL AND rp.user_type = cm.user_type AND rp.company_id = cm.company_id)
         OR (rp.user_type IS NOT NULL AND rp.user_type = lower(replace(coalesce(p.role, ''), ' ', '_')))
       )
       AND (
         (p_action = 'create' AND rp.can_create = true)
         OR (p_action = 'update' AND rp.can_update = true)
         OR (p_action = 'delete' AND rp.can_delete = true)
       )
      WHERE p.id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.fn_user_has_pipeline_perm(text) TO authenticated;

-- ── Replace the open write policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public insert on pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Allow public update on pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Allow public delete on pipeline_stages" ON public.pipeline_stages;

CREATE POLICY "pipeline_stages_insert_policy" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_user_has_pipeline_perm('create'));

CREATE POLICY "pipeline_stages_update_policy" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING (public.fn_user_has_pipeline_perm('update'))
  WITH CHECK (public.fn_user_has_pipeline_perm('update'));

CREATE POLICY "pipeline_stages_delete_policy" ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING (public.fn_user_has_pipeline_perm('delete'));

-- SELECT remains open: every user needs to read stages to render the board.
-- (The existing "Allow public read access on pipeline_stages" policy stays.)

-- ── Backfill: grant the `pipeline` module to admin-tier roles ───────────────
-- Before this migration nobody had explicit pipeline grants, so locking down
-- RLS would block everyone (except super_admin). Seed sensible defaults so
-- Admin/Executive roles keep managing stages, while everyone else starts with
-- read-only (none of create/update/delete).

-- Partial unique index for role-based upserts (matches settings-hub backfill).
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_company_role_module_uidx
  ON public.role_permissions(company_id, role_id, module_id)
  WHERE role_id IS NOT NULL;

-- Dynamic (role_id) rows.
INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id, r.id, NULL::text, 'pipeline',
  r.name IN ('Super Admin', 'Admin'),
  'company',
  r.name IN ('Super Admin', 'Admin'),
  r.name IN ('Super Admin', 'Admin')
FROM public.companies c
CROSS JOIN public.roles r
WHERE r.name IN ('Super Admin', 'Admin', 'Executive')
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL DO NOTHING;

-- Legacy user_type rows.
INSERT INTO public.role_permissions (
  company_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id, v.user_type, 'pipeline',
  v.can_create, v.can_read, v.can_update, v.can_delete
FROM public.companies c
CROSS JOIN LATERAL (
  VALUES
    ('super_admin', true,  'company', true,  true),
    ('admin',       true,  'company', true,  true),
    ('executive',   false, 'company', true,  false),
    ('leader',      false, 'company', false, false),
    ('staff',       false, 'company', false, false)
) AS v(user_type, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO NOTHING;

COMMIT;
