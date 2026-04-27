-- Add actual closed dates to leads table.
-- closed_won_date: stamped when lead transitions to a Won stage
-- closed_lost_date: stamped when lead transitions to a Lost stage
-- Both are nullable — only set when the lead actually reaches that status.
-- Can be manually overridden (e.g., for imported historical leads).

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS closed_won_date timestamptz,
    ADD COLUMN IF NOT EXISTS closed_lost_date timestamptz;

-- Backfill: for existing closed leads, derive closed dates from stage history.
-- Uses the most recent stage_history entry where the stage matches a closed status.
UPDATE public.leads l
SET closed_won_date = sh.created_at
FROM (
    SELECT DISTINCT ON (lsh.lead_id) lsh.lead_id, lsh.created_at
    FROM public.lead_stage_history lsh
    JOIN public.pipeline_stages ps ON ps.id = lsh.stage_id
    WHERE ps.closed_status = 'won'
    ORDER BY lsh.lead_id, lsh.created_at DESC
) sh
WHERE l.id = sh.lead_id
  AND l.closed_won_date IS NULL;

UPDATE public.leads l
SET closed_lost_date = sh.created_at
FROM (
    SELECT DISTINCT ON (lsh.lead_id) lsh.lead_id, lsh.created_at
    FROM public.lead_stage_history lsh
    JOIN public.pipeline_stages ps ON ps.id = lsh.stage_id
    WHERE ps.closed_status = 'lost'
    ORDER BY lsh.lead_id, lsh.created_at DESC
) sh
WHERE l.id = sh.lead_id
  AND l.closed_lost_date IS NULL;
