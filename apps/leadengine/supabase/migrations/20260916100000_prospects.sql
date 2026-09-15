-- ============================================================
-- Prospects: the inbox before a mission.
--
-- A prospect is a company and a contact that have not yet produced a
-- visit. Reps work the list by phone, log each attempt, and change a
-- status; when an appointment is agreed the prospect is converted into a
-- mission and from then on follows it. Statuses are admin-editable rows
-- whose `kind` is the fixed semantic the code relies on.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.prospect_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('open', 'in_progress', 'won', 'lost')),
  color text NOT NULL DEFAULT 'neutral' CHECK (color IN ('neutral', 'primary', 'warning', 'success', 'danger', 'accent')),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT prospect_statuses_code_unique UNIQUE (company_id, code),
  CONSTRAINT prospect_statuses_label_not_blank CHECK (length(btrim(label)) > 0),
  CONSTRAINT prospect_statuses_code_shape CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS sales_mission.prospect_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS sales_mission.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES sales_mission.prospect_statuses(id) ON DELETE RESTRICT,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  client_company_name text NOT NULL,
  -- Lower, trimmed, single-spaced: the key the import's duplicate check
  -- compares. The app normalises the same way (lib/prospects/prospect-io.ts).
  client_company_name_norm text GENERATED ALWAYS AS
    (lower(btrim(regexp_replace(client_company_name, '\s+', ' ', 'g')))) STORED,
  -- LeadEngine client company, when a lookup matched. Never created here.
  client_company_id uuid,
  industry text,
  location text,
  address text,
  website text,

  contact_salutation text,
  contact_name text,
  contact_name_norm text GENERATED ALWAYS AS
    (lower(btrim(regexp_replace(coalesce(contact_name, ''), '\s+', ' ', 'g')))) STORED,
  contact_job_title text,
  contact_division text,
  contact_phone text,
  -- E.164, written by the app from contact_phone; the second duplicate key.
  contact_phone_norm text,
  contact_email text,
  notes text,

  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  import_batch_id uuid REFERENCES sales_mission.prospect_import_batches(id) ON DELETE SET NULL,

  next_contact_at date,
  last_contacted_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  lost_reason text,

  mission_id uuid REFERENCES sales_mission.missions(id) ON DELETE SET NULL,
  converted_at timestamptz,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prospects_company_not_blank CHECK (length(btrim(client_company_name)) > 0)
);

CREATE TABLE IF NOT EXISTS sales_mission.prospect_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES sales_mission.prospects(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('PHONE', 'WHATSAPP', 'EMAIL', 'VISIT', 'OTHER')),
  outcome text NOT NULL CHECK (outcome IN ('REACHED', 'NO_ANSWER', 'WRONG_NUMBER', 'CALLBACK', 'DECLINED', 'APPOINTMENT')),
  note text,
  attempted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  status_id_after uuid REFERENCES sales_mission.prospect_statuses(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS prospects_company_live_idx ON sales_mission.prospects (company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prospects_owner_due_idx ON sales_mission.prospects (company_id, owner_id, next_contact_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prospects_status_idx ON sales_mission.prospects (company_id, status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prospects_phone_norm_idx ON sales_mission.prospects (company_id, contact_phone_norm) WHERE deleted_at IS NULL AND contact_phone_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_name_pair_idx ON sales_mission.prospects (company_id, client_company_name_norm, contact_name_norm) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prospects_deleted_idx ON sales_mission.prospects (company_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_mission_idx ON sales_mission.prospects (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_attempts_prospect_idx ON sales_mission.prospect_attempts (prospect_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS prospect_statuses_company_idx ON sales_mission.prospect_statuses (company_id, display_order);

-- ── Row security: same helper and shape as form_fields ──
ALTER TABLE sales_mission.prospect_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.prospect_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.prospect_attempts ENABLE ROW LEVEL SECURITY;

-- Statuses are archived, never deleted: no DELETE policy.
CREATE POLICY prospect_statuses_select ON sales_mission.prospect_statuses FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_statuses_insert ON sales_mission.prospect_statuses FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_statuses_update ON sales_mission.prospect_statuses FOR UPDATE USING (sales_mission.user_has_company_access(company_id)) WITH CHECK (sales_mission.user_has_company_access(company_id));

CREATE POLICY prospect_import_batches_select ON sales_mission.prospect_import_batches FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_import_batches_insert ON sales_mission.prospect_import_batches FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));

CREATE POLICY prospects_select ON sales_mission.prospects FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospects_insert ON sales_mission.prospects FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospects_update ON sales_mission.prospects FOR UPDATE USING (sales_mission.user_has_company_access(company_id)) WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospects_delete ON sales_mission.prospects FOR DELETE USING (sales_mission.user_has_company_access(company_id));

CREATE POLICY prospect_attempts_select ON sales_mission.prospect_attempts FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_attempts_insert ON sales_mission.prospect_attempts FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY prospect_attempts_delete ON sales_mission.prospect_attempts FOR DELETE USING (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE ON sales_mission.prospect_statuses TO authenticated;
GRANT SELECT, INSERT ON sales_mission.prospect_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.prospects TO authenticated;
GRANT SELECT, INSERT, DELETE ON sales_mission.prospect_attempts TO authenticated;
GRANT SELECT ON sales_mission.prospect_statuses, sales_mission.prospect_import_batches, sales_mission.prospects, sales_mission.prospect_attempts TO service_role;

-- ── Audit ──
-- Counters that every attempt bumps are not events; the attempt row is.
CREATE OR REPLACE FUNCTION sales_mission.fn_audit_ignored_column(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_column IN ('updated_at', 'created_at', 'last_used_at', 'token_hash', 'crm_synced_at', 'crm_sync_error', 'read_at',
                      'attempt_count', 'last_contacted_at')
$$;

-- Same function as before with three label branches for the prospect tables.
-- The prospects branch sits before the generic `mission_id` one: an unconverted
-- prospect has no mission and must still be labelled by its own name.
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
  ELSIF TG_TABLE_NAME = 'prospect_attempts' THEN
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

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prospects', 'prospect_attempts', 'prospect_statuses'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON sales_mission.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON sales_mission.%I FOR EACH ROW EXECUTE FUNCTION sales_mission.fn_audit_row()',
      t
    );
  END LOOP;
END $$;

-- ── The paged list ──
-- Same shape as fn_list_missions: SECURITY INVOKER so row security decides
-- what the caller may see; NULL means "no filter"; the total is a window
-- count repeated on every row. The mission a converted prospect points at is
-- joined so its state can be shown and filtered as the prospect's own.
CREATE OR REPLACE FUNCTION sales_mission.fn_list_prospects(
  p_company_id uuid,
  p_q text DEFAULT NULL,
  p_status uuid[] DEFAULT NULL,
  p_state text[] DEFAULT NULL,
  p_owner uuid[] DEFAULT NULL,
  p_batch uuid[] DEFAULT NULL,
  p_due date DEFAULT NULL,
  p_sort text DEFAULT 'due',
  p_page integer DEFAULT 0,
  p_size integer DEFAULT 25
)
RETURNS TABLE (id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  WITH base AS (
    SELECT
      p.id, p.created_at, p.owner_id, p.status_id, p.import_batch_id, p.source,
      p.client_company_name, p.contact_name, p.contact_phone_norm, p.contact_email, p.location,
      p.next_contact_at, p.last_contacted_at, p.mission_id,
      s.kind AS status_kind, s.display_order AS status_order,
      o.full_name AS owner_name,
      m.status AS mission_status,
      r.status AS report_status,
      EXISTS (
        SELECT 1 FROM sales_mission.audit_log a
        WHERE a.company_id = p.company_id AND a.mission_id = p.mission_id
          AND a.table_name = 'missions' AND a.action = 'UPDATE' AND a.changes ? 'scheduled_start'
      ) AS rescheduled
    FROM sales_mission.prospects p
    JOIN sales_mission.prospect_statuses s ON s.id = p.status_id
    LEFT JOIN public.profiles o ON o.id = p.owner_id
    LEFT JOIN sales_mission.missions m ON m.id = p.mission_id AND m.deleted_at IS NULL
    LEFT JOIN sales_mission.visit_reports r ON r.mission_id = m.id
    WHERE p.company_id = p_company_id
      AND p.deleted_at IS NULL
  ),
  states AS (
    SELECT b.*,
      CASE
        WHEN b.mission_id IS NULL OR b.mission_status IS NULL THEN 'stored'
        WHEN b.mission_status = 'CANCELLED' THEN 'mission_cancelled'
        WHEN b.mission_status = 'COMPLETED' OR b.report_status = 'SUBMITTED' THEN 'completed'
        WHEN b.rescheduled THEN 'rescheduled'
        ELSE 'stored'
      END AS display_state
    FROM base b
  ),
  filtered AS (
    SELECT s.* FROM states s
    WHERE (p_q IS NULL OR btrim(p_q) = ''
           OR s.client_company_name ILIKE '%' || p_q || '%'
           OR s.contact_name ILIKE '%' || p_q || '%'
           OR (regexp_replace(p_q, '[^0-9]', '', 'g') <> '' AND s.contact_phone_norm ILIKE '%' || regexp_replace(p_q, '[^0-9]', '', 'g') || '%')
           OR s.contact_email ILIKE '%' || p_q || '%'
           OR s.location ILIKE '%' || p_q || '%'
           OR s.owner_name ILIKE '%' || p_q || '%')
      AND (p_status IS NULL AND p_state IS NULL
           OR (p_status IS NOT NULL AND s.status_id = ANY (p_status) AND s.display_state = 'stored')
           OR (p_state IS NOT NULL AND s.display_state = ANY (p_state)))
      AND (p_owner IS NULL
           OR s.owner_id = ANY (p_owner)
           OR (s.owner_id IS NULL AND '00000000-0000-0000-0000-000000000000'::uuid = ANY (p_owner)))
      AND (p_batch IS NULL
           OR s.import_batch_id = ANY (p_batch)
           OR (s.source = 'manual' AND '00000000-0000-0000-0000-000000000000'::uuid = ANY (p_batch)))
      AND (p_due IS NULL
           OR (s.next_contact_at IS NOT NULL AND s.next_contact_at <= p_due AND s.status_kind IN ('open', 'in_progress')))
  ),
  sorted AS (
    SELECT f.*, COALESCE(p_sort, 'due') AS sort_key FROM filtered f
  )
  SELECT f.id, count(*) OVER () AS total
  FROM sorted f
  ORDER BY
    -- "due": what is due first, soonest at the top; then the undated; newest first inside each.
    CASE WHEN f.sort_key = 'due' THEN CASE WHEN f.next_contact_at IS NOT NULL AND f.next_contact_at <= current_date THEN 0 WHEN f.next_contact_at IS NOT NULL THEN 1 ELSE 2 END END,
    CASE WHEN f.sort_key = 'due' THEN f.next_contact_at END ASC,
    CASE WHEN f.sort_key = 'company:asc' THEN lower(f.client_company_name) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'company:desc' THEN lower(f.client_company_name) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'contact:asc' THEN lower(f.contact_name) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'contact:desc' THEN lower(f.contact_name) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'status:asc' THEN f.status_order END ASC,
    CASE WHEN f.sort_key = 'status:desc' THEN f.status_order END DESC,
    CASE WHEN f.sort_key = 'owner:asc' THEN lower(f.owner_name) END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'owner:desc' THEN lower(f.owner_name) END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'last_contact:asc' THEN f.last_contacted_at END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'last_contact:desc' THEN f.last_contacted_at END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'next_contact:asc' THEN f.next_contact_at END ASC NULLS LAST,
    CASE WHEN f.sort_key = 'next_contact:desc' THEN f.next_contact_at END DESC NULLS LAST,
    CASE WHEN f.sort_key = 'created:asc' THEN f.created_at END ASC,
    CASE WHEN f.sort_key = 'created:desc' THEN f.created_at END DESC,
    f.created_at DESC
  LIMIT CASE WHEN p_size <= 0 THEN NULL ELSE p_size END
  OFFSET GREATEST(p_page, 0) * GREATEST(p_size, 0);
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_list_prospects(uuid, text, uuid[], text[], uuid[], uuid[], date, text, integer, integer) TO authenticated;

-- ── Duplicate check for the import ──
-- Keys the app computed for the file: E.164 phones and "company|contact"
-- pairs, both normalised the same way as the generated columns. Returns the
-- live prospects hit by either, so thousands of rows can be checked without
-- reading the table.
CREATE OR REPLACE FUNCTION sales_mission.fn_prospect_dedupe(p_company_id uuid, p_phones text[] DEFAULT NULL, p_pairs text[] DEFAULT NULL)
RETURNS TABLE (match_key text, prospect_id uuid, client_company_name text, contact_name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  SELECT p.contact_phone_norm AS match_key, p.id, p.client_company_name, p.contact_name, p.created_at
  FROM sales_mission.prospects p
  WHERE p.company_id = p_company_id AND p.deleted_at IS NULL
    AND p_phones IS NOT NULL AND p.contact_phone_norm = ANY (p_phones)
  UNION ALL
  SELECT p.client_company_name_norm || '|' || p.contact_name_norm, p.id, p.client_company_name, p.contact_name, p.created_at
  FROM sales_mission.prospects p
  WHERE p.company_id = p_company_id AND p.deleted_at IS NULL
    AND p_pairs IS NOT NULL AND (p.client_company_name_norm || '|' || p.contact_name_norm) = ANY (p_pairs);
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_prospect_dedupe(uuid, text[], text[]) TO authenticated;

-- ── The funnel ──
-- Cohort by the day (Asia/Jakarta) the prospect was created.
CREATE OR REPLACE FUNCTION sales_mission.fn_prospect_funnel(p_company_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE (total bigint, contacted bigint, in_progress bigint, confirmed bigint, completed bigint, lead_pushed bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  WITH cohort AS (
    SELECT p.*, s.kind
    FROM sales_mission.prospects p
    JOIN sales_mission.prospect_statuses s ON s.id = p.status_id
    WHERE p.company_id = p_company_id AND p.deleted_at IS NULL
      AND (p_from IS NULL OR (p.created_at AT TIME ZONE 'Asia/Jakarta')::date >= p_from)
      AND (p_to IS NULL OR (p.created_at AT TIME ZONE 'Asia/Jakarta')::date <= p_to)
  )
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE last_contacted_at IS NOT NULL OR kind IN ('in_progress', 'won', 'lost')) AS contacted,
    count(*) FILTER (WHERE kind = 'in_progress') AS in_progress,
    count(*) FILTER (WHERE kind = 'won') AS confirmed,
    count(*) FILTER (WHERE mission_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales_mission.visit_reports r WHERE r.mission_id = cohort.mission_id AND r.status = 'SUBMITTED')) AS completed,
    count(*) FILTER (WHERE mission_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales_mission.lead_pushes l WHERE l.mission_id = cohort.mission_id)) AS lead_pushed
  FROM cohort;
$$;

GRANT EXECUTE ON FUNCTION sales_mission.fn_prospect_funnel(uuid, date, date) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
