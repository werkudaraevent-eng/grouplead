-- ============================================================
-- Two small things the schedule picker and the cancel button need.
--
-- 1. Field order. The picker draws the calendars of whoever is being sent, so
--    "who goes" has to be answered before "when". The seed put the team after
--    the date, which made the form read: fill in the bottom, then look at the
--    top. Only rows still holding their seed order are moved; a tenant that
--    reordered the form by hand keeps their order.
--
-- 2. A notification event for a cancelled mission. Cancelling before the
--    visit had no path at all; a rep whose client called it off had to write
--    a visit report about a visit that never happened.
-- ============================================================

BEGIN;

UPDATE sales_mission.form_fields SET display_order = 40 WHERE form_key = 'mission' AND reporting_key = 'objective'        AND display_order = 70;
UPDATE sales_mission.form_fields SET display_order = 50 WHERE form_key = 'mission' AND reporting_key = 'primary_sales'    AND display_order = 80;
UPDATE sales_mission.form_fields SET display_order = 60 WHERE form_key = 'mission' AND reporting_key = 'supporting_sales' AND display_order = 90;
UPDATE sales_mission.form_fields SET display_order = 70 WHERE form_key = 'mission' AND reporting_key = 'date'             AND display_order = 40;
UPDATE sales_mission.form_fields SET display_order = 80 WHERE form_key = 'mission' AND reporting_key = 'start_time'       AND display_order = 50;
UPDATE sales_mission.form_fields SET display_order = 90 WHERE form_key = 'mission' AND reporting_key = 'end_time'         AND display_order = 60;

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
    'NEEDS_CLARIFICATION',
    'LEAD_PUSHED'
  ));

COMMIT;
