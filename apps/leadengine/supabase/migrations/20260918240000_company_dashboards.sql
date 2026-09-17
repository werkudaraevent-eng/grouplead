-- ============================================================
-- The unit's default Ringkasan.
--
-- A person's own arrangement lives in user_dashboards. An admin can
-- publish their arrangement as the unit's default: everyone who has not
-- arranged their own board sees it, and "Kembali ke susunan awal" returns
-- to it. One row per company. Everyone in the company reads it; the app
-- lets only Pengaturan → ubah write it (the mission_settings pattern).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.company_dashboards (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  layout     jsonb NOT NULL DEFAULT '{}'::jsonb,
  set_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT company_dashboards_layout_object CHECK (jsonb_typeof(layout) = 'object'),
  CONSTRAINT company_dashboards_layout_size   CHECK (pg_column_size(layout) <= 65536)
);

ALTER TABLE sales_mission.company_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_dashboards_select ON sales_mission.company_dashboards
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY company_dashboards_insert ON sales_mission.company_dashboards
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY company_dashboards_update ON sales_mission.company_dashboards
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY company_dashboards_delete ON sales_mission.company_dashboards
  FOR DELETE USING (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON sales_mission.company_dashboards TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
