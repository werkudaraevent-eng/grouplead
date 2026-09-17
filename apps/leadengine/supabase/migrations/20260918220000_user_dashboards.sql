-- ============================================================
-- How a person arranged their Ringkasan: order, hidden cards, sizes,
-- modes, and the cards they composed. One row per person, theirs alone
-- (the user_hints shape). The layout is validated in the app; the
-- database only bounds its size so a bug cannot store a megabyte.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.user_dashboards (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  layout     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_dashboards_layout_object CHECK (jsonb_typeof(layout) = 'object'),
  CONSTRAINT user_dashboards_layout_size   CHECK (pg_column_size(layout) <= 65536)
);

ALTER TABLE sales_mission.user_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_dashboards_select ON sales_mission.user_dashboards
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_dashboards_insert ON sales_mission.user_dashboards
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY user_dashboards_update ON sales_mission.user_dashboards
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_dashboards_delete ON sales_mission.user_dashboards
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.user_dashboards TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
