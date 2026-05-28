-- ============================================================
-- Add real main Dashboard permission module.
--
-- `management_dashboard` is a goal-management component, not the main app
-- dashboard. Admins expect the "Dashboard" row to control the real dashboard
-- entry in the sidebar, so add a dedicated `dashboard` module and backfill
-- read access for existing roles that should keep their current access.
-- ============================================================

BEGIN;

INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Main executive and sales performance dashboard', 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Shift CRM modules down while keeping stable order.
UPDATE public.app_modules SET sort_order = 2 WHERE id = 'leads';
UPDATE public.app_modules SET sort_order = 3 WHERE id = 'companies';
UPDATE public.app_modules SET sort_order = 4 WHERE id = 'contacts';
UPDATE public.app_modules SET sort_order = 5 WHERE id = 'members';
UPDATE public.app_modules SET sort_order = 6 WHERE id = 'users';
UPDATE public.app_modules SET sort_order = 7 WHERE id = 'master_options';
UPDATE public.app_modules SET sort_order = 8 WHERE id = 'segment_settings';
UPDATE public.app_modules SET sort_order = 9 WHERE id = 'management_dashboard';
UPDATE public.app_modules SET sort_order = 10 WHERE id = 'goal_settings';
UPDATE public.app_modules SET sort_order = 11 WHERE id = 'forecast_settings';
UPDATE public.app_modules SET sort_order = 12 WHERE id = 'settings';
UPDATE public.app_modules SET sort_order = 13 WHERE id = 'permissions';

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_company_role_module_uidx
  ON public.role_permissions(company_id, role_id, module_id)
  WHERE role_id IS NOT NULL;

-- Dynamic role rows: preserve existing dashboard visibility for standard roles.
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
  c.id,
  r.id,
  NULL::text,
  'dashboard',
  false,
  CASE WHEN r.name IN ('Super Admin', 'Admin', 'Executive', 'Leader', 'Sales') THEN 'company' ELSE 'none' END,
  false,
  false
FROM public.companies c
CROSS JOIN public.roles r
WHERE r.name IN ('Super Admin', 'Admin', 'Executive', 'Leader', 'Sales')
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL DO UPDATE SET
  can_read = EXCLUDED.can_read;

-- Legacy user_type rows.
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
  c.id,
  v.user_type,
  'dashboard',
  false,
  v.can_read,
  false,
  false
FROM public.companies c
CROSS JOIN LATERAL (
  VALUES
    ('super_admin', 'all'),
    ('admin', 'all'),
    ('executive', 'company'),
    ('leader', 'company'),
    ('staff', 'company')
) AS v(user_type, can_read)
ON CONFLICT (company_id, user_type, module_id) DO UPDATE SET
  can_read = EXCLUDED.can_read;

COMMIT;
