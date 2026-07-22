-- New identities must not become sales by logging in.
-- Sales eligibility is provisioned separately by an administrator.

BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'staff';

INSERT INTO public.app_modules (id, name, description, sort_order)
VALUES (
  'sales_mission',
  'Sales Mission',
  'Sales mission scheduling, assignments, and visit results',
  14
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Dynamic role permissions. Staff can authenticate and use existing
-- LeadEngine read access, but Sales Mission access is opt-in.
INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id,
  r.id,
  NULL::text,
  'sales_mission',
  CASE WHEN r.name IN ('Super Admin', 'Admin') THEN true ELSE false END,
  CASE
    WHEN r.name = 'Super Admin' THEN 'all'
    WHEN r.name = 'Admin' THEN 'all'
    WHEN r.name IN ('Executive', 'Leader', 'Sales') THEN 'company'
    ELSE 'none'
  END,
  CASE WHEN r.name IN ('Super Admin', 'Admin') THEN true ELSE false END,
  CASE WHEN r.name = 'Super Admin' THEN true ELSE false END
FROM public.companies c
CROSS JOIN public.roles r
WHERE r.name IN ('Super Admin', 'Admin', 'Executive', 'Leader', 'Sales', 'Staff')
ON CONFLICT DO NOTHING;

-- Legacy user_type permissions for installations that still resolve roles
-- through company_members.user_type.
INSERT INTO public.role_permissions (
  company_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id,
  v.user_type,
  'sales_mission',
  v.can_create,
  v.can_read,
  v.can_update,
  v.can_delete
FROM public.companies c
CROSS JOIN (VALUES
  ('super_admin', true,  'all',     true,  true),
  ('admin',       true,  'all',     true,  true),
  ('executive',   false, 'company', false, false),
  ('leader',      false, 'company', false, false),
  ('staff',       false, 'none',    false, false)
) AS v(user_type, can_create, can_read, can_update, can_delete)
ON CONFLICT DO NOTHING;

COMMIT;
