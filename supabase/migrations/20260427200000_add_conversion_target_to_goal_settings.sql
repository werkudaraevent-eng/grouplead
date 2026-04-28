-- Add lead conversion target percentage to goal settings
-- Used by dashboard KPI card to show "vs target" comparison
ALTER TABLE public.goal_settings_v2
    ADD COLUMN IF NOT EXISTS conversion_target_pct numeric DEFAULT NULL;

COMMENT ON COLUMN public.goal_settings_v2.conversion_target_pct IS 'Target lead conversion rate (%). e.g. 30 means 30% conversion target.';
