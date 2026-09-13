-- ============================================================
-- Let the tenant decide what "Sapaan" offers.
--
-- The salutation list lived in two places nobody could edit from the product:
-- a const in mission-schema.ts and this CHECK constraint. The settings screen
-- showed every other choice field with an options editor, and the one field a
-- Sales Mission admin asked to change was the one it could not reach.
--
-- "Sapaan" is now a core SELECT in sales_mission.form_fields, seeded with the
-- same five values (see CORE_MISSION_FIELDS), and createMission validates the
-- submitted value against that list the way it already validates the mission
-- type. The constraint has to go, or the first tenant to add "Dr" would have
-- every mission with a Dr rejected by the database after the form accepted it.
--
-- No data changes. Existing rows already satisfy the list they were saved
-- against. The field row itself is seeded lazily by listFormFields the first
-- time each tenant opens the form, the same path every other core field uses.
-- ============================================================

alter table sales_mission.missions
  drop constraint if exists sales_mission_missions_salutation_check;
