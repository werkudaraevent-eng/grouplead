-- Ultra-light checklist for lead detail page
CREATE TABLE IF NOT EXISTS lead_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups per lead
CREATE INDEX IF NOT EXISTS idx_lead_checklists_lead_id ON lead_checklists(lead_id);

-- RLS: enable and allow authenticated users
ALTER TABLE lead_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage lead checklists"
ON lead_checklists FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);;
