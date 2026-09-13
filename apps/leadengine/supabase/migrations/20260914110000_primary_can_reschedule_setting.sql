-- ============================================================
-- Whether the primary sales may move their own visit.
--
-- The reschedule flow was built for one case: a supporting sales who cannot
-- make it proposes a time, and the primary decides. It was then applied to
-- the primary as well, which produced a rep filing a request with themselves
-- and then approving it from the same page. The person who owns the visit
-- and takes the client's call is the person who knows when it moved.
--
-- On (the default): the primary and admins move the schedule directly; the
-- team is told. Supporting sales still propose.
-- Off: everyone proposes and an admin decides, for units that keep every
-- schedule with the appointment team.
-- ============================================================

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS primary_can_reschedule boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_mission.mission_settings.primary_can_reschedule IS
  'When true the primary sales moves the visit directly and the team is notified. When false the primary proposes like everyone else and an admin decides.';

-- The team hears that the visit moved, whoever moved it.
ALTER TABLE sales_mission.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_check;

ALTER TABLE sales_mission.notifications
  ADD CONSTRAINT notifications_event_check CHECK (event_type IN (
    'MISSION_ASSIGNED',
    'MISSION_JOINED',
    'MISSION_LEFT',
    'ASSIGNMENT_ACCEPTED',
    'ASSIGNMENT_REJECTED',
    'RESCHEDULE_REQUESTED',
    'RESCHEDULE_APPROVED',
    'RESCHEDULE_REJECTED',
    'MISSION_RESCHEDULED',
    'RESULT_SUBMITTED',
    'NEEDS_CLARIFICATION',
    'LEAD_PUSHED'
  ));
