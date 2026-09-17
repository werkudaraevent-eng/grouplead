-- ============================================================
-- Postponed, date to follow.
--
-- A visit called off this morning that the client wants on another day
-- is not the same as a visit that will not happen. Until now both were
-- CANCELLED with a reason in the history, and the reschedule lived in
-- someone's memory. The mission keeps its CANCELLED status (nothing on a
-- calendar should show for it) and gains two facts: by when the rep
-- promised to call the client back for a new date, and which mission
-- replaced it once one was made. Hari ini lists the first until the
-- second is set.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.missions
  ADD COLUMN IF NOT EXISTS reschedule_due date,
  ADD COLUMN IF NOT EXISTS rescheduled_to_id uuid REFERENCES sales_mission.missions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS missions_reschedule_due_idx
  ON sales_mission.missions (company_id, reschedule_due)
  WHERE reschedule_due IS NOT NULL AND rescheduled_to_id IS NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
