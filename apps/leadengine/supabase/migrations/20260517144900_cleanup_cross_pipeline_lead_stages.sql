-- =====================================================================
-- One-shot data cleanup: leads with cross-pipeline pipeline_stage_id
--
-- Background:
--   Earlier versions of importHistoricalLeadsAction had unscoped
--   `stageMap.get(stageName)` lookups. Users importing into "Group Lead 2025"
--   ended up with leads whose pipeline_stage_id pointed to a stage in
--   "Group Lead 2026". Result: lead invisible on its own kanban, but counted
--   on the other pipeline's dashboard funnel.
--
--   This migration runs BEFORE 20260517145000_enforce_lead_stage_pipeline_match.sql
--   so the validation trigger does not block the cleanup.
--
--   Idempotent: WHERE clause only touches mismatched rows; safe to re-run.
-- =====================================================================

DO $$
DECLARE
  before_count integer;
  after_count  integer;
BEGIN
  SELECT COUNT(*) INTO before_count
  FROM leads l
  JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
  WHERE l.pipeline_id IS DISTINCT FROM ps.pipeline_id;

  RAISE NOTICE 'Cross-pipeline lead count BEFORE cleanup: %', before_count;

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
    AND ps_new.pipeline_id  = l.pipeline_id
    AND l.pipeline_id       IS DISTINCT FROM ps_old.pipeline_id;

  SELECT COUNT(*) INTO after_count
  FROM leads l
  JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
  WHERE l.pipeline_id IS DISTINCT FROM ps.pipeline_id;

  RAISE NOTICE 'Cross-pipeline lead count AFTER cleanup:  %', after_count;

  IF after_count > 0 THEN
    RAISE WARNING
      'Cleanup left % cross-pipeline rows. Trigger 20260517145000 will reject future writes but existing rows remain. Add their stage names to the mapping table and re-run.',
      after_count;
  END IF;
END $$;
