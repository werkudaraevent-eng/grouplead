-- ============================================================
-- What a pushed lead was classified as, kept with the push.
--
-- The category and grade chosen at "Kirim ke LeadEngine" now travel to
-- the CRM (leads.category, leads.grade_lead). Sales Activity's Ringkasan
-- wants the same breakdown for an evaluation meeting without reading
-- the CRM, so the push record keeps a copy. Write-once, like the rest of
-- lead_pushes (no UPDATE policy). Rows from before this column stay
-- null and report as "Tanpa kategori".
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.lead_pushes
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS grade_lead text;

COMMIT;
