-- =====================================================================
-- Guard: enforce leads.pipeline_stage_id.pipeline_id = leads.pipeline_id
--
-- Background:
--   Two columns on leads carry pipeline information:
--     - leads.pipeline_id              → which pipeline the lead belongs to
--     - leads.pipeline_stage_id        → which stage row (a stage row itself
--                                        belongs to one pipeline)
--   These can diverge if code only updates one side. When that happens the
--   lead becomes invisible on its own pipeline's kanban while still being
--   counted in the other pipeline's dashboard widgets (real bug observed
--   2026-05-17 — 140 historical leads imported into "Group Lead 2025" had
--   stage_id pointing to "Group Lead 2026" stages).
--
--   This migration adds a BEFORE INSERT/UPDATE trigger that:
--     - allows pipeline_stage_id to be NULL
--     - if BOTH are set, requires them to belong to the same pipeline
--     - raises a clear error otherwise
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_validate_lead_stage_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  stage_pipeline_id UUID;
BEGIN
  -- Skip if no stage assigned yet
  IF NEW.pipeline_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if no pipeline yet (lead being created without pipeline assignment)
  IF NEW.pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup the pipeline the chosen stage belongs to
  SELECT pipeline_id INTO stage_pipeline_id
  FROM public.pipeline_stages
  WHERE id = NEW.pipeline_stage_id;

  -- Stage row missing — let the FK constraint catch it instead
  IF stage_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF stage_pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    RAISE EXCEPTION
      'Cross-pipeline stage assignment rejected: lead.pipeline_id (%) does not match pipeline_stages.pipeline_id (%) for stage %',
      NEW.pipeline_id, stage_pipeline_id, NEW.pipeline_stage_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lead_stage_pipeline ON public.leads;

CREATE TRIGGER trg_validate_lead_stage_pipeline
  BEFORE INSERT OR UPDATE OF pipeline_id, pipeline_stage_id
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_lead_stage_pipeline();
