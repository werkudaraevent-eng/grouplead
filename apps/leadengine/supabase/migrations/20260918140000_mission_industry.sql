-- ============================================================
-- Industry on an activity.
--
-- A prospect has an industry; the activity scheduled from it did not,
-- so the CRM company registered at the visit had none either. The
-- activity gets the same field, next to the company name, filled from
-- the prospect or the CRM company when one is picked. The list is the
-- prospect form's (one list, edited in one place, matched to the CRM's
-- Sector options by the admin); the mission form's field is seeded here
-- for tenants that already have a mission form so it appears at once.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.missions ADD COLUMN IF NOT EXISTS industry text;

INSERT INTO sales_mission.form_fields (company_id, form_key, reporting_key, label, field_type, is_required, is_core, options, display_order)
SELECT DISTINCT f.company_id, 'mission', 'industry', 'Industri', 'SELECT', false, true, '[]'::jsonb, 15
FROM sales_mission.form_fields f
WHERE f.form_key = 'mission'
ON CONFLICT (company_id, form_key, reporting_key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
