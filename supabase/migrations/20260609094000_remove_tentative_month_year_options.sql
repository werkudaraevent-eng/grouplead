-- Remove orphan Month/Year master options.
--
-- Revenue-recognition Month and Year are now generated client-side as calendar
-- constants (12 months; year range 2015..currentYear+2) instead of being read
-- from master_options. The old rows are no longer referenced by any module
-- (the lead form generates them, the dashboard/goals read the derived
-- `month_event` column, and goal dimensions already exclude these types), so
-- they are safe to delete. They also caused a bug: historical leads whose year
-- (e.g. 2025) was not in the seeded option list (2026/2027) showed a blank
-- Year, blocking edits.

DELETE FROM master_options
WHERE option_type IN ('tentative_month', 'tentative_year');
