-- ============================================================
-- When the visit actually happened, on the report. The mission keeps the
-- appointment; the report keeps the fact. The two side by side give the
-- on-time rate and the average length of a visit.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.visit_reports
  ADD COLUMN IF NOT EXISTS actual_start timestamptz,
  ADD COLUMN IF NOT EXISTS actual_end timestamptz;

ALTER TABLE sales_mission.visit_reports DROP CONSTRAINT IF EXISTS visit_reports_actual_window_check;
ALTER TABLE sales_mission.visit_reports ADD CONSTRAINT visit_reports_actual_window_check
  CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end > actual_start);

COMMENT ON COLUMN sales_mission.visit_reports.actual_start IS 'When the visit really began, as reported. Null when not filled in.';
COMMENT ON COLUMN sales_mission.visit_reports.actual_end IS 'When the visit really ended, as reported.';

NOTIFY pgrst, 'reload schema';

COMMIT;
