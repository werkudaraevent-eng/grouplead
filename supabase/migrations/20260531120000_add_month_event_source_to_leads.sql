-- Adds a companion `month_event_source` column to leads so the system can
-- distinguish a Revenue-Recognition month that was AUTO-derived from the
-- event dates + cut-off rule versus one a user set MANUALLY (e.g. a
-- tentative event whose dates aren't fixed yet).
--
-- Why this matters: the "Recalculate recognition months" action (and the
-- backfill script) must NEVER silently overwrite a value a human chose on
-- purpose. By tracking the source we can recompute only the 'auto' rows and
-- leave 'manual' overrides untouched.
--
-- Backfill strategy (conservative + correct):
--   • Leads WITH event_dates and a month_event  → 'auto'
--       These are derivable, and as of the month_event backfill they already
--       match the rule, so treating them as auto is safe and lets recompute
--       keep them in sync when the cut-off changes.
--   • Leads WITHOUT event_dates but WITH month_event → 'manual'
--       Purely tentative entries — nothing to derive from, so a human set it.
--   • Leads with no month_event → NULL source.

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS month_event_source text;

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_month_event_source_check;

ALTER TABLE public.leads
    ADD CONSTRAINT leads_month_event_source_check
    CHECK (month_event_source IS NULL OR month_event_source IN ('auto', 'manual'));

COMMENT ON COLUMN public.leads.month_event_source IS
    'How the month_event (Revenue Recognition month) was set: ''auto'' when derived from event dates + cut-off rule, ''manual'' when a user overrode it (or entered a tentative month with no event dates). Recalculate jobs only touch ''auto'' rows.';

-- Backfill: derivable rows → auto
UPDATE public.leads
   SET month_event_source = 'auto'
 WHERE month_event IS NOT NULL
   AND month_event_source IS NULL
   AND event_dates IS NOT NULL
   AND array_length(event_dates, 1) > 0;

-- Backfill: tentative rows (month_event set, but no event dates) → manual
UPDATE public.leads
   SET month_event_source = 'manual'
 WHERE month_event IS NOT NULL
   AND month_event_source IS NULL;
