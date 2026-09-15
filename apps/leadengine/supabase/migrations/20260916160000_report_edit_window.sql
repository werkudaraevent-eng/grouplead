-- ============================================================
-- How long after sending a visit report its author may still change it
-- without an admin. 0 means never: only an admin opens a sent report.
-- Every change, by anyone, keeps the outgoing version in
-- visit_report_versions with a reason, so editing is allowed but never
-- silent.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS report_edit_window_days integer NOT NULL DEFAULT 7;

ALTER TABLE sales_mission.mission_settings DROP CONSTRAINT IF EXISTS mission_settings_report_edit_window_check;
ALTER TABLE sales_mission.mission_settings ADD CONSTRAINT mission_settings_report_edit_window_check
  CHECK (report_edit_window_days >= 0 AND report_edit_window_days <= 365);

COMMENT ON COLUMN sales_mission.mission_settings.report_edit_window_days IS
  'Days after submission during which the primary sales may edit their own sent report. 0 = admin only.';

NOTIFY pgrst, 'reload schema';

COMMIT;
