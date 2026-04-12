-- ============================================================
-- MIGRATION: Dynamic Form Engine (JSONB custom_data + form_schemas)
-- ============================================================

-- STEP 1: Add custom_data JSONB column to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

-- STEP 2: Create form_schemas table for dynamic field definitions
CREATE TABLE IF NOT EXISTS public.form_schemas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  module_name text NOT NULL DEFAULT 'leads',
  field_name text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'number', 'date', 'dropdown')),
  is_required boolean DEFAULT false,
  options_category text,  -- links to master_options.option_type when field_type = 'dropdown'
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_schemas_module ON public.form_schemas(module_name);
CREATE INDEX IF NOT EXISTS idx_form_schemas_company ON public.form_schemas(company_id);

-- RLS
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can see schemas for their companies + global (null company_id)
CREATE POLICY "form_schemas_select" ON public.form_schemas FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id = ANY(public.fn_user_company_ids())
  );

-- Manage: admin/super_admin only
CREATE POLICY "form_schemas_manage" ON public.form_schemas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_update_form_schemas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_form_schemas_updated_at
  BEFORE UPDATE ON public.form_schemas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_form_schemas_timestamp();
