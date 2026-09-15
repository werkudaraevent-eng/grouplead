-- ============================================================
-- The visit report's three fixed choices become the admin's, with a locked
-- kind behind each option that the KPI screen, the CRM sync and the lead
-- push act on. The columns on visit_reports keep storing the code; the
-- enum CHECKs go, because the admin may add a code.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.report_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_key text NOT NULL CHECK (field_key IN ('visit_outcome', 'interest_level', 'next_action_type')),
  code text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT report_choices_code_unique UNIQUE (company_id, field_key, code),
  CONSTRAINT report_choices_label_not_blank CHECK (length(btrim(label)) > 0),
  CONSTRAINT report_choices_code_shape CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT report_choices_kind_check CHECK (
    (field_key = 'visit_outcome' AND kind IN ('met_decision_maker', 'met_staff', 'rescheduled', 'absent', 'cancelled')) OR
    (field_key = 'interest_level' AND kind IN ('hot', 'warm', 'cold', 'none')) OR
    (field_key = 'next_action_type' AND kind IN ('action', 'none'))
  )
);

CREATE INDEX IF NOT EXISTS report_choices_company_idx ON sales_mission.report_choices (company_id, field_key, display_order);

ALTER TABLE sales_mission.report_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_choices_select ON sales_mission.report_choices;
DROP POLICY IF EXISTS report_choices_insert ON sales_mission.report_choices;
DROP POLICY IF EXISTS report_choices_update ON sales_mission.report_choices;
CREATE POLICY report_choices_select ON sales_mission.report_choices FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_choices_insert ON sales_mission.report_choices FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY report_choices_update ON sales_mission.report_choices FOR UPDATE USING (sales_mission.user_has_company_access(company_id)) WITH CHECK (sales_mission.user_has_company_access(company_id));
-- No DELETE policy: archiving is the only removal.
GRANT SELECT, INSERT, UPDATE ON sales_mission.report_choices TO authenticated;
GRANT SELECT ON sales_mission.report_choices TO service_role;

-- The enums are the admin's now; the seed carries the same five, four and
-- five codes, so nothing stored is out of range.
ALTER TABLE sales_mission.visit_reports DROP CONSTRAINT IF EXISTS visit_reports_outcome_check;
ALTER TABLE sales_mission.visit_reports DROP CONSTRAINT IF EXISTS visit_reports_interest_check;
ALTER TABLE sales_mission.visit_reports DROP CONSTRAINT IF EXISTS visit_reports_next_action_check;
ALTER TABLE sales_mission.visit_reports ADD CONSTRAINT visit_reports_outcome_shape CHECK (visit_outcome IS NULL OR visit_outcome ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE sales_mission.visit_reports ADD CONSTRAINT visit_reports_interest_shape CHECK (interest_level IS NULL OR interest_level ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE sales_mission.visit_reports ADD CONSTRAINT visit_reports_next_action_shape CHECK (next_action_type ~ '^[A-Z][A-Z0-9_]*$');

-- Audit: the label is the choice's label.
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
  ELSIF TG_TABLE_NAME IN ('prospect_statuses', 'report_choices') THEN
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

DROP TRIGGER IF EXISTS audit_row ON sales_mission.report_choices;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.report_choices
  FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row();

NOTIFY pgrst, 'reload schema';

COMMIT;
