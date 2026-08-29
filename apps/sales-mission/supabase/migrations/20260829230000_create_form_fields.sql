-- Admin-configurable form fields.
--
-- Admins can add fields, choose their type and options, reorder them, and
-- decide what is mandatory — without a deploy.
--
-- Two rules are enforced here rather than trusted to the UI:
--
--  1. Core fields cannot be deleted or made optional. Client company, date,
--     start time and primary sales carry conflict detection, the calendar, KPI
--     and the lead push. Removing one would break those quietly, weeks before
--     anyone noticed. Admins may relabel and reorder them, and may tighten an
--     optional core field into a required one — never the reverse.
--
--  2. Deleting is archiving. Values already captured under a field must stay
--     readable, so `is_active` goes false and the row remains.
--
-- `reporting_key` is the stable identity. Labels are for humans and may change
-- freely; the key is what reports and exports join on, and it never changes.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Which form this field belongs to. The mission form today; the visit report
  -- can adopt the same engine without a second set of tables.
  form_key text NOT NULL DEFAULT 'mission',

  reporting_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,

  is_required boolean NOT NULL DEFAULT false,
  is_core boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,

  placeholder text,
  help_text text,
  -- Choices for SELECT / MULTI_SELECT, as an ordered array of strings.
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT form_fields_form_key_check CHECK (form_key IN ('mission', 'visit_report')),
  CONSTRAINT form_fields_type_check CHECK (field_type IN (
    'TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'TIME',
    'SELECT', 'MULTI_SELECT', 'BOOLEAN'
  )),
  CONSTRAINT form_fields_label_not_blank CHECK (length(btrim(label)) > 0),
  CONSTRAINT form_fields_key_shape CHECK (reporting_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT form_fields_options_is_array CHECK (jsonb_typeof(options) = 'array'),
  -- A custom choice field with no choices cannot be answered. Core choice
  -- fields are exempt: their options come from live data — the tenant's sales
  -- roster, the configured mission types — not from this column.
  CONSTRAINT form_fields_choices_present CHECK (
    is_core
    OR field_type NOT IN ('SELECT', 'MULTI_SELECT')
    OR jsonb_array_length(options) > 0
  ),
  -- Core fields are permanent. Archiving one would remove it from the form just
  -- as surely as deleting it.
  CONSTRAINT form_fields_core_stays_active CHECK (NOT is_core OR is_active),
  CONSTRAINT form_fields_unique_key UNIQUE (company_id, form_key, reporting_key)
);

CREATE INDEX IF NOT EXISTS form_fields_form_idx
  ON sales_mission.form_fields(company_id, form_key, display_order)
  WHERE is_active;

-- Answers to admin-created fields. Core answers keep their own typed columns on
-- `missions`; only custom fields land here.
CREATE TABLE IF NOT EXISTS sales_mission.mission_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES sales_mission.missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  field_id uuid NOT NULL REFERENCES sales_mission.form_fields(id) ON DELETE RESTRICT,

  -- Denormalised on purpose: a report should not need the field row to group
  -- answers, and the key survives the field being archived.
  reporting_key text NOT NULL,
  value jsonb,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT mission_field_values_unique UNIQUE (mission_id, field_id)
);

CREATE INDEX IF NOT EXISTS mission_field_values_reporting_idx
  ON sales_mission.mission_field_values(company_id, reporting_key);

-- ON DELETE RESTRICT above is deliberate: a field that has been answered cannot
-- be deleted, only archived. This makes rule 2 impossible to violate even by
-- someone writing SQL by hand.

ALTER TABLE sales_mission.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.mission_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_fields_select ON sales_mission.form_fields
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY form_fields_insert ON sales_mission.form_fields
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY form_fields_update ON sales_mission.form_fields
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
-- No DELETE policy: archiving is the only removal.

CREATE POLICY mission_field_values_select ON sales_mission.mission_field_values
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY mission_field_values_insert ON sales_mission.mission_field_values
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY mission_field_values_update ON sales_mission.mission_field_values
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

/**
 * Seed the locked core fields for a tenant.
 *
 * Idempotent, so it can run for a tenant that already has some of them. Called
 * lazily the first time an admin opens the form builder, which avoids a
 * backfill across every company that may never use Sales Mission.
 */
CREATE OR REPLACE FUNCTION sales_mission.seed_core_mission_fields(target_company_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
  INSERT INTO sales_mission.form_fields
    (company_id, form_key, reporting_key, label, field_type, is_required, is_core, display_order)
  VALUES
    (target_company_id, 'mission', 'client_company', 'Client company', 'TEXT', true,  true, 10),
    (target_company_id, 'mission', 'mission_type',   'Mission type',   'SELECT', true, true, 20),
    (target_company_id, 'mission', 'location',       'Location',       'TEXT', false, true, 30),
    (target_company_id, 'mission', 'date',           'Date',           'DATE', true,  true, 40),
    (target_company_id, 'mission', 'start_time',     'Start time',     'TIME', true,  true, 50),
    (target_company_id, 'mission', 'end_time',       'End time',       'TIME', false, true, 60),
    (target_company_id, 'mission', 'objective',      'Objective',      'TEXT', false, true, 70),
    (target_company_id, 'mission', 'primary_sales',  'Primary sales',  'SELECT', true, true, 80),
    (target_company_id, 'mission', 'supporting_sales','Supporting sales','MULTI_SELECT', false, true, 90)
  ON CONFLICT (company_id, form_key, reporting_key) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION sales_mission.seed_core_mission_fields(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sales_mission.seed_core_mission_fields(uuid) TO authenticated;

COMMIT;
