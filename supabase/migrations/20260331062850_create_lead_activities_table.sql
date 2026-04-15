-- Lead Activities: Audit trail / timeline for lead entity mutations
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,       -- e.g. 'field_update', 'stage_change', 'note_added', 'file_uploaded'
  field_name TEXT,                 -- which field was changed (nullable for non-field actions)
  description TEXT NOT NULL,       -- human-readable summary
  old_value TEXT,                  -- previous value (nullable)
  new_value TEXT,                  -- new value (nullable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast timeline lookups
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- RLS
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read lead activities"
  ON lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lead activities"
  ON lead_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';;
