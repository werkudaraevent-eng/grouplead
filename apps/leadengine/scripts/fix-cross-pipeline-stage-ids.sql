-- =====================================================================
-- Fix: leads with pipeline_stage_id pointing to a stage in a DIFFERENT pipeline
--
-- Background:
--   importHistoricalLeadsAction had unscoped `stageMap.get(stageName)` lookups.
--   When users imported into "Group Lead 2025" with stage names matching only
--   "Group Lead 2026" stages, the lead got assigned a 2026 stage_id while its
--   pipeline_id stayed 2025. Result: lead invisible on 2025 kanban, but counted
--   in 2026 dashboard widgets.
--
-- Run this in Supabase SQL Editor (one-shot). Safe to re-run — the WHERE clause
-- only touches mismatched rows.
-- =====================================================================

BEGIN;

-- 1. Preview before update
SELECT
  p_lead.name        AS lead_pipeline,
  p_stage.name       AS stage_pipeline,
  ps_old.name        AS stage_name,
  COUNT(*)           AS total
FROM leads l
JOIN pipeline_stages ps_old ON ps_old.id = l.pipeline_stage_id
JOIN pipelines p_lead       ON p_lead.id  = l.pipeline_id
JOIN pipelines p_stage      ON p_stage.id = ps_old.pipeline_id
WHERE l.pipeline_id IS DISTINCT FROM ps_old.pipeline_id
GROUP BY p_lead.name, p_stage.name, ps_old.name
ORDER BY total DESC;

-- 2. Mapping table — 2026-style stage names → 2025-style stage names
WITH stage_map(src, tgt) AS (
  VALUES
    ('Incoming Lead',                  'Lead Masuk'),
    ('Proposal/ Quotation Sent',       'Proposal Sent'),
    ('Proposal/ Quotation Revise',     'Proposal Sent'),
    ('Follow up Quotation & Proposal', 'Proposal Sent'),
    ('Negotiation',                    'Estimasi Project'),
    ('Closed Won',                     'Closed Won'),
    ('Closed Turndown',                'Closed Lost'),
    ('Closed Postponed',               'Closed Lost'),
    ('Closed Cancelled',               'Closed Lost'),
    ('Closed Lost',                    'Closed Lost')
)
UPDATE leads l
SET pipeline_stage_id = ps_new.id
FROM pipeline_stages ps_old
JOIN stage_map m         ON m.src = ps_old.name
JOIN pipeline_stages ps_new
  ON ps_new.name        = m.tgt
WHERE l.pipeline_stage_id = ps_old.id
  AND ps_new.pipeline_id  = l.pipeline_id   -- target stage MUST be in lead's own pipeline
  AND l.pipeline_id       IS DISTINCT FROM ps_old.pipeline_id;

-- 3. Verify — should return 0 rows
SELECT
  p_lead.name  AS lead_pipeline,
  ps.name      AS stage_name,
  COUNT(*)     AS total
FROM leads l
JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
JOIN pipelines p_lead   ON p_lead.id = l.pipeline_id
WHERE l.pipeline_id IS DISTINCT FROM ps.pipeline_id
GROUP BY p_lead.name, ps.name;

COMMIT;
