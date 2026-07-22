
-- 1. Create the pipelines wrapper entity
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

-- 3. Allow authenticated users to read pipelines
CREATE POLICY "Allow authenticated read pipelines"
  ON pipelines FOR SELECT TO authenticated USING (true);

-- 4. Allow admins/super_admins to manage pipelines
CREATE POLICY "Allow admin manage pipelines"
  ON pipelines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.company_id = pipelines.company_id
        AND cm.user_type IN ('admin', 'super_admin')
    )
  );

-- 5. Inject a default pipeline for each existing company
INSERT INTO pipelines (name, company_id)
SELECT 'Standard Pipeline', id FROM companies;

-- 6. Bind existing stages to a pipeline
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE;

-- 7. Assign all existing stages to the first pipeline found
UPDATE pipeline_stages
SET pipeline_id = (SELECT id FROM pipelines LIMIT 1)
WHERE pipeline_id IS NULL;

-- 8. Add pipeline_id to leads for optimized querying
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;

-- 9. Assign all existing leads to their company's default pipeline
UPDATE leads l
SET pipeline_id = p.id
FROM pipelines p
WHERE l.company_id = p.company_id
  AND l.pipeline_id IS NULL;
;
