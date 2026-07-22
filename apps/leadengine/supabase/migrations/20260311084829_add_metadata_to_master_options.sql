-- Add metadata JSONB column to master_options for geographic enrichment
ALTER TABLE public.master_options ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Backfill existing event_city rows with country metadata
UPDATE public.master_options
SET metadata = jsonb_build_object('country', 'Indonesia')
WHERE option_type = 'event_city' AND (metadata IS NULL OR metadata = '{}'::jsonb);;
