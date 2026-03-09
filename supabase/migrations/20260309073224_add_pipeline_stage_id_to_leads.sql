-- ============================================================
-- Add pipeline_stage_id FK to leads table
-- ============================================================

-- 1. Add nullable UUID column
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID;

-- 2. Add foreign key constraint
ALTER TABLE public.leads
  ADD CONSTRAINT fk_leads_pipeline_stage
  FOREIGN KEY (pipeline_stage_id)
  REFERENCES public.pipeline_stages(id)
  ON DELETE SET NULL;

-- 3. Create index for FK lookups
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage_id
  ON public.leads(pipeline_stage_id);

-- 4. Backfill existing leads by matching status text to pipeline_stages.name
UPDATE public.leads l
SET pipeline_stage_id = ps.id
FROM public.pipeline_stages ps
WHERE LOWER(TRIM(l.status)) = LOWER(TRIM(ps.name))
  AND l.pipeline_stage_id IS NULL;

-- 5. Create trigger to keep status text in sync (backward compat)
CREATE OR REPLACE FUNCTION public.fn_sync_status_from_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id THEN
    SELECT name INTO NEW.status
    FROM public.pipeline_stages
    WHERE id = NEW.pipeline_stage_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_status_from_stage
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_status_from_stage();;
