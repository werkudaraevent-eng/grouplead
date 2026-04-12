-- Convert event_city from text to text[] for multi-destination support
ALTER TABLE public.leads
  ALTER COLUMN event_city TYPE text[]
  USING CASE
    WHEN event_city IS NOT NULL THEN ARRAY[event_city]
    ELSE NULL
  END;;
