-- Add PIC (assignee) and due date to lead_checklists so the Tasks tab can
-- track ownership and deadlines per checklist item.
--
-- Both columns are nullable for backward compatibility with existing rows.

ALTER TABLE public.lead_checklists
    ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS idx_lead_checklists_assignee_id
    ON public.lead_checklists(assignee_id);

CREATE INDEX IF NOT EXISTS idx_lead_checklists_due_date
    ON public.lead_checklists(due_date)
    WHERE due_date IS NOT NULL;

-- Reload PostgREST schema cache so the new columns are queryable immediately.
NOTIFY pgrst, 'reload schema';
