-- ============================================================
-- Make the permission matrix mean what it draws.
--
-- Three problems, all of which let the Roles & Permissions screen show one
-- thing while the apps did another:
--
--   1. A missing row meant "denied" in LeadEngine (require-permission.ts
--      returns false when no row is found) and "unrestricted" in Sales Mission
--      (canPerform returns true, deliberately, so a tenant that never opened
--      the matrix does not find the app broken). The matrix drew both as the
--      same off switch. Explicit rows for every pair remove the ambiguity.
--
--   2. `can_read = 'none'` alongside a true write flag was reachable: the
--      module vanished from the sidebar while require-permission still granted
--      the write to anyone calling the server action directly. The UI has
--      always treated that as impossible; the database never did.
--
--   3. Two modules were rows on the screen that nothing reads.
--
-- Effective access is preserved exactly. Read the comment on each step.
-- ============================================================

BEGIN;

-- ── Step 1: drop the two dead modules ───────────────────────
--
-- `users` has no consumer: `members` is the module that actually governs
-- Settings > Users, and both rendered with the label "Users", so the matrix
-- showed two identically named rows and the admin had to guess. `forecast_settings`
-- appears in exactly one place in the codebase, the group list on the permissions
-- page itself, and gates nothing.
--
-- Same approach 20260528031000 already used for lead_tasks / analytics / goal_nodes.
-- role_permissions.module_id is ON DELETE CASCADE, so their rows go with them.
DELETE FROM public.app_modules WHERE id IN ('users', 'forecast_settings');

-- ── Step 2: make role-scoped rows uniquely addressable ──────
-- Already created by earlier migrations; repeated because this file's upserts
-- depend on it and migrations must not assume ordering beyond their filename.
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_company_role_module_uidx
  ON public.role_permissions(company_id, role_id, module_id)
  WHERE role_id IS NOT NULL;

-- ── Step 3: repair rows that grant a write without the read ─
--
-- Writes are cleared rather than read being granted. Today such a row hides the
-- module from the sidebar, so the person cannot reach the feature; granting read
-- would hand them a module they never had. Clearing the writes keeps what they
-- can actually do identical and makes the row honest.
UPDATE public.role_permissions
SET can_create = false,
    can_update = false,
    can_delete = false
WHERE can_read = 'none'
  AND (can_create OR can_update OR can_delete);

-- ── Step 4: an explicit row for every (company, role, module) ─
--
-- The values are chosen to leave everyone's access exactly where it is today,
-- because the code change that ships with this migration stops both resolvers
-- from falling back to the legacy user_type rows. Whatever the fallback would
-- have produced is written down here instead, in the row the matrix draws.
--
-- Three sources, in order:
--
--   a) The legacy user_type row whose name matches this role ('Super Admin' to
--      'super_admin', and so on). That is what a person holding this role
--      resolved to a moment ago.
--
--   b) For a Sales Mission sub-module, the parent `sales_mission` row instead.
--      That is what the app does today: canPerform returns true when the row is
--      absent, so anyone past the app gate already holds the sub-module, and
--      all-off would revoke it.
--
--   c) Otherwise all-off. Custom roles such as "Appointment" have no matching
--      user_type row, and a new role starting empty is the point.
--
-- Two statements, not one, and the order matters. The sub-modules read the
-- parent row, and 4a may be the statement that creates it: a single INSERT sees
-- the table as it was before it ran, so the parent would land on while its four
-- children landed off.

-- 4a. Everything except the Sales Mission sub-modules.
INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id,
  r.id,
  NULL::text,
  m.id,
  COALESCE(legacy.can_create, false),
  COALESCE(legacy.can_read,   'none'),
  COALESCE(legacy.can_update, false),
  COALESCE(legacy.can_delete, false)
FROM public.companies c
CROSS JOIN public.roles r
CROSS JOIN public.app_modules m
LEFT JOIN public.role_permissions legacy
  ON legacy.company_id = c.id
  AND legacy.role_id IS NULL
  AND legacy.module_id = m.id
  AND legacy.user_type = lower(replace(r.name, ' ', '_'))
WHERE m.id NOT LIKE 'sales\_mission\_%'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions existing
    WHERE existing.company_id = c.id
      AND existing.role_id = r.id
      AND existing.module_id = m.id
  )
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL
DO NOTHING;

-- 4b. The four sub-modules, mirroring the parent row 4a has now guaranteed.
INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id,
  r.id,
  NULL::text,
  m.id,
  COALESCE(parent.can_create, false),
  COALESCE(parent.can_read,   'none'),
  COALESCE(parent.can_update, false),
  COALESCE(parent.can_delete, false)
FROM public.companies c
CROSS JOIN public.roles r
CROSS JOIN public.app_modules m
LEFT JOIN public.role_permissions parent
  ON parent.company_id = c.id
  AND parent.role_id = r.id
  AND parent.module_id = 'sales_mission'
WHERE m.id LIKE 'sales\_mission\_%'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions existing
    WHERE existing.company_id = c.id
      AND existing.role_id = r.id
      AND existing.module_id = m.id
  )
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL
DO NOTHING;

-- Step 4a can carry a write-without-read pair over from a legacy row, so the
-- repair in step 3 runs once more before the constraint goes on.
UPDATE public.role_permissions
SET can_create = false,
    can_update = false,
    can_delete = false
WHERE can_read = 'none'
  AND (can_create OR can_update OR can_delete);

-- ── Step 5: hold the invariant where the data lives ─────────
--
-- The screen enforces this by granting Lihat alongside any write it is asked
-- for. A constraint means a direct SQL edit, a future code path, or a legacy
-- import cannot reintroduce the state the screen has no way to display.
ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_write_requires_read;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_write_requires_read
  CHECK (
    can_read <> 'none'
    OR NOT (can_create OR can_update OR can_delete)
  );

COMMIT;
