-- Tanya AI on Ringkasan: a question about the period, answered from the
-- numbers the board already computes. Its own switch beside the daily
-- insight, and a log of questions and answers per person, so the cost and
-- the quality of the answers can be looked at later.

BEGIN;

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS ai_ask_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN sales_mission.mission_settings.ai_ask_enabled IS
  'Whether Ringkasan offers "Tanya AI": free questions answered from the period''s numbers.';

CREATE TABLE IF NOT EXISTS sales_mission.ai_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  error text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  -- The period and people the answer was computed for.
  range_from date,
  range_to date,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ai_questions_company_created
  ON sales_mission.ai_questions (company_id, created_at DESC);

ALTER TABLE sales_mission.ai_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_questions_select ON sales_mission.ai_questions;
CREATE POLICY ai_questions_select ON sales_mission.ai_questions
  FOR SELECT USING (sales_mission.user_has_company_access(company_id) AND user_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
