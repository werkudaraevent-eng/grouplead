-- ============================================================
-- Give "Jenis mission" the choices it always claimed to have.
--
-- The field was seeded as a SELECT with an empty options array, while the
-- mission form rendered a hardcoded list (MISSION_TYPES) and the server
-- validated against that same hardcoded enum. So the settings screen showed a
-- single-choice field with no choices, no way to add one, and no hint that the
-- real list lived in code where no admin could reach it.
--
-- The form now reads these options. Seeding them with exactly the four values
-- the code used means the mission form offers the same choices the day this
-- lands, and becomes editable from the day after.
-- ============================================================

BEGIN;

UPDATE sales_mission.form_fields
SET options = '["Meeting", "Visit", "Survey", "Follow Up"]'::jsonb,
    updated_at = timezone('utc', now())
WHERE form_key = 'mission'
  AND reporting_key = 'mission_type'
  -- Only where nobody has set a list. A tenant that somehow already has one
  -- keeps it: this backfills a gap, it does not impose a default.
  AND (options IS NULL OR jsonb_array_length(options) = 0);

COMMIT;
