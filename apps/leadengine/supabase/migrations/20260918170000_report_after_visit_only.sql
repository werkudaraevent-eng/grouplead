-- ============================================================
-- No report before the visit.
--
-- A report written on the 17th about a visit scheduled for the 21st
-- would mark the mission Selesai and count in the KPI. With this on
-- (the default) the report form opens at the start of the scheduled
-- day in mission time, and the visit's actual time may not be in the
-- future. Off restores the old behaviour for a tenant that fills
-- reports ahead for some reason of its own.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS report_after_visit_only boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_mission.mission_settings.report_after_visit_only IS
  'When true, a visit report opens at the start of the scheduled day and its actual time may not be in the future.';

NOTIFY pgrst, 'reload schema';

COMMIT;
