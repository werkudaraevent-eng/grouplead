-- Reschedule requests.
--
-- Sales cannot move an accepted schedule themselves — the client agreed to a
-- time and only the person coordinating the tenant's calendar should change it.
-- Instead they propose a new time with a reason, and an admin or the primary
-- decides.
--
-- A table rather than columns on `assignments`: a mission can be rescheduled
-- more than once, and each attempt with its decision is worth keeping.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  proposed_start timestamptz NOT NULL,
  proposed_end timestamptz,
  reason text NOT NULL,

  status text NOT NULL DEFAULT 'PENDING',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT reschedule_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT reschedule_requests_reason_not_blank CHECK (length(btrim(reason)) > 0),
  CONSTRAINT reschedule_requests_window_check CHECK (proposed_end IS NULL OR proposed_end > proposed_start),
  CONSTRAINT reschedule_requests_decision_complete CHECK (
    status = 'PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

-- One open request per mission. Two people proposing different times at once
-- would leave the admin deciding between requests rather than on a schedule.
CREATE UNIQUE INDEX IF NOT EXISTS reschedule_requests_one_open_idx
  ON sales_mission.reschedule_requests(mission_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS reschedule_requests_queue_idx
  ON sales_mission.reschedule_requests(company_id, status, created_at);

ALTER TABLE sales_mission.reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY reschedule_requests_select ON sales_mission.reschedule_requests
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY reschedule_requests_insert ON sales_mission.reschedule_requests
  FOR INSERT WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND requested_by = auth.uid()
  );
-- Deciding is an update. Who may decide is enforced in the server action, which
-- knows the mission role; RLS keeps it inside the tenant.
CREATE POLICY reschedule_requests_update ON sales_mission.reschedule_requests
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

COMMIT;
