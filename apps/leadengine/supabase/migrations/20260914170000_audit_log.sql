-- ============================================================
-- Audit log for Sales Mission.
--
-- Who did what, to which record, when, and what changed. Written by row
-- triggers rather than by each server action, because an action that forgets
-- to log is the one an admin will want to see. The trigger fires for every
-- write that reaches the table, whichever code path made it.
--
-- One row per changed record. UPDATEs store only the columns that changed,
-- as {column: {from, to}}; INSERT and DELETE store the whole row under "to"
-- or "from". Rows that share a transaction id were one user action (a bulk
-- delete, a cascade), and the reader collapses them.
--
-- The actor is auth.uid() at write time: the signed-in user for anything
-- done through the app, null for the service role (the TV board, cron).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.audit_log (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL,
  actor_id uuid,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_id text NOT NULL,
  -- Not a foreign key: the point of the log is to outlive the mission.
  mission_id uuid,
  entity_label text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  tx_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS audit_log_company_time_idx
  ON sales_mission.audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_company_mission_idx
  ON sales_mission.audit_log (company_id, mission_id, created_at DESC);

ALTER TABLE sales_mission.audit_log ENABLE ROW LEVEL SECURITY;

-- Members read their own tenant's log; the app narrows that to admins. Nobody
-- writes to it directly: the trigger function is SECURITY DEFINER and there
-- are no INSERT, UPDATE or DELETE policies, so the log is append-only from
-- the application's point of view.
DROP POLICY IF EXISTS audit_log_select ON sales_mission.audit_log;
CREATE POLICY audit_log_select ON sales_mission.audit_log
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));

GRANT SELECT ON sales_mission.audit_log TO authenticated;
GRANT SELECT ON sales_mission.audit_log TO service_role;

-- Columns whose every change would be noise.
CREATE OR REPLACE FUNCTION sales_mission.fn_audit_ignored_column(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_column IN ('updated_at', 'created_at', 'last_used_at', 'token_hash', 'crm_synced_at', 'crm_sync_error', 'read_at')
$$;

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

  -- Which mission this is about, and a name for it that survives deletion.
  IF TG_TABLE_NAME = 'missions' THEN
    v_mission := (v_row ->> 'id')::uuid;
    v_label := v_row ->> 'client_company_name_snapshot';
  ELSIF v_row ? 'mission_id' THEN
    v_mission := (v_row ->> 'mission_id')::uuid;
    SELECT client_company_name_snapshot INTO v_label FROM sales_mission.missions WHERE id = v_mission;
  ELSIF v_row ? 'report_id' THEN
    SELECT r.mission_id, m.client_company_name_snapshot INTO v_mission, v_label
    FROM sales_mission.visit_reports r
    LEFT JOIN sales_mission.missions m ON m.id = r.mission_id
    WHERE r.id = (v_row ->> 'report_id')::uuid;
  END IF;

  -- A record with its own name is labelled by it.
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
    -- Nothing but the ignored columns moved: not an event.
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

REVOKE ALL ON FUNCTION sales_mission.fn_audit_row() FROM PUBLIC;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'missions', 'assignments', 'visit_reports', 'report_contacts', 'supporting_notes',
    'reschedule_requests', 'mission_settings', 'form_fields', 'board_tokens', 'lead_pushes',
    'mission_field_values'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON sales_mission.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.%I FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row()',
      t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
