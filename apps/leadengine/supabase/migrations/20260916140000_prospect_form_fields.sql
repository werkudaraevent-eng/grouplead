-- ============================================================
-- The prospect form becomes a configured form, like the mission form and
-- the visit report: form_fields gains form_key = 'prospect', and custom
-- answers on a prospect get a home mirroring mission_field_values.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.form_fields DROP CONSTRAINT IF EXISTS form_fields_form_key_check;
ALTER TABLE sales_mission.form_fields ADD CONSTRAINT form_fields_form_key_check
  CHECK (form_key IN ('mission', 'visit_report', 'prospect'));

CREATE TABLE IF NOT EXISTS sales_mission.prospect_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES sales_mission.prospects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  -- RESTRICT, as on missions: an answered field can be archived, never deleted.
  field_id uuid NOT NULL REFERENCES sales_mission.form_fields(id) ON DELETE RESTRICT,
  reporting_key text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT prospect_field_values_unique UNIQUE (prospect_id, field_id)
);

CREATE INDEX IF NOT EXISTS prospect_field_values_reporting_idx
  ON sales_mission.prospect_field_values (company_id, reporting_key);

ALTER TABLE sales_mission.prospect_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_field_values_select ON sales_mission.prospect_field_values;
DROP POLICY IF EXISTS prospect_field_values_insert ON sales_mission.prospect_field_values;
DROP POLICY IF EXISTS prospect_field_values_update ON sales_mission.prospect_field_values;
DROP POLICY IF EXISTS prospect_field_values_delete ON sales_mission.prospect_field_values;
CREATE POLICY prospect_field_values_select ON sales_mission.prospect_field_values
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_field_values_insert ON sales_mission.prospect_field_values
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_field_values_update ON sales_mission.prospect_field_values
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_field_values_delete ON sales_mission.prospect_field_values
  FOR DELETE USING (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.prospect_field_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.prospect_field_values TO service_role;

-- The audit trigger labels a prospect's answers with the prospect's company,
-- the way a contact attempt is labelled.
CREATE OR REPLACE FUNCTION sales_mission.fn_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_row jsonb := COALESCE(v_new, v_old);
  v_company uuid := (v_row ->> 'company_id')::uuid;
  v_mission uuid;
  v_label text;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
BEGIN
  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'missions' THEN
    v_mission := (v_row ->> 'id')::uuid;
    v_label := v_row ->> 'client_company_name_snapshot';
  ELSIF TG_TABLE_NAME = 'prospects' THEN
    v_label := v_row ->> 'client_company_name';
    v_mission := NULLIF(v_row ->> 'mission_id', '')::uuid;
  ELSIF TG_TABLE_NAME IN ('prospect_attempts', 'prospect_field_values') THEN
    SELECT p.client_company_name, p.mission_id INTO v_label, v_mission
    FROM sales_mission.prospects p WHERE p.id = (v_row ->> 'prospect_id')::uuid;
  ELSIF TG_TABLE_NAME = 'prospect_statuses' THEN
    v_label := v_row ->> 'label';
  ELSIF v_row ? 'mission_id' THEN
    v_mission := (v_row ->> 'mission_id')::uuid;
    SELECT client_company_name_snapshot INTO v_label FROM sales_mission.missions WHERE id = v_mission;
  ELSIF v_row ? 'report_id' THEN
    SELECT r.mission_id, m.client_company_name_snapshot INTO v_mission, v_label
    FROM sales_mission.visit_reports r
    LEFT JOIN sales_mission.missions m ON m.id = r.mission_id
    WHERE r.id = (v_row ->> 'report_id')::uuid;
  END IF;

  IF TG_TABLE_NAME = 'form_fields' THEN v_label := v_row ->> 'label';
  ELSIF TG_TABLE_NAME = 'board_tokens' THEN v_label := v_row ->> 'label';
  ELSIF TG_TABLE_NAME = 'report_contacts' THEN v_label := COALESCE(v_label, '') || ' · ' || COALESCE(v_row ->> 'full_name', '');
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('to', v_new);
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('from', v_old);
  ELSE
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(v_new) LOOP
      IF sales_mission.fn_audit_ignored_column(TG_TABLE_NAME, v_key) THEN CONTINUE; END IF;
      IF v_old -> v_key IS DISTINCT FROM v_val THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_val));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO sales_mission.audit_log
    (company_id, actor_id, table_name, action, entity_id, mission_id, entity_label, changes, tx_id)
  VALUES
    (v_company, auth.uid(), TG_TABLE_NAME, TG_OP, v_row ->> 'id', v_mission, NULLIF(btrim(v_label, ' ·'), ''), v_changes, txid_current());

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_row ON sales_mission.prospect_field_values;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.prospect_field_values
  FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row();

NOTIFY pgrst, 'reload schema';

COMMIT;
