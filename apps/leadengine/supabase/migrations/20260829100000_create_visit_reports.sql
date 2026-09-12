-- Structured visit reports.
--
-- The point of this table is that field visits become data you can count, not
-- prose you have to read. Anything a report needs to answer — how many visits
-- reached a decision maker, which needs keep coming up, how many next actions
-- are still open — gets a typed column with a controlled vocabulary. Only the
-- narrative summary is free text.
--
-- One report per mission. Corrections append a version rather than overwriting,
-- so the audit trail survives a resubmission.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.visit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL UNIQUE REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  status text NOT NULL DEFAULT 'DRAFT',

  -- What happened. Separates a productive visit from a wasted trip; without it
  -- no effectiveness ratio can be computed.
  visit_outcome text,
  meeting_summary text,

  -- Controlled vocabularies, stored as arrays so one visit can carry several.
  client_needs text[] NOT NULL DEFAULT '{}',
  product_interest text[] NOT NULL DEFAULT '{}',

  interest_level text,
  opportunity_exists boolean NOT NULL DEFAULT false,
  estimated_value numeric(18, 2),
  competitor_mentioned text,

  next_action_type text NOT NULL DEFAULT 'NONE',
  next_action_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  follow_up_date date,

  -- Set when an admin asks a specific question about a submitted report.
  clarification_note text,

  submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT visit_reports_status_check CHECK (status IN ('DRAFT', 'SUBMITTED', 'NEEDS_CLARIFICATION')),
  CONSTRAINT visit_reports_outcome_check CHECK (visit_outcome IS NULL OR visit_outcome IN (
    'MET_DECISION_MAKER', 'MET_STAFF', 'RESCHEDULED_ON_SITE', 'CLIENT_ABSENT', 'CANCELLED_ON_SITE'
  )),
  CONSTRAINT visit_reports_interest_check CHECK (interest_level IS NULL OR interest_level IN (
    'HOT', 'WARM', 'COLD', 'NO_INTEREST'
  )),
  CONSTRAINT visit_reports_next_action_check CHECK (next_action_type IN (
    'SEND_PROPOSAL', 'SITE_VISIT', 'FOLLOW_UP_CALL', 'WAITING_CLIENT', 'NONE'
  )),
  CONSTRAINT visit_reports_estimated_value_check CHECK (estimated_value IS NULL OR estimated_value >= 0),

  -- A draft may be incomplete; a submitted report may not. Enforced here as
  -- well as in zod, because the database is the last line that cannot be
  -- bypassed by a crafted request.
  CONSTRAINT visit_reports_submitted_complete CHECK (
    status = 'DRAFT' OR (
      visit_outcome IS NOT NULL
      AND meeting_summary IS NOT NULL AND length(btrim(meeting_summary)) > 0
      AND interest_level IS NOT NULL
      AND submitted_by IS NOT NULL
      AND submitted_at IS NOT NULL
    )
  ),

  -- A next action nobody owns and nobody dated is not a next action.
  CONSTRAINT visit_reports_next_action_complete CHECK (
    next_action_type = 'NONE'
    OR status = 'DRAFT'
    OR (next_action_owner IS NOT NULL AND follow_up_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS visit_reports_company_status_idx
  ON sales_mission.visit_reports(company_id, status);
CREATE INDEX IF NOT EXISTS visit_reports_follow_up_idx
  ON sales_mission.visit_reports(company_id, follow_up_date)
  WHERE next_action_type <> 'NONE';
CREATE INDEX IF NOT EXISTS visit_reports_opportunity_idx
  ON sales_mission.visit_reports(company_id, opportunity_exists)
  WHERE opportunity_exists = true;

-- Who was actually in the room. The main source of contact enrichment, and the
-- reason a visit can be linked back to real people later.
CREATE TABLE IF NOT EXISTS sales_mission.report_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES sales_mission.visit_reports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,

  full_name text NOT NULL,
  job_title text,
  phone text,
  email text,
  is_decision_maker boolean NOT NULL DEFAULT false,

  -- Set once the contact is matched to a LeadEngine master record. A name alone
  -- is never auto-matched (spec §8).
  lead_engine_contact_id uuid,
  link_status text NOT NULL DEFAULT 'SNAPSHOT',

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT report_contacts_name_not_blank CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT report_contacts_link_status_check CHECK (link_status IN (
    'SNAPSHOT', 'PENDING_REVIEW', 'LINKED'
  ))
);

CREATE INDEX IF NOT EXISTS report_contacts_report_idx
  ON sales_mission.report_contacts(report_id);

-- Supporting sales — including anyone who joined a mission themselves — write
-- here. Kept apart from the main report so the primary's account of the meeting
-- is never overwritten by someone else.
CREATE TABLE IF NOT EXISTS sales_mission.supporting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT supporting_notes_not_blank CHECK (length(btrim(note)) > 0)
);

CREATE INDEX IF NOT EXISTS supporting_notes_mission_idx
  ON sales_mission.supporting_notes(mission_id, created_at);

-- Append-only history. A resubmission after NEEDS_CLARIFICATION stores the
-- previous state here rather than erasing it.
CREATE TABLE IF NOT EXISTS sales_mission.visit_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES sales_mission.visit_reports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT visit_report_versions_unique UNIQUE (report_id, version)
);

CREATE INDEX IF NOT EXISTS visit_report_versions_report_idx
  ON sales_mission.visit_report_versions(report_id, version);

ALTER TABLE sales_mission.visit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.report_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.supporting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.visit_report_versions ENABLE ROW LEVEL SECURITY;

-- Tenant scoping reuses the helper the foundation migration installed.
CREATE POLICY visit_reports_select ON sales_mission.visit_reports
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY visit_reports_insert ON sales_mission.visit_reports
  FOR INSERT WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND created_by = auth.uid()
  );
CREATE POLICY visit_reports_update ON sales_mission.visit_reports
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY visit_reports_delete ON sales_mission.visit_reports
  FOR DELETE USING (sales_mission.user_has_company_access(company_id));

CREATE POLICY report_contacts_select ON sales_mission.report_contacts
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_contacts_insert ON sales_mission.report_contacts
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_contacts_update ON sales_mission.report_contacts
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_contacts_delete ON sales_mission.report_contacts
  FOR DELETE USING (sales_mission.user_has_company_access(company_id));

CREATE POLICY supporting_notes_select ON sales_mission.supporting_notes
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY supporting_notes_insert ON sales_mission.supporting_notes
  FOR INSERT WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND author_id = auth.uid()
  );
-- A note is one person's account of a meeting. Only its author may change it.
CREATE POLICY supporting_notes_update ON sales_mission.supporting_notes
  FOR UPDATE USING (
    sales_mission.user_has_company_access(company_id)
    AND author_id = auth.uid()
  )
  WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND author_id = auth.uid()
  );
CREATE POLICY supporting_notes_delete ON sales_mission.supporting_notes
  FOR DELETE USING (
    sales_mission.user_has_company_access(company_id)
    AND author_id = auth.uid()
  );

-- History is readable and appendable, never editable or removable: no UPDATE
-- or DELETE policy exists, so those are denied for everyone but the owner role.
CREATE POLICY visit_report_versions_select ON sales_mission.visit_report_versions
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY visit_report_versions_insert ON sales_mission.visit_report_versions
  FOR INSERT WITH CHECK (
    sales_mission.user_has_company_access(company_id)
    AND changed_by = auth.uid()
  );

COMMIT;
