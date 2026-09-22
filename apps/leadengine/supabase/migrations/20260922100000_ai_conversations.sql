-- Tanya AI keeps its conversations.
--
-- Until now a question and its answer lived only in the open panel: closing
-- it, or walking to another page, threw the thread away, and the log in
-- ai_questions (kept for cost and quality) was never shown back to the person
-- who asked. A chat pane that someone returns to is expected to remember, so
-- a conversation becomes a row: the first question as its title, the turns as
-- they were asked, and nothing else.
--
-- It is one person's own note, not a unit record: a person reads and writes
-- only their own rows, and only inside their own company. Nothing here is
-- audited, and rows older than 90 days are swept by the app's scheduled run
-- (app/api/ai/insights/run), because a question about last quarter's board is
-- no longer about anything.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The first question, cut to 80 characters by the app.
  title text NOT NULL,
  -- [{ question, answer, askedAt }], see lib/ai/ask-conversations.ts.
  turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- So Riwayat can list "3 pertanyaan" without reading every thread it lists.
  turn_count integer GENERATED ALWAYS AS (jsonb_array_length(turns)) STORED,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ai_conversations_turns_array CHECK (jsonb_typeof(turns) = 'array')
);

COMMENT ON TABLE sales_mission.ai_conversations IS
  'Tanya AI threads, one row per conversation, owned by the person who asked. Swept after 90 days.';

-- Riwayat's only query: my conversations, newest use first.
CREATE INDEX IF NOT EXISTS ai_conversations_user_updated
  ON sales_mission.ai_conversations (user_id, updated_at DESC);
-- The retention sweep's filter.
CREATE INDEX IF NOT EXISTS ai_conversations_updated
  ON sales_mission.ai_conversations (updated_at);

ALTER TABLE sales_mission.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select ON sales_mission.ai_conversations;
CREATE POLICY ai_conversations_select ON sales_mission.ai_conversations
  FOR SELECT USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS ai_conversations_insert ON sales_mission.ai_conversations;
CREATE POLICY ai_conversations_insert ON sales_mission.ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS ai_conversations_update ON sales_mission.ai_conversations;
CREATE POLICY ai_conversations_update ON sales_mission.ai_conversations
  FOR UPDATE USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id))
  WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS ai_conversations_delete ON sales_mission.ai_conversations;
CREATE POLICY ai_conversations_delete ON sales_mission.ai_conversations
  FOR DELETE USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.ai_conversations TO authenticated;
-- The scheduled run's 90-day sweep, which has no session to scope it.
GRANT SELECT, DELETE ON sales_mission.ai_conversations TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
