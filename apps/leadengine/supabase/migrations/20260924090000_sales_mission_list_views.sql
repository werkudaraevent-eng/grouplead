-- Sales Activity: saved views on the Aktivitas, Prospek and Laporan lists.
--
-- A saved view is a named URL: the list's own query string (search, facets,
-- the answer lens, the sort), its page size, and which optional columns show
-- in which order. The lists already live in the URL and reopen as they were
-- left (one cookie per list); a saved view lets a person keep more than one
-- way of looking at a list and jump between them in one tap, as LeadEngine's
-- Contacts and Companies do with public.user_list_views.
--
-- Its own table in the sales_mission schema rather than a row in
-- public.user_list_views (ADR-004: each app's data in its own schema): the
-- config is shaped by Sales Activity's URL vocabulary, and the rows are
-- scoped to the unit like every other sales_mission table.
--
-- One person's own rows, inside their own unit; nobody else reads them. At
-- most one default per person, unit and list: the default chooses the view
-- only on a list's first open in a browser, when nothing is remembered (the
-- app decides that; the table only keeps it unique). The config is validated
-- by the app (zod); the database only bounds its size and shape.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.list_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which list: 'activities', 'prospects' or 'reports'.
  list_key text NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  -- { query, size, columns: [{ id, visible }] }, see lib/lists/list-views.ts.
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT list_views_list_key CHECK (list_key IN ('activities', 'prospects', 'reports')),
  CONSTRAINT list_views_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT list_views_config_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT list_views_config_size CHECK (pg_column_size(config) <= 16384)
);

COMMENT ON TABLE sales_mission.list_views IS
  'Saved views of the Aktivitas, Prospek and Laporan lists, one row per named view, owned by one person in one unit.';

-- The page's only read: my views of this list in this unit, oldest first.
CREATE INDEX IF NOT EXISTS list_views_owner_list
  ON sales_mission.list_views (user_id, company_id, list_key, created_at);

-- One default per person, unit and list.
CREATE UNIQUE INDEX IF NOT EXISTS list_views_one_default
  ON sales_mission.list_views (user_id, company_id, list_key)
  WHERE is_default;

-- Names are unique per person and list, ignoring case, so two chips never read the same.
CREATE UNIQUE INDEX IF NOT EXISTS list_views_unique_name
  ON sales_mission.list_views (user_id, company_id, list_key, lower(btrim(name)));

ALTER TABLE sales_mission.list_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_views_select ON sales_mission.list_views;
CREATE POLICY list_views_select ON sales_mission.list_views
  FOR SELECT USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS list_views_insert ON sales_mission.list_views;
CREATE POLICY list_views_insert ON sales_mission.list_views
  FOR INSERT WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS list_views_update ON sales_mission.list_views;
CREATE POLICY list_views_update ON sales_mission.list_views
  FOR UPDATE USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id))
  WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS list_views_delete ON sales_mission.list_views;
CREATE POLICY list_views_delete ON sales_mission.list_views
  FOR DELETE USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.list_views TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
