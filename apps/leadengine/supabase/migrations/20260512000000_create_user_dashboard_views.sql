-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-view dashboard support
-- One user can have many named views. Each view captures:
--   - layout_data     : widget positions/sizes
--   - hidden_widgets  : which widgets are hidden
--   - filters         : period, company filter, revenue basis, toggles, etc.
--   - is_default      : the view loaded on a fresh visit
--
-- Session behavior (handled client-side): last-opened view is remembered per
-- browser via localStorage. On first visit or cleared storage, the default
-- view is loaded.
--
-- Legacy: existing rows in user_dashboard_layouts are auto-migrated into a
-- single default view named "My Dashboard" per user. The legacy table remains
-- as a backup snapshot and can be dropped in a later migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_dashboard_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 60),
  layout_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_dashboard_views_user_id_idx
  ON public.user_dashboard_views (user_id);

-- Only one default view per user
CREATE UNIQUE INDEX IF NOT EXISTS user_dashboard_views_one_default_per_user
  ON public.user_dashboard_views (user_id)
  WHERE is_default = true;

ALTER TABLE public.user_dashboard_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard views"
  ON public.user_dashboard_views
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard views"
  ON public.user_dashboard_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard views"
  ON public.user_dashboard_views
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard views"
  ON public.user_dashboard_views
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_user_dashboard_views
  BEFORE UPDATE ON public.user_dashboard_views
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ─── Migrate legacy single-layout rows into a default "My Dashboard" view ───
INSERT INTO public.user_dashboard_views (
  user_id, name, layout_data, hidden_widgets, filters, is_default, sort_order
)
SELECT
  l.user_id,
  'My Dashboard',
  l.layout_data,
  COALESCE(l.hidden_widgets, '[]'::jsonb),
  '{}'::jsonb,
  true,
  0
FROM public.user_dashboard_layouts l
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_dashboard_views v WHERE v.user_id = l.user_id
);
