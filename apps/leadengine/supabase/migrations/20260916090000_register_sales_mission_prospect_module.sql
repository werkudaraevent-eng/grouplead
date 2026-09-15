-- Register the Sales Mission "Prospek" module.
--
-- `role_permissions.module_id` has a foreign key to `app_modules.id`, so the
-- permission matrix cannot save a switch for a module that is not registered
-- here (see 20260905120000_register_sales_mission_submodules.sql for the
-- history of exactly that bug).
--
-- Then the backfill from 20260906120000_permissions_matrix_integrity.sql,
-- narrowed to this one module: every role already configured for the
-- Sales Mission parent gets a mirrored row, because `canPerform()` treats a
-- module with no row as unrestricted (except delete), and a new module must
-- not open itself to roles an admin has already fenced.

insert into public.app_modules (id, name, description, sort_order)
values
  ('sales_mission_prospect', 'Prospects',
   'Prospect list and contact attempts before a mission exists.', 19)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete
)
SELECT
  c.id,
  r.id,
  NULL::text,
  'sales_mission_prospect',
  COALESCE(parent.can_create, false),
  COALESCE(parent.can_read,   'none'),
  COALESCE(parent.can_update, false),
  COALESCE(parent.can_delete, false)
FROM public.companies c
CROSS JOIN public.roles r
JOIN public.role_permissions parent
  ON parent.company_id = c.id
  AND parent.role_id = r.id
  AND parent.module_id = 'sales_mission'
WHERE NOT EXISTS (
    SELECT 1 FROM public.role_permissions existing
    WHERE existing.company_id = c.id
      AND existing.role_id = r.id
      AND existing.module_id = 'sales_mission_prospect'
  )
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL
DO NOTHING;
