-- ============================================================
-- Which in-app hints a person has already seen.
--
-- Sales Activity shows one-step coach marks the first time a control
-- matters (the Lainnya menu, Join, the FAB, Kirim vs draft, installing
-- the app). "Once" has to mean once per person, not once per browser:
-- a rep who signs in on a second phone should not be taught twice, and
-- a cleared cache should not restart the lesson. So the record is a row
-- per (person, hint key), written by the person and readable only by
-- them. The key is a short slug chosen in code; there is no catalogue
-- table because a hint that no longer exists simply has no reader.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.user_hints (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, key),
  CONSTRAINT user_hints_key_slug CHECK (key ~ '^[a-z0-9][a-z0-9_-]{0,59}$')
);

ALTER TABLE sales_mission.user_hints ENABLE ROW LEVEL SECURITY;

-- Your own rows and nobody else's, in every direction.
CREATE POLICY user_hints_select ON sales_mission.user_hints
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_hints_insert ON sales_mission.user_hints
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY user_hints_update ON sales_mission.user_hints
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_hints_delete ON sales_mission.user_hints
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.user_hints TO authenticated;

COMMIT;
