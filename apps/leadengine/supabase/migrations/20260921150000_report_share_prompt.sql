-- ============================================================
-- Offer the WhatsApp share after a report is sent, and remember it.
--
-- After "Kirim laporan" the author is offered "Bagikan ke WhatsApp" once:
-- a confirmation card on the report and the next step on the phone's
-- bottom bar, the way Strava, Calendly and Typeform put the next action on
-- the confirmation rather than in a dialog. The offer ends when the share
-- sheet reports a completed share, recorded here so the team can see which
-- reports reached the group and the offer never nags. The unit's admin can
-- turn the offer off for a team that does not use a group.
-- ============================================================

ALTER TABLE sales_mission.visit_reports
  ADD COLUMN IF NOT EXISTS whatsapp_shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_shared_by uuid;

COMMENT ON COLUMN sales_mission.visit_reports.whatsapp_shared_at IS
  'When the report was last shared to WhatsApp from the app (the share sheet completed). Null when never.';
COMMENT ON COLUMN sales_mission.visit_reports.whatsapp_shared_by IS
  'Who shared it; a profile id.';

ALTER TABLE sales_mission.mission_settings
  ADD COLUMN IF NOT EXISTS report_share_prompt boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sales_mission.mission_settings.report_share_prompt IS
  'Offer "Bagikan ke WhatsApp" to the author right after a report is sent (confirmation card and the phone''s next step). The button on the report stays either way.';

NOTIFY pgrst, 'reload schema';
