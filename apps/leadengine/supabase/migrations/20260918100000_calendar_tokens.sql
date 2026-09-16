-- ============================================================
-- A person's calendar feed link.
--
-- Sales Activity publishes each person's visits as an iCalendar feed that
-- Google Calendar, the iPhone Calendar and Outlook can subscribe to. The
-- feed is fetched by a calendar server with no session, so the URL itself
-- is the credential: a random token, stored only as a hash (the board
-- link pattern), bound to one person and their tenant. One active link
-- per person; making a new one retires the old. Rows are read and written
-- only by their owner: a colleague must not be able to read another
-- person's hash, and nobody else needs to.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS calendar_tokens_user_idx
  ON sales_mission.calendar_tokens(user_id, created_at DESC);

ALTER TABLE sales_mission.calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_tokens_select ON sales_mission.calendar_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY calendar_tokens_insert ON sales_mission.calendar_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Retiring is the only update, and only on your own row. No delete: a
-- retired link stays as a record of when it was made and last used.
CREATE POLICY calendar_tokens_update ON sales_mission.calendar_tokens
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON sales_mission.calendar_tokens TO authenticated;

COMMIT;
