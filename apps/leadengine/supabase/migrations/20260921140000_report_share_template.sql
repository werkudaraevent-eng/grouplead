-- ============================================================
-- The WhatsApp share template for a visit report.
--
-- Teams post a summary of every visit to a WhatsApp group, typed by hand in
-- a format that drifts between people. The app now composes that message
-- from the report and hands it to the phone's share sheet; the format is the
-- admin's, one template per unit, with placeholders in the team's words
-- ({tanggal}, {klien}, {pic}, {ringkasan}, {foto} ...). Null means the
-- app's default, which mirrors the format the group already uses.
-- ============================================================

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS report_share_template text;

COMMENT ON COLUMN sales_mission.mission_settings.report_share_template IS
  'Template for "Bagikan ke WhatsApp" on a submitted visit report; placeholders per lib/missions/report-share.ts. Null = the default template.';

NOTIFY pgrst, 'reload schema';
