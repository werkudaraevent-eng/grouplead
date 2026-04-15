
-- 1. Table for infinite, chronological notes
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for stage progression history
CREATE TABLE IF NOT EXISTS lead_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES pipeline_stages(id),
  stage_name TEXT,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  amount NUMERIC,
  duration_days INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stage_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for authenticated access
CREATE POLICY "Allow authenticated read lead_notes" ON lead_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert lead_notes" ON lead_notes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read lead_stage_history" ON lead_stage_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert lead_stage_history" ON lead_stage_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
;
