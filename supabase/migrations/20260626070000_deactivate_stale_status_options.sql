-- Soft-delete stale master_options rows under option_type = 'status'.
--
-- These 5 rows (ids 9-13) hold PIPELINE STAGE names (Lead Masuk, Estimasi
-- Project, Proposal Sent, Closed Won, Closed Lost), not lead statuses. Lead
-- status is binary (Open / Closed) and the pipeline position is tracked by
-- pipeline_stages + the lead's pipeline_stage_id. These rows are not read by
-- any code path (the import template now hardcodes Open/Closed), so we
-- deactivate them to keep the Master Options list clean before go-live.
--
-- Soft delete (is_active = false) mirrors the app's own delete behaviour and
-- is reversible.

UPDATE public.master_options
SET is_active = false
WHERE option_type = 'status'
  AND label IN ('Lead Masuk', 'Estimasi Project', 'Proposal Sent', 'Closed Won', 'Closed Lost');
