-- ============================================================================
-- 20260526100000_create_user_list_views.sql
-- ----------------------------------------------------------------------------
-- Saved list views per user, per page (contacts / companies / leads / etc).
--
-- Why a new table instead of reusing user_dashboard_views:
--   • user_dashboard_views is shaped for widget grids (layout_data, hidden
--     widgets) and a single global filter blob.
--   • List views need a richer, *page-scoped* config: filter array, sort,
--     visible columns + order, search scope, page size. Different shape,
--     different access patterns. Mixing them would muddy both schemas.
--
-- Shape:
--   page_key  — discriminator: "contacts" / "companies" / "leads" / etc.
--   name      — user-facing label, unique per (user_id, page_key)
--   is_default — exactly one default per (user_id, page_key)
--   config    — opaque JSON blob defined client-side. Typical keys:
--                 filters: [{ field, op, value }, …]
--                 sort:    { key, direction }
--                 columns: [{ id, visible, width, order }]
--                 search:  { scope: "all" | string[] }
--                 pageSize: number
--               Schema is intentionally loose so client can evolve.
--
-- RLS: standard user-owned rows. No team-shared views in v1.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_list_views (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page_key    text NOT NULL CHECK (char_length(page_key) BETWEEN 1 AND 60),
    name        text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 80),
    is_default  boolean NOT NULL DEFAULT false,
    sort_order  integer NOT NULL DEFAULT 0,
    config      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Lookup index — every fetch is `WHERE user_id = $1 AND page_key = $2`.
CREATE INDEX IF NOT EXISTS user_list_views_user_page_idx
    ON public.user_list_views (user_id, page_key, sort_order);

-- Only one default view per (user, page_key).
CREATE UNIQUE INDEX IF NOT EXISTS user_list_views_one_default_per_user_page
    ON public.user_list_views (user_id, page_key)
    WHERE is_default = true;

-- Names must be unique within a user's page so the UI can dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS user_list_views_unique_name_per_user_page
    ON public.user_list_views (user_id, page_key, lower(name));

ALTER TABLE public.user_list_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own list views"
    ON public.user_list_views FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own list views"
    ON public.user_list_views FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own list views"
    ON public.user_list_views FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own list views"
    ON public.user_list_views FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at on row change.
CREATE TRIGGER set_updated_at_user_list_views
    BEFORE UPDATE ON public.user_list_views
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
