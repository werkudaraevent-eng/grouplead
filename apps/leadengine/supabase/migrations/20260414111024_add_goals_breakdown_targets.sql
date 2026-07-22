ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS breakdown_targets jsonb DEFAULT '{}'::jsonb;;
