-- ============================================================
-- Settle answers nobody is being asked for.
--
-- 20260914090000 made "sales must confirm" a per-tenant setting, off by
-- default. Assignments written before that started PENDING and the two still
-- open would now sit at "Ditugaskan" with no button anywhere to move them:
-- the UI stops asking, but the row still says nobody answered.
--
-- For every tenant whose policy is off (no settings row, or the flag false),
-- a PENDING answer on a mission that can still be answered becomes ACCEPTED,
-- and the mission's status is re-derived the same way the app does it. Tenants
-- that switched confirmation on keep their pending rows; those are real
-- questions.
-- ============================================================

BEGIN;

WITH relaxed AS (
  SELECT c.id AS company_id
  FROM public.companies c
  LEFT JOIN sales_mission.mission_settings s ON s.company_id = c.id
  WHERE COALESCE(s.require_assignment_confirmation, false) = false
),
open_missions AS (
  SELECT m.id, m.company_id
  FROM sales_mission.missions m
  JOIN relaxed r ON r.company_id = m.company_id
  WHERE m.status NOT IN ('COMPLETED', 'CANCELLED', 'IN_PROGRESS')
)
UPDATE sales_mission.assignments a
SET response = 'ACCEPTED',
    responded_at = COALESCE(a.responded_at, timezone('utc', now()))
FROM open_missions om
WHERE a.mission_id = om.id
  AND a.response = 'PENDING';

-- Mirror deriveMissionStatus: a primary who has accepted, with no open
-- reschedule request on the mission, means the mission is accepted.
UPDATE sales_mission.missions m
SET status = 'ACCEPTED',
    updated_at = timezone('utc', now())
WHERE m.status = 'ASSIGNED'
  AND EXISTS (
    SELECT 1 FROM sales_mission.assignments a
    WHERE a.mission_id = m.id AND a.assignment_role = 'PRIMARY' AND a.response = 'ACCEPTED'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sales_mission.assignments a
    WHERE a.mission_id = m.id AND a.response = 'RESCHEDULE_REQUESTED'
  )
  AND EXISTS (
    SELECT 1 FROM public.companies c
    LEFT JOIN sales_mission.mission_settings s ON s.company_id = c.id
    WHERE c.id = m.company_id AND COALESCE(s.require_assignment_confirmation, false) = false
  );

COMMIT;
