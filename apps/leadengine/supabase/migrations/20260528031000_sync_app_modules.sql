-- ============================================================
-- Sync app_modules with current product surface (2026-05-28)
--
-- 1) Remove legacy modules that are no longer part of the product:
--      • lead_tasks  — Tasks page deprecated; no UI surface left.
--      • analytics   — never wired to permission gates in code.
--      • pipeline    — there is no `can('pipeline', ...)` callsite; pipeline
--                      stage admin uses `master_options` permission instead.
--      • goal_nodes  — internal mechanism, never gated by UI; remove to
--                      keep the matrix UI focused on user-visible modules.
--
-- 2) Add modules that the product actually checks in code but were never
--    seeded, so the matrix UI was missing rows for them:
--      • members     — used by sidebar `showAdminNav` and `settings/users`
--      • settings    — used by `history/page.tsx` (admin-only filter)
--      • permissions — owns the Roles & Permissions page itself
--
-- 3) Re-order sort_order so the matrix reads top-down by user impact.
-- ============================================================

BEGIN;

-- 1. Remove legacy / unused modules + their permission rows.
DELETE FROM public.role_permissions
  WHERE module_id IN ('lead_tasks', 'analytics', 'pipeline', 'goal_nodes');

DELETE FROM public.app_modules
  WHERE id IN ('lead_tasks', 'analytics', 'pipeline', 'goal_nodes');

-- 2. Upsert current module catalog.
INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('leads',                'Leads',                'Lead pipeline and management',                  1),
  ('companies',            'Companies',            'Client company management',                     2),
  ('contacts',             'Contacts',             'Client contacts',                               3),
  ('members',              'Members',              'Workspace member assignments and team',         4),
  ('users',                'Users',                'User profile and provisioning',                 5),
  ('master_options',       'Master Options',       'Lead fields, dropdown options, form layouts',   6),
  ('segment_settings',     'Segment Settings',     'Segment definitions and mappings',              7),
  ('management_dashboard', 'Management Dashboard', 'Goal attainment and forecast dashboard',        8),
  ('goal_settings',        'Goal Settings',        'Goal periods, attribution, and reporting',      9),
  ('forecast_settings',    'Forecast Settings',    'Stage weights and forecast configuration',     10),
  ('settings',             'Settings',             'Workspace-level settings access',              11),
  ('permissions',          'Permissions',          'Roles and access control matrix administration', 12)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order;

COMMIT;
