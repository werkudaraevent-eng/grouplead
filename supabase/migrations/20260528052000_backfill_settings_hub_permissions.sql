-- ============================================================
-- Backfill Settings hub permissions after introducing settings.read.
--
-- Without this, existing admin/executive roles may lose the Settings sidebar
-- because it now correctly checks `settings.read` instead of piggybacking on
-- `members.read`.
-- ============================================================

BEGIN;

-- Dynamic roles use role_id. Older schema only had a unique key on
-- (company_id, user_type, module_id), so add a partial unique index for
-- role-based permission rows to make idempotent upserts safe.
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_company_role_module_uidx
  ON public.role_permissions(company_id, role_id, module_id)
  WHERE role_id IS NOT NULL;

-- Role-id based rows for dynamic roles.
INSERT INTO public.role_permissions (
  company_id,
  role_id,
  user_type,
  module_id,
  can_create,
  can_read,
  can_update,
  can_delete
)
SELECT
  c.id AS company_id,
  r.id AS role_id,
  NULL::text AS user_type,
  v.module_id,
  v.can_create,
  v.can_read,
  v.can_update,
  v.can_delete
FROM public.companies c
CROSS JOIN public.roles r
CROSS JOIN LATERAL (
  VALUES
    -- Settings hub itself.
    ('settings', false, CASE WHEN r.name IN ('Super Admin', 'Admin', 'Executive') THEN 'all' ELSE 'none' END, r.name IN ('Super Admin', 'Admin'), false),
    -- Roles & permissions section.
    ('permissions', r.name IN ('Super Admin', 'Admin'), CASE WHEN r.name IN ('Super Admin', 'Admin') THEN 'all' ELSE 'none' END, r.name IN ('Super Admin', 'Admin'), r.name IN ('Super Admin', 'Admin')),
    -- Users / members section.
    ('members', r.name IN ('Super Admin', 'Admin'), CASE WHEN r.name IN ('Super Admin', 'Admin', 'Executive') THEN 'all' ELSE 'none' END, r.name IN ('Super Admin', 'Admin'), r.name IN ('Super Admin', 'Admin'))
) AS v(module_id, can_create, can_read, can_update, can_delete)
WHERE r.name IN ('Super Admin', 'Admin', 'Executive')
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read   = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- Legacy user_type rows for installs/users still relying on text roles.
INSERT INTO public.role_permissions (
  company_id,
  user_type,
  module_id,
  can_create,
  can_read,
  can_update,
  can_delete
)
SELECT
  c.id AS company_id,
  v.user_type,
  v.module_id,
  v.can_create,
  v.can_read,
  v.can_update,
  v.can_delete
FROM public.companies c
CROSS JOIN LATERAL (
  VALUES
    ('super_admin', 'settings', false, 'all', true, false),
    ('admin',       'settings', false, 'all', true, false),
    ('executive',   'settings', false, 'all', false, false),
    ('super_admin', 'permissions', true, 'all', true, true),
    ('admin',       'permissions', true, 'all', true, true),
    ('super_admin', 'members', true, 'all', true, true),
    ('admin',       'members', true, 'all', true, true),
    ('executive',   'members', false, 'all', false, false)
) AS v(user_type, module_id, can_create, can_read, can_update, can_delete)
ON CONFLICT (company_id, user_type, module_id) DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read   = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

COMMIT;
