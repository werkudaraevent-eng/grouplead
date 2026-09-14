-- ============================================================
-- The visit report becomes a configured form, like the mission form.
--
-- form_fields already allowed form_key = 'visit_report'; nothing used it.
-- Custom answers on a report need a home, mirroring mission_field_values.
-- One new field type, CONTACTS, names the "who did you meet" group so the
-- settings screen can show it for what it is; it is core-only, never
-- offered for a custom field.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.form_fields DROP CONSTRAINT IF EXISTS form_fields_type_check;
ALTER TABLE sales_mission.form_fields ADD CONSTRAINT form_fields_type_check CHECK (field_type IN (
  'TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'TIME', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'CONTACTS'
));

CREATE TABLE IF NOT EXISTS sales_mission.report_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES sales_mission.visit_reports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  -- RESTRICT, as on missions: an answered field can be archived, never deleted.
  field_id uuid NOT NULL REFERENCES sales_mission.form_fields(id) ON DELETE RESTRICT,
  reporting_key text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT report_field_values_unique UNIQUE (report_id, field_id)
);

CREATE INDEX IF NOT EXISTS report_field_values_reporting_idx
  ON sales_mission.report_field_values (company_id, reporting_key);

ALTER TABLE sales_mission.report_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_field_values_select ON sales_mission.report_field_values;
DROP POLICY IF EXISTS report_field_values_insert ON sales_mission.report_field_values;
DROP POLICY IF EXISTS report_field_values_update ON sales_mission.report_field_values;
DROP POLICY IF EXISTS report_field_values_delete ON sales_mission.report_field_values;
CREATE POLICY report_field_values_select ON sales_mission.report_field_values
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_field_values_insert ON sales_mission.report_field_values
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_field_values_update ON sales_mission.report_field_values
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_field_values_delete ON sales_mission.report_field_values
  FOR DELETE USING (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.report_field_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.report_field_values TO service_role;

-- Same audit trail as every other mission table.
DROP TRIGGER IF EXISTS audit_row ON sales_mission.report_field_values;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.report_field_values
  FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row();

NOTIFY pgrst, 'reload schema';

COMMIT;
