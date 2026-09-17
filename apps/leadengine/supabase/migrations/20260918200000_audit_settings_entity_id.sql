-- ============================================================
-- The audit trigger took entity_id from the row's "id". mission_settings
-- has no id (one row per tenant, keyed by company_id), so every save of
-- the activity rules has failed with a not-null violation since the audit
-- log was added. A row without an id is identified by its company.
-- Same function as 20260916180000_report_choices.sql otherwise.
-- ============================================================

BEGIN;

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
    (v_company, auth.uid(), TG_TABLE_NAME, TG_OP, COALESCE(v_row ->> 'id', v_row ->> 'company_id'), v_mission, NULLIF(btrim(v_label, ' ·'), ''), v_changes, txid_current());

  RETURN NULL;
END;
$$;

COMMIT;
