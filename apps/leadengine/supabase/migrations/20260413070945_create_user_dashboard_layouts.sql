
-- Table to store per-user dashboard grid layouts
CREATE TABLE public.user_dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own layout
CREATE POLICY "Users can view own layout"
  ON public.user_dashboard_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layout"
  ON public.user_dashboard_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own layout"
  ON public.user_dashboard_layouts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
;
