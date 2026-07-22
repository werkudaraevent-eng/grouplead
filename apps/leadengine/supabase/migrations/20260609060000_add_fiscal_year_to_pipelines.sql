-- Add fiscal_year to pipelines for cross-year YoY reporting.
--
-- Pipelines model a fiscal period (e.g. "Group Lead 2025"). The dashboard
-- needs an explicit year so YoY can pair the active pipeline with the prior
-- year's pipeline instead of relying on lead dates (which are unreliable —
-- a pipeline can contain leads dated in other years). Parsing the name is a
-- one-time backfill convenience only; fiscal_year is the source of truth
-- going forward and survives renames.

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;

-- Backfill: extract a 4-digit year (2000-2099) from the pipeline name.
-- Only fills rows where the column is still NULL so re-runs are idempotent.
UPDATE pipelines
SET fiscal_year = CAST(substring(name FROM '(20[0-9]{2})') AS INTEGER)
WHERE fiscal_year IS NULL
  AND name ~ '20[0-9]{2}';

-- Helps the dashboard's prior-year lookup (fiscal_year = active - 1).
CREATE INDEX IF NOT EXISTS idx_pipelines_company_fiscal_year
  ON pipelines (company_id, fiscal_year);
