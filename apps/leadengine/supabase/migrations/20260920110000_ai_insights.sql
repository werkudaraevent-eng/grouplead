-- Daily AI insights for Sales Activity.
--
-- Every morning, and again after reports come in during the day, the app asks
-- the AI proxy for a handful of sentences about the unit's day, computed from
-- numbers the app has already worked out (never from raw rows). The result is
-- kept per unit per day, and per person per day for roles whose reach is
-- narrower than the unit, so a page open costs a read, not a model call.
--
-- Who sees them is a matrix module, "Insight AI", like every other Sales
-- Activity capability: its Lihat and its Cakupan decide whether a person gets
-- the unit's insight, the team's, or their own. Default reach: roles that
-- administer Sales Activity see the unit; roles whose report reach is Tim see
-- their team; everyone else sees nothing until an admin grants it.

BEGIN;

-- 1. The module, mirrored into every configured role like the prospect
--    module was (see 20260916090000), but narrowed as described above.
INSERT INTO public.app_modules (id, name, description, sort_order)
VALUES ('sales_mission_ai', 'AI insights',
        'Daily AI-written insights about visits, reports and prospects.', 20)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.role_permissions (
  company_id, role_id, user_type, module_id,
  can_create, can_read, can_update, can_delete, record_scope, read_scope
)
SELECT
  c.id,
  r.id,
  NULL::text,
  'sales_mission_ai',
  false,
  CASE
    WHEN COALESCE(settings.can_update, false) THEN 'all'
    WHEN COALESCE(result.read_scope, 'all') = 'team' AND COALESCE(result.can_read, 'none') <> 'none' THEN 'all'
    ELSE 'none'
  END,
  false,
  false,
  'own',
  CASE
    WHEN COALESCE(settings.can_update, false) THEN 'all'
    WHEN COALESCE(result.read_scope, 'all') = 'team' THEN 'team'
    ELSE 'own'
  END
FROM public.companies c
CROSS JOIN public.roles r
JOIN public.role_permissions parent
  ON parent.company_id = c.id AND parent.role_id = r.id AND parent.module_id = 'sales_mission'
LEFT JOIN public.role_permissions settings
  ON settings.company_id = c.id AND settings.role_id = r.id AND settings.module_id = 'sales_mission_settings'
LEFT JOIN public.role_permissions result
  ON result.company_id = c.id AND result.role_id = r.id AND result.module_id = 'sales_mission_result'
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.company_id = c.id AND existing.role_id = r.id AND existing.module_id = 'sales_mission_ai'
)
ON CONFLICT (company_id, role_id, module_id) WHERE role_id IS NOT NULL
DO NOTHING;

-- 2. The unit's switches: on/off and the morning hour (WIB).
ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS ai_insights_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_insights_hour smallint NOT NULL DEFAULT 6;
ALTER TABLE sales_mission.mission_settings
  DROP CONSTRAINT IF EXISTS mission_settings_ai_hour_check;
ALTER TABLE sales_mission.mission_settings
  ADD CONSTRAINT mission_settings_ai_hour_check CHECK (ai_insights_hour BETWEEN 0 AND 23);
COMMENT ON COLUMN sales_mission.mission_settings.ai_insights_hour IS
  'Hour of day, Asia/Jakarta, at which the morning insight is written.';

-- 3. The insights themselves. Written only by the app's service client after
--    its own grant check (the cron route and the server actions); read by
--    anyone in the unit, with the module's reach applied in the app.
CREATE TABLE IF NOT EXISTS sales_mission.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- 'unit' for the whole unit; 'person' for one viewer's reach.
  scope text NOT NULL CHECK (scope IN ('unit', 'person')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  -- [{ text, kind, link }], see lib/ai/insights.ts.
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The numbers the model was given, kept for audit.
  facts jsonb,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  error text,
  -- 'schedule' (the morning run), 'report' (reports came in), 'view' (made on open), 'manual' (Buat ulang).
  trigger text NOT NULL DEFAULT 'view',
  -- Reports submitted that day at generation time, so a later report is noticed.
  reports_seen integer NOT NULL DEFAULT 0,
  regenerations integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ai_insights_person_has_user CHECK ((scope = 'person') = (user_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_one_per_day
  ON sales_mission.ai_insights (company_id, day, scope, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE sales_mission.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_insights_select ON sales_mission.ai_insights;
CREATE POLICY ai_insights_select ON sales_mission.ai_insights
  FOR SELECT USING (
    sales_mission.user_has_company_access(company_id)
    AND (scope = 'unit' OR user_id = auth.uid())
  );

-- 4. The cron secret: a random value in Vault that the scheduled call sends
--    as a bearer token and the route compares against.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ai_cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'ai_cron_secret', 'Bearer token the scheduled insight run sends to the app');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ai_read_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ai_cron_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_ai_read_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ai_read_cron_secret() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ai_read_cron_secret() TO service_role;

COMMIT;

-- 5. The schedule: every ten minutes, ask the app to look at every unit. The
--    app decides what is due (the morning run at the unit's hour, a rewrite
--    when reports came in), so the schedule itself never changes when an
--    admin changes the hour. Outside the transaction: extensions and cron
--    jobs do not roll back cleanly, and a failure here must not undo the rest.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sales-activity-ai-insights') THEN
    PERFORM cron.unschedule('sales-activity-ai-insights');
  END IF;
  PERFORM cron.schedule(
    'sales-activity-ai-insights',
    '*/10 * * * *',
    $job$
      SELECT net.http_post(
        url := 'https://mission.werkudara.group/api/ai/insights/run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ai_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$
  );
END $$;

NOTIFY pgrst, 'reload schema';
