-- Add a `received_date` business field to leads. This is the date the lead
-- was originally received from the client, separate from the system
-- `created_at` timestamp (which is just when the row was inserted).
--
-- Why a new column instead of reusing `created_at`?
--   * `created_at` is system metadata. It changes when a row is inserted —
--     including bulk imports of historical data, which makes "Received
--     Month" reporting incorrect.
--   * `received_date` is business data. It can be backfilled, edited, and
--     trusted independently of how/when the row was inserted.
--
-- Behavior:
--   * NOT NULL with DEFAULT current_date so new leads pick up today's date
--     automatically. The Add Lead form pre-fills this and lets the user
--     override before saving.
--   * Existing rows are backfilled from `created_at::date` so the new
--     "Received Month" filter has a reasonable default for historic data.
--     Rows whose `created_at` is wrong (e.g. backfilled via the regular
--     import path) can be fixed by editing the lead or re-importing via
--     the Historical Import flow.

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS received_date DATE;

UPDATE public.leads
SET received_date = (created_at AT TIME ZONE 'UTC')::date
WHERE received_date IS NULL;

ALTER TABLE public.leads
    ALTER COLUMN received_date SET NOT NULL,
    ALTER COLUMN received_date SET DEFAULT current_date;

CREATE INDEX IF NOT EXISTS idx_leads_received_date
    ON public.leads(received_date DESC);

NOTIFY pgrst, 'reload schema';
