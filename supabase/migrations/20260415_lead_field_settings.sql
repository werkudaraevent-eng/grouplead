-- Lead Field Registry per-company overrides
CREATE TABLE lead_field_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  custom_label TEXT,
  custom_value_source JSONB,
  UNIQUE(company_id, field_key)
);

ALTER TABLE lead_field_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lfs_select" ON lead_field_settings
  FOR SELECT USING (
    company_id = ANY(fn_user_company_ids()) OR fn_user_has_holding_access()
  );

CREATE POLICY "lfs_insert" ON lead_field_settings
  FOR INSERT WITH CHECK (
    company_id = ANY(fn_user_company_ids())
  );

CREATE POLICY "lfs_update" ON lead_field_settings
  FOR UPDATE USING (
    company_id = ANY(fn_user_company_ids())
  ) WITH CHECK (
    company_id = ANY(fn_user_company_ids())
  );

CREATE POLICY "lfs_delete" ON lead_field_settings
  FOR DELETE USING (
    company_id = ANY(fn_user_company_ids())
  );
