ALTER TABLE user_dashboard_layouts
ADD COLUMN IF NOT EXISTS hidden_widgets jsonb DEFAULT '[]'::jsonb;
