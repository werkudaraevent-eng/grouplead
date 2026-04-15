-- Add visibility column to pipelines
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'all_subs' NOT NULL
  CHECK (visibility IN ('owner_only', 'all_subs', 'selected'));

-- Junction table for selective pipeline access
CREATE TABLE IF NOT EXISTS pipeline_company_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, company_id)
);

-- Enable RLS
ALTER TABLE pipeline_company_access ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read
CREATE POLICY "Authenticated users can read pipeline_company_access"
  ON pipeline_company_access FOR SELECT TO authenticated USING (true);

-- RLS policy: authenticated users can manage
CREATE POLICY "Authenticated users can manage pipeline_company_access"
  ON pipeline_company_access FOR ALL TO authenticated USING (true) WITH CHECK (true);;
