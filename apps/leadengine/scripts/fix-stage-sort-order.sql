-- =====================================================================
-- Fix: pipeline_stages.sort_order so CLOSED stages always sort LAST
--
-- Symptom:
--   On the lead detail stepper (e.g. "Group Lead 2025" historical pipeline),
--   "Closed Won" appears at position #2 instead of at the end. The stepper
--   renders stages strictly by `sort_order ASC`, so the data — not the UI —
--   has the closed stage with a low sort_order.
--
-- Fix:
--   Re-number sort_order per pipeline:
--     1. open stages first   (keep their existing relative order)
--     2. then Closed Won
--     3. then Closed Lost (and any other closed/null-status stages)
--
-- Run in Supabase SQL Editor (one-shot). Idempotent — safe to re-run.
-- =====================================================================

BEGIN;

-- 1. Preview CURRENT ordering (before fix)
SELECT
  p.name                       AS pipeline,
  ps.name                      AS stage,
  ps.stage_type,
  ps.closed_status,
  ps.sort_order                AS current_sort
FROM pipeline_stages ps
JOIN pipelines p ON p.id = ps.pipeline_id
ORDER BY p.name, ps.sort_order;

-- 2. Re-number sort_order so closed stages go last (won before lost)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY pipeline_id
      ORDER BY
        CASE WHEN stage_type = 'closed' OR closed_status IS NOT NULL THEN 1 ELSE 0 END, -- open first
        CASE closed_status WHEN 'won' THEN 0 WHEN 'lost' THEN 1 ELSE 2 END, -- won, then lost
        sort_order,                                                   -- preserve relative order
        name
    ) AS new_sort
  FROM pipeline_stages
)
UPDATE pipeline_stages ps
SET sort_order = r.new_sort
FROM ranked r
WHERE ps.id = r.id
  AND ps.sort_order IS DISTINCT FROM r.new_sort;

-- 3. Verify NEW ordering (closed stages should be last in every pipeline)
SELECT
  p.name                       AS pipeline,
  ps.name                      AS stage,
  ps.stage_type,
  ps.closed_status,
  ps.sort_order                AS new_sort
FROM pipeline_stages ps
JOIN pipelines p ON p.id = ps.pipeline_id
ORDER BY p.name, ps.sort_order;

COMMIT;
