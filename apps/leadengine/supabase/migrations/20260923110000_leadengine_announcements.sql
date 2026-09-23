-- ============================================================
-- LeadEngine release announcements, and which ones a person has closed.
--
-- LeadEngine's "What's new" dialog (the port of Sales Activity's "Yang
-- baru", migration 20260921190000) shows a release once per person on the
-- dashboard. The content lives in code (a changelog entry's `announcement`
-- block in apps/leadengine/features/changelog/changelog-data.ts); a row in
-- release_announcements only says whether an admin switched it on or off
-- and when they last announced it again. No row means the release's own
-- default. Kept in `public`, beside the CRM, not in `sales_mission`
-- (ADR-004), and with no company_id: LeadEngine announcements go to the
-- whole group.
--
-- announced_at is null until an admin presses Announce again: a person's
-- seen mark is keyed on it (or on the release date while it is null), so
-- switching an announcement off and on never repeats it, and announcing
-- again makes it new for everyone.
--
-- user_hints is LeadEngine's copy of sales_mission.user_hints (migration
-- 20260917110000): one row per (person, key), written and readable only by
-- that person, so "once" means once per account on every device.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.release_announcements (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  announced_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT release_announcements_key_slug CHECK (key ~ '^[a-z0-9][a-z0-9_-]{0,59}$')
);

COMMENT ON TABLE public.release_announcements IS
  'LeadEngine What''s new dialog: per release key, on/off and the last Announce again. Content lives in code.';

ALTER TABLE public.release_announcements ENABLE ROW LEVEL SECURITY;

-- Every signed-in person reads them (the dialog needs to know what is on).
-- No write policy on purpose: Settings → Announcements writes with the
-- service role after checking the settings.update grant in the server
-- action, the same arrangement as the AI settings' key.
DROP POLICY IF EXISTS release_announcements_select ON public.release_announcements;
CREATE POLICY release_announcements_select ON public.release_announcements
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.release_announcements FROM anon, authenticated;
GRANT SELECT ON public.release_announcements TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_hints (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, key),
  CONSTRAINT user_hints_key_slug CHECK (key ~ '^[a-z0-9][a-z0-9_-]{0,59}$')
);

COMMENT ON TABLE public.user_hints IS
  'Which one-time LeadEngine surfaces (the What''s new dialog) a person has closed; own rows only.';

ALTER TABLE public.user_hints ENABLE ROW LEVEL SECURITY;

-- Your own rows and nobody else's, in every direction.
DROP POLICY IF EXISTS user_hints_select ON public.user_hints;
CREATE POLICY user_hints_select ON public.user_hints
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_hints_insert ON public.user_hints;
CREATE POLICY user_hints_insert ON public.user_hints
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_hints_update ON public.user_hints;
CREATE POLICY user_hints_update ON public.user_hints
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_hints_delete ON public.user_hints;
CREATE POLICY user_hints_delete ON public.user_hints
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_hints FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hints TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
