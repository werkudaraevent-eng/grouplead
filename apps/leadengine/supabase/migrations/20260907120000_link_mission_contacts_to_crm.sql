-- ============================================================
-- Link a mission's appointment contact to the CRM record, when there is one.
--
-- The company already worked this way: `missions.client_company_id` holds the
-- LeadEngine id when the rep picked a match, and
-- `client_company_name_snapshot` always holds what was typed. Id makes the row
-- joinable; snapshot keeps the mission historically honest when the company is
-- later renamed.
--
-- The contact got only half of that. `contact_name`, `contact_job_title`,
-- `contact_phone` and `contact_email` are free text with no link at all, even
-- though LeadEngine has had `contacts.client_company_id` since March. So the
-- same person arrived as "Bpk Nofri" on one mission and "Nofri Ardian" on the
-- next, and no report could count how many decision makers a company had been
-- met at.
--
-- This gives the contact the same treatment: an optional id beside the text
-- that is already there. Nothing existing is rewritten, and a typed-in name
-- with no CRM match stays perfectly valid.
-- ============================================================

BEGIN;

-- Plain uuid, not a foreign key, matching how client_company_id is already
-- declared on this table. The reference crosses from the `sales_mission` schema
-- into `public`, and a hard FK there would make deleting a CRM contact fail
-- against historical missions that merely mention them.
ALTER TABLE sales_mission.missions
  ADD COLUMN IF NOT EXISTS contact_id uuid;

COMMENT ON COLUMN sales_mission.missions.contact_id IS
  'public.contacts.id when the appointment contact was picked from the CRM. Null when the name was typed, which is legitimate: the appointment team often books someone the CRM has never heard of.';

CREATE INDEX IF NOT EXISTS missions_contact_idx
  ON sales_mission.missions(contact_id)
  WHERE contact_id IS NOT NULL;

-- report_contacts already carries lead_engine_contact_id and link_status from
-- 20260829100000, and nothing has ever written to either: the columns were
-- designed and the mechanism was never built. Spell out what the values mean
-- now that they are about to be used, so the next reader does not have to infer
-- it from the code that writes them.
COMMENT ON COLUMN sales_mission.report_contacts.link_status IS
  'SNAPSHOT: typed during the visit, not matched to the CRM. LINKED: matched to public.contacts.id, either picked from the company list or registered from the lead-push modal.';

CREATE INDEX IF NOT EXISTS report_contacts_link_idx
  ON sales_mission.report_contacts(lead_engine_contact_id)
  WHERE lead_engine_contact_id IS NOT NULL;

COMMIT;
