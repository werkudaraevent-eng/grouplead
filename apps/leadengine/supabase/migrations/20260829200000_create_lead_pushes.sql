-- Record of missions pushed to LeadEngine as leads.
--
-- The unique constraint on mission_id is the real double-push guard. A disabled
-- button is a courtesy; on a slow field connection a rep will tap twice, and
-- only the database can be certain the second one loses.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.lead_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL UNIQUE REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  -- LeadEngine owns this id. Stored as text because the leads table uses a
  -- bigint identity, not a uuid, and this is a foreign system's key either way.
  lead_engine_lead_id text NOT NULL,
  pipeline_id uuid,
  pipeline_stage_id uuid,

  -- Who the lead landed on in the CRM, which is not always who pushed it.
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  pushed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  pushed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  -- Sent to LeadEngine so a retried request cannot create a second lead.
  idempotency_key text NOT NULL,

  CONSTRAINT lead_pushes_lead_id_not_blank CHECK (length(btrim(lead_engine_lead_id)) > 0)
);

CREATE INDEX IF NOT EXISTS lead_pushes_company_idx
  ON sales_mission.lead_pushes(company_id, pushed_at);

ALTER TABLE sales_mission.lead_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_pushes_select ON sales_mission.lead_pushes
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY lead_pushes_insert ON sales_mission.lead_pushes
  FOR INSERT WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND pushed_by = auth.uid()
  );

-- No UPDATE or DELETE policy: a push is a historical fact. If a lead is wrong,
-- it is fixed in LeadEngine, not by erasing the record that it was sent.

COMMIT;
