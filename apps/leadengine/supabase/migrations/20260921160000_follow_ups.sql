-- ============================================================
-- Follow-ups: the report's next action as a task that lives.
--
-- A report has always carried a next action (type, owner, follow-up date),
-- and the KPI counted it as "open", but nothing ever closed it and nowhere
-- said what happened. This table is that task: created from the report,
-- owned by someone, due on a day, closed with how it went (channel,
-- outcome, note) and, optionally, the next step as a new row chained to it.
-- The pattern is the CRM's activity log (Salesforce, HubSpot, Pipedrive):
-- tasks on the record, a timeline, "log and schedule next", never a page
-- of its own.
--
-- Also: two more admin-editable choice sets (how the follow-up was done,
-- how it went), on report_choices like the other three, with locked kinds
-- the code reads; a switch to turn the module off; a notification event
-- for a follow-up handed to someone else.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  report_id uuid REFERENCES sales_mission.visit_reports(id) ON DELETE SET NULL,
  -- The follow-up this one continues; null for the one the report opened.
  parent_id uuid REFERENCES sales_mission.follow_ups(id) ON DELETE SET NULL,
  -- A next_action_type code from report_choices.
  action_type text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  -- How it was done and how it went, written when closed (follow_up_channel / follow_up_outcome codes).
  channel text,
  outcome text,
  note text,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS follow_ups_owner_open_idx ON sales_mission.follow_ups (company_id, owner_id, due_date) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS follow_ups_mission_idx ON sales_mission.follow_ups (mission_id, created_at);
CREATE INDEX IF NOT EXISTS follow_ups_report_idx ON sales_mission.follow_ups (report_id) WHERE report_id IS NOT NULL;

ALTER TABLE sales_mission.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY follow_ups_select ON sales_mission.follow_ups FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY follow_ups_insert ON sales_mission.follow_ups FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY follow_ups_update ON sales_mission.follow_ups FOR UPDATE USING (sales_mission.user_has_company_access(company_id)) WITH CHECK (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE ON sales_mission.follow_ups TO authenticated;
GRANT SELECT ON sales_mission.follow_ups TO service_role;

-- Audit: the generic mission_id branch labels the row by its mission.
DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS audit_row ON sales_mission.follow_ups';
  EXECUTE 'CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.follow_ups FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row()';
END $$;

-- Two more choice sets, same table, same editor, same locked kinds.
ALTER TABLE sales_mission.report_choices DROP CONSTRAINT IF EXISTS report_choices_field_key_check;
ALTER TABLE sales_mission.report_choices
  ADD CONSTRAINT report_choices_field_key_check CHECK (
    field_key IN ('visit_outcome', 'interest_level', 'next_action_type', 'follow_up_channel', 'follow_up_outcome')
  );

ALTER TABLE sales_mission.report_choices DROP CONSTRAINT IF EXISTS report_choices_kind_check;
ALTER TABLE sales_mission.report_choices
  ADD CONSTRAINT report_choices_kind_check CHECK (
    (field_key = 'visit_outcome' AND kind IN ('met_decision_maker', 'met_staff', 'rescheduled', 'absent', 'cancelled')) OR
    (field_key = 'interest_level' AND kind IN ('hql', 'hot', 'warm', 'cold', 'none')) OR
    (field_key = 'next_action_type' AND kind IN ('action', 'none')) OR
    (field_key = 'follow_up_channel' AND kind IN ('in_person', 'call', 'message', 'email', 'other')) OR
    (field_key = 'follow_up_outcome' AND kind IN ('advanced', 'no_change', 'not_reached', 'dropped'))
  );

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS follow_up_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_mission.mission_settings.follow_up_enabled IS
  'Track the report''s next action as a follow-up task (Hari ini, the report card, the report list). Off keeps the next action as plain fields on the report.';

ALTER TABLE sales_mission.notifications DROP CONSTRAINT IF EXISTS notifications_event_check;
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
    'LEAD_PUSHED',
    'FOLLOW_UP_ASSIGNED'
  ));

COMMIT;

NOTIFY pgrst, 'reload schema';
