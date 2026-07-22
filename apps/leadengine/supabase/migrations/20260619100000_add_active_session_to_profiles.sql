-- =====================================================================
-- MIGRATION: Single active session per user (client-side enforcement)
-- Adds a column that holds the ID of the most recent login session.
-- On each login we write a fresh UUID here; older browser sessions detect
-- the mismatch (via Realtime / on-load check) and sign themselves out.
-- This enforces "last login wins" — only one active session per account.
-- =====================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS active_session_id UUID;

-- Allow a user to read/update their own active_session_id. The existing
-- profiles RLS already governs row access per user; this column rides along
-- with those policies, so no extra policy is required. We do, however, need
-- Realtime to broadcast updates to this column so other sessions get kicked
-- out instantly. Ensure the profiles table is in the realtime publication.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
