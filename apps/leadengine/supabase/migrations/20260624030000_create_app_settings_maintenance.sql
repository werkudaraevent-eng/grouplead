-- ============================================================
-- Global application settings (singleton row) + Maintenance Mode
--
-- One global row drives platform-wide settings. First use case:
-- maintenance mode (full lockdown — everyone except super_admin is
-- redirected to /maintenance).
--
-- Security model:
--   • SELECT: any authenticated user (middleware must read the flag on
--     every request, and the client kick-out poller reads it too).
--   • INSERT/UPDATE/DELETE: super_admin ONLY (via profiles.role).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings (
    id integer PRIMARY KEY DEFAULT 1,
    maintenance_enabled boolean NOT NULL DEFAULT false,
    maintenance_message text,
    maintenance_started_at timestamptz,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Enforce singleton: only one row, always id = 1.
    CONSTRAINT app_settings_singleton CHECK (id = 1)
);

-- Seed the single row if missing.
INSERT INTO public.app_settings (id, maintenance_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated may read the global flag.
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (true);

-- Only super admins may change it.
DROP POLICY IF EXISTS "app_settings_write" ON public.app_settings;
CREATE POLICY "app_settings_write"
    ON public.app_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'super_admin'
        )
    );

COMMIT;
