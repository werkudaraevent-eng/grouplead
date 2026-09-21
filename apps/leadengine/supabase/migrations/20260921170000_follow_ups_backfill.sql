-- ============================================================
-- Open a follow-up for every report sent before follow-ups existed.
--
-- The module opens a follow-up when a report is sent or edited; reports
-- sent before it shipped kept their next action as plain fields and had no
-- row, so Hari ini and the report card showed nothing for them. One row per
-- such report: the report's own next action, owner and day, credited to
-- whoever sent it. Reports whose next action is of kind "none", withdrawn
-- reports, deleted or cancelled visits, and reports that already have a
-- follow-up are left alone.
-- ============================================================

INSERT INTO sales_mission.follow_ups (company_id, mission_id, report_id, action_type, owner_id, due_date, status, created_by, created_at)
SELECT
  vr.company_id,
  vr.mission_id,
  vr.id,
  vr.next_action_type,
  vr.next_action_owner,
  vr.follow_up_date,
  'OPEN',
  COALESCE(vr.submitted_by, vr.created_by),
  COALESCE(vr.submitted_at, vr.updated_at, timezone('utc', now()))
FROM sales_mission.visit_reports vr
JOIN sales_mission.missions m ON m.id = vr.mission_id
WHERE vr.status = 'SUBMITTED'
  AND m.deleted_at IS NULL
  AND m.status NOT IN ('CANCELLED', 'REJECTED')
  AND vr.next_action_type IS NOT NULL
  AND vr.next_action_type <> 'NONE'
  AND NOT EXISTS (
    SELECT 1 FROM sales_mission.report_choices rc
    WHERE rc.company_id = vr.company_id AND rc.field_key = 'next_action_type' AND rc.code = vr.next_action_type AND rc.kind = 'none'
  )
  AND NOT EXISTS (SELECT 1 FROM sales_mission.follow_ups f WHERE f.report_id = vr.id);
