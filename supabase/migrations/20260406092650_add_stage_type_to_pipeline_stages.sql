-- Add stage_type column: 'open' or 'closed'
ALTER TABLE pipeline_stages 
  ADD COLUMN IF NOT EXISTS stage_type text NOT NULL DEFAULT 'open'
  CHECK (stage_type IN ('open', 'closed'));

-- Set existing "Closed Won" and "Closed Lost" stages to 'closed'
UPDATE pipeline_stages SET stage_type = 'closed' 
WHERE lower(name) LIKE 'closed%' OR lower(name) LIKE '%won%' OR lower(name) LIKE '%lost%';
;
