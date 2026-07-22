-- =====================================================================
-- MIGRATION: Import Stage Mappings + Saved Import Profiles
-- Lets users save mappings between source-spreadsheet values and pipeline
-- stages so future imports auto-translate without manual rename.
-- =====================================================================

-- 1. Stage mappings: per-pipeline rules of the form
--      source_value (e.g. "MATERIALIZED") → target_stage_id
--    Used during import to translate spreadsheet STATUS / Stage columns
--    into the right pipeline_stages.id.
CREATE TABLE IF NOT EXISTS public.import_stage_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    target_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Source value is matched case-insensitively at runtime; we keep the
    -- original casing for display but enforce uniqueness on the lower form.
    CONSTRAINT import_stage_mappings_unique
        UNIQUE (pipeline_id, source_value)
);

CREATE INDEX IF NOT EXISTS idx_import_stage_mappings_pipeline
    ON public.import_stage_mappings(pipeline_id);

ALTER TABLE public.import_stage_mappings ENABLE ROW LEVEL SECURITY;

-- Read access mirrors pipeline_stages (public read, scoped writes).
-- We rely on app-side checks for now, matching the rest of the codebase.
CREATE POLICY "import_stage_mappings_select"
    ON public.import_stage_mappings FOR SELECT USING (true);
CREATE POLICY "import_stage_mappings_insert"
    ON public.import_stage_mappings FOR INSERT WITH CHECK (true);
CREATE POLICY "import_stage_mappings_update"
    ON public.import_stage_mappings FOR UPDATE USING (true);
CREATE POLICY "import_stage_mappings_delete"
    ON public.import_stage_mappings FOR DELETE USING (true);

-- 2. Import profiles: a complete saved configuration (column mapping +
--    stage mapping + flags) that a user can re-apply on the next import.
CREATE TABLE IF NOT EXISTS public.import_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
    is_historical BOOLEAN NOT NULL DEFAULT false,
    -- column_mapping: { [systemFieldKey]: excelHeaderName }
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- stage_mapping: { [sourceValue]: targetStageId }
    stage_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- status_source_field: which spreadsheet column carries STATUS-like values
    status_source_field TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT import_profiles_name_unique
        UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_import_profiles_company
    ON public.import_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_import_profiles_pipeline
    ON public.import_profiles(pipeline_id);

ALTER TABLE public.import_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_profiles_select"
    ON public.import_profiles FOR SELECT USING (true);
CREATE POLICY "import_profiles_insert"
    ON public.import_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "import_profiles_update"
    ON public.import_profiles FOR UPDATE USING (true);
CREATE POLICY "import_profiles_delete"
    ON public.import_profiles FOR DELETE USING (true);

-- 3. updated_at trigger for both tables. Reuses the existing tg_set_updated_at
--    function if it exists, or creates one.
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.import_stage_mappings;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.import_stage_mappings
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.import_profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.import_profiles
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
