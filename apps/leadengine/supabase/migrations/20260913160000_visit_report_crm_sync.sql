-- ============================================================
-- Record whether a submitted visit reached the CRM.
--
-- Submitting a visit report now registers the company and the people met in
-- LeadEngine. That call crosses to another deployment and can fail: LeadEngine
-- down, the rep's role lacking the `companies` grant, a network drop in the
-- field. The report must still submit, because the visit happened whether or
-- not the CRM heard about it. So the outcome is stored here, where the mission
-- page can show "terdaftar di CRM" or "belum, coba lagi" instead of implying
-- something it cannot know.
-- ============================================================

ALTER TABLE sales_mission.visit_reports
  ADD COLUMN IF NOT EXISTS crm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_sync_error text;

COMMENT ON COLUMN sales_mission.visit_reports.crm_synced_at IS
  'When the company and contacts from this report were last registered in LeadEngine. Null until the first successful sync.';
COMMENT ON COLUMN sales_mission.visit_reports.crm_sync_error IS
  'Why the last sync attempt failed, for the retry button. Cleared on success.';
