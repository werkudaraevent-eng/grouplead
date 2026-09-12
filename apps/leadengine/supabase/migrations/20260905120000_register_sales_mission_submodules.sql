-- Register the Sales Mission sub-modules.
--
-- The permission matrix has been rendering four Sales Mission switches since
-- the app shipped, but `role_permissions.module_id` has a foreign key to
-- `app_modules.id` and these four ids were never inserted. Every attempt to
-- save one failed on that constraint, which is why the table holds zero rows
-- for them: an admin could see the controls and never make them stick.
--
-- Consequence until now: `canPerform()` treats an unconfigured module as
-- unrestricted, so the role separation the PRD describes — an appointment team
-- that schedules but does not submit reports, settings limited to admins — has
-- never actually been enforceable.
--
-- Ids, names and descriptions match MODULE_DISPLAY in
-- app/(app)/settings/permissions/page.tsx. They have to agree: that file
-- decides what an admin sees, this table decides what can be saved.
--
-- Sort order continues after `sales_mission` (14) so the group stays together
-- in the matrix.

insert into public.app_modules (id, name, description, sort_order)
values
  ('sales_mission_mission', 'Missions',
   'Create and edit missions inside Sales Mission.', 15),
  ('sales_mission_result', 'Visit reports',
   'Visit report access inside Sales Mission.', 16),
  ('sales_mission_contact', 'Mission contacts',
   'Contacts captured during a visit.', 17),
  ('sales_mission_settings', 'Mission settings',
   'Travel buffer, conflict rules, and the supporting-sales cap.', 18)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;
