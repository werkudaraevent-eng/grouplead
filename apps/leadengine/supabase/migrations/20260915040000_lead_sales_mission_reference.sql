-- A lead pushed from a Sales Mission visit kept the mission id inside
-- lead_source ("Sales Mission · <uuid>"). That broke the match with the
-- "Sales Mission" master option (filters, goal attribution, the dashboard
-- widget all group by the exact label) and showed a 36-character code in the
-- Deal Information card. The reference gets its own column; the source stays
-- a plain label.

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sales_mission_id uuid
    REFERENCES sales_mission.missions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.sales_mission_id IS
  'The Sales Mission visit this lead was pushed from, when it was. Deleting the visit keeps the lead.';

CREATE INDEX IF NOT EXISTS leads_sales_mission_id_idx
  ON public.leads (sales_mission_id)
  WHERE sales_mission_id IS NOT NULL;

-- Leads pushed before this column existed: move the id over and restore the
-- label. Only ids that still point at a mission are kept, so the new foreign
-- key cannot fail on a visit deleted since.
UPDATE public.leads AS lead
SET
  sales_mission_id = mission.id,
  lead_source = 'Sales Mission'
FROM sales_mission.missions AS mission
WHERE lead.lead_source LIKE 'Sales Mission · %'
  AND substring(lead.lead_source from 'Sales Mission · ([0-9a-fA-F-]{36})') = mission.id::text;

UPDATE public.leads
SET lead_source = 'Sales Mission'
WHERE lead_source LIKE 'Sales Mission · %';

COMMIT;
