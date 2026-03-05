-- ============================================================
-- Pipeline Stages Table
-- Dynamic, customizable pipeline columns for the Kanban board
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'gray',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (permissive for now, matching existing pattern)
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on pipeline_stages"
    ON pipeline_stages FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert on pipeline_stages"
    ON pipeline_stages FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update on pipeline_stages"
    ON pipeline_stages FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete on pipeline_stages"
    ON pipeline_stages FOR DELETE
    USING (true);

-- ============================================================
-- Seed default stages matching existing lead statuses
-- ============================================================

INSERT INTO pipeline_stages (name, color, sort_order, is_default) VALUES
    ('Lead Masuk',        'blue',    1, true),
    ('Estimasi Project',  'amber',   2, true),
    ('Proposal Sent',     'violet',  3, true),
    ('Closed Won',        'emerald', 4, true),
    ('Closed Lost',       'red',     5, true)
ON CONFLICT (name) DO NOTHING;
