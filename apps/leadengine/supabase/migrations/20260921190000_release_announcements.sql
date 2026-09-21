-- Release announcements: which of the product's announceable releases this
-- unit shows in the "Yang baru" dialog, and since when. The content lives in
-- code (apps/sales-mission/lib/changelog.ts); a row here only says on/off and
-- the moment it was (re)announced, which is what a person's "seen" mark in
-- user_hints is keyed on. No row means the release's own default.
BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.release_announcements (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  announced_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (company_id, key),
  CONSTRAINT release_announcements_key_slug CHECK (key ~ '^[a-z0-9][a-z0-9_-]{0,59}$')
);

ALTER TABLE sales_mission.release_announcements ENABLE ROW LEVEL SECURITY;

-- Everyone in the unit reads them (the dialog needs to know what is on);
-- writes are gated by the settings permission in the server action, the
-- same arrangement as mission_settings.
CREATE POLICY release_announcements_select ON sales_mission.release_announcements
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY release_announcements_insert ON sales_mission.release_announcements
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY release_announcements_update ON sales_mission.release_announcements
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE ON sales_mission.release_announcements TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
