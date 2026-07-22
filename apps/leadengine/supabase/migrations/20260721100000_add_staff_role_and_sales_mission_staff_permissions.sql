-- Add Staff to dynamic role catalog.
-- New Microsoft identities default to profiles.role = staff and must have
-- a real role row for the Roles & Permissions screen to manage them.

BEGIN;

INSERT INTO public.roles (name, description, sort_order, is_system)
VALUES (
  'Staff',
  'Standard operational access',
  5,
  true
)
ON CONFLICT (name) DO NOTHING;

UPDATE public.roles AS staff
SET parent_id = leader.id
FROM public.roles AS leader
WHERE staff.name = 'Staff'
  AND leader.name = 'Leader'
  AND staff.parent_id IS NULL;

-- Seed Sales Mission permission row for Staff after the role exists.
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
  staff.id,
  NULL::text,
  'sales_mission',
  false,
  'none',
  false,
  false
FROM public.companies AS c
CROSS JOIN public.roles AS staff
WHERE staff.name = 'Staff'
ON CONFLICT DO NOTHING;

COMMIT;
