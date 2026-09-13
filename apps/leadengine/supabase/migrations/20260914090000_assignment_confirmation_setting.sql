-- ============================================================
-- Whether a sales has to press "Terima" on an assignment.
--
-- Until now every assignment started PENDING and the mission sat at
-- "Ditugaskan" until the primary confirmed. In practice the person assigning
-- is a manager or the appointment team, the rep rarely declines, and the
-- button became a ritual: the information a rep actually carries is "I can't"
-- or "not at that time", which Tolak and Minta jadwal ulang already capture.
--
-- Off (the default): an assignment is accepted the moment it is made, and the
-- mission goes straight to "Diterima". Tolak and Minta jadwal ulang stay.
-- On: the previous behaviour, with the answer surfaced where the rep already
-- is instead of at the bottom of the detail page.
-- ============================================================

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS require_assignment_confirmation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_mission.mission_settings.require_assignment_confirmation IS
  'When true, a new assignment starts PENDING and the rep must accept it. When false, assignments are accepted on creation; declining and rescheduling remain available.';
