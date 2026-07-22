-- Create form_schemas table for dynamic field definitions
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
  options_category text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_schemas_module ON public.form_schemas(module_name);
CREATE INDEX IF NOT EXISTS idx_form_schemas_company ON public.form_schemas(company_id);

-- RLS
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated users (full access)
CREATE POLICY "form_schemas_full_access" ON public.form_schemas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
  EXECUTE FUNCTION public.fn_update_form_schemas_timestamp();;
