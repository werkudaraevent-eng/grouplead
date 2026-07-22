-- Migrate event_city (text[]) and event_venue (text) into a single destinations JSONB column
-- Backfill existing data: combine city array + venue into destination objects
ALTER TABLE public.leads ADD COLUMN destinations jsonb DEFAULT '[]'::jsonb;

-- Backfill: create destination objects from existing data
UPDATE public.leads
SET destinations = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('city', city_val, 'venue', COALESCE(event_venue, ''))
    ),
    '[]'::jsonb
  )
  FROM unnest(event_city) AS city_val
)
WHERE event_city IS NOT NULL AND array_length(event_city, 1) > 0;

-- Drop the old columns
ALTER TABLE public.leads DROP COLUMN event_city;
ALTER TABLE public.leads DROP COLUMN event_venue;;
