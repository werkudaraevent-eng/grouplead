-- One log of every call to the AI proxy from either app, so Settings → AI
-- can show how many tokens a week or a month costs. Written and read by
-- the service role only (the settings actions check the person's grant
-- first); nobody reads it through RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'sales_mission' or 'leadengine'.
  app text NOT NULL,
  -- What asked: 'insight', 'tanya_ai', 'ask_ai', 'analyze', 'uji_model'.
  feature text NOT NULL,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  ok boolean NOT NULL DEFAULT true,
  company_id uuid,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.ai_usage IS
  'Every AI proxy call from both apps with its token counts; the usage card under Settings → AI sums it.';

CREATE INDEX IF NOT EXISTS ai_usage_created ON public.ai_usage (created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role, which bypasses RLS, touches it.

COMMIT;

NOTIFY pgrst, 'reload schema';
