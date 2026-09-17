-- ============================================================
-- "Tarik kembali laporan": a sent report goes back to draft and its
-- mission back to the status it had before Selesai. The team hears
-- about it the same way it heard about the send.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_check;

ALTER TABLE sales_mission.notifications
  ADD CONSTRAINT notifications_event_check CHECK (event_type IN (
    'MISSION_ASSIGNED',
    'MISSION_JOINED',
    'MISSION_LEFT',
    'MISSION_CANCELLED',
    'ASSIGNMENT_ACCEPTED',
    'ASSIGNMENT_REJECTED',
    'RESCHEDULE_REQUESTED',
    'RESCHEDULE_APPROVED',
    'RESCHEDULE_REJECTED',
    'MISSION_RESCHEDULED',
    'RESULT_SUBMITTED',
    'RESULT_WITHDRAWN',
    'NEEDS_CLARIFICATION',
    'LEAD_PUSHED'
  ));

COMMIT;
