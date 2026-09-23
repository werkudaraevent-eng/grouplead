-- ============================================================
-- Usage: who opens LeadEngine, when, and which pages.
--
-- An admin could see what changed in the CRM (History, the audit log) but
-- not whether anyone opens it at all. This is the lightweight shape
-- Salesforce's Lightning Usage App, Notion's workspace analytics and
-- Microsoft 365's active-users report share: one row per person per day
-- (first and last seen, how many pages they opened, the last one), and one
-- counter per page per day. No event stream, no timeline of clicks: a day
-- row answers "is this person using it", a page counter answers "which
-- screens earn their place", and neither can be replayed into a trail of
-- what someone did.
--
-- LeadEngine's own tables, in `public`, beside Sales Activity's
-- `sales_mission.usage_days` / `usage_pages` (migration
-- 20260923090000_usage_tracking.sql) rather than shared with them: each
-- app's schema holds its own data (schema separation, ADR-004), and the
-- two apps count different pages.
--
-- No company_id. LeadEngine's sign-in has no per-unit gate and one person
-- works across units (holding access), so usage is per person across the
-- whole workspace, and Settings → Usage reads it that way.
--
-- Paths arrive normalised by the app (ids and record slugs replaced by
-- :id, no query string; see lib/usage/usage-path.ts), so no record id ever
-- lands here. Nothing typed, nothing shown on a page and no location is
-- recorded.
--
-- Who reads: admins only (`fn_user_is_admin()`, super_admin or admin,
-- migration 20260624080000_recycle_bin_rls.sql). The rows name people; the
-- page additionally asks for the Settings grant.
-- Who writes: `record_usage()`, one call per batch of page opens or per
-- heartbeat, which writes the caller's own day row and nobody else's.
-- Nobody deletes: a person cannot erase their own attendance, and the
-- tables are small (one row per person-day), so there is no sweep.
-- ============================================================

BEGIN;

-- ── Day rows: one per person per WIB day ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The day in WIB (Asia/Jakarta), as the app counts days.
  day date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- Pages opened that day. A heartbeat (still on the page, five minutes on)
  -- moves last_seen_at and adds nothing here.
  views integer NOT NULL DEFAULT 1 CHECK (views >= 0),
  -- The same rule as record_usage's path check below.
  last_path text CHECK (
    last_path IS NULL OR (
      char_length(last_path) <= 200
      AND last_path LIKE '/%'
      AND last_path NOT LIKE '/api%'
      AND last_path NOT LIKE '/login%'
    )
  ),
  -- Also the index each person's newest day is read from (usage_last_seen).
  CONSTRAINT usage_days_person_day UNIQUE (user_id, day)
);

COMMENT ON TABLE public.usage_days IS
  'Usage: one row per person per WIB day (first/last seen, pages opened, last page). Written by record_usage(), read by admins.';

-- The admin page reads a window of days for everyone.
CREATE INDEX IF NOT EXISTS usage_days_day ON public.usage_days (day);

-- ── Page counters: one per page per WIB day ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  -- Normalised: /leads/:id, never a record's id.
  path text NOT NULL CHECK (
    char_length(path) <= 200
    AND path LIKE '/%'
    AND path NOT LIKE '/api%'
    AND path NOT LIKE '/login%'
  ),
  views integer NOT NULL DEFAULT 1 CHECK (views >= 0),
  -- Leads with day, so it also serves the window read; a second index on
  -- day alone would only slow every page open.
  CONSTRAINT usage_pages_page_day UNIQUE (day, path)
);

COMMENT ON TABLE public.usage_pages IS
  'Usage: pages opened per WIB day across LeadEngine, by normalised path. Written by record_usage(), read by admins.';

-- ── Row security ─────────────────────────────────────────────────────────────

ALTER TABLE public.usage_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_pages ENABLE ROW LEVEL SECURITY;

-- Reading: admins only, both tables. `(SELECT …)` so the check runs once
-- per statement, not once per row.
DROP POLICY IF EXISTS usage_days_select ON public.usage_days;
CREATE POLICY usage_days_select ON public.usage_days
  FOR SELECT TO authenticated
  USING ((SELECT public.fn_user_is_admin()));

DROP POLICY IF EXISTS usage_pages_select ON public.usage_pages;
CREATE POLICY usage_pages_select ON public.usage_pages
  FOR SELECT TO authenticated
  USING ((SELECT public.fn_user_is_admin()));

-- Writing a day row: only one's own.
DROP POLICY IF EXISTS usage_days_insert ON public.usage_days;
CREATE POLICY usage_days_insert ON public.usage_days
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS usage_days_update ON public.usage_days;
CREATE POLICY usage_days_update ON public.usage_days
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- A counter everyone adds to; it names no one.
DROP POLICY IF EXISTS usage_pages_insert ON public.usage_pages;
CREATE POLICY usage_pages_insert ON public.usage_pages
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS usage_pages_update ON public.usage_pages;
CREATE POLICY usage_pages_update ON public.usage_pages
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- No DELETE policy, and no DELETE grant either. Supabase's default
-- privileges hand every new table in `public` to anon and authenticated
-- with ALL rights, so those are taken back first and only what the
-- policies above describe is given.
REVOKE ALL ON public.usage_days FROM anon, authenticated;
REVOKE ALL ON public.usage_pages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usage_days TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usage_pages TO authenticated;

-- ── record_usage: the one write ──────────────────────────────────────────────
--
-- One call per batch of page opens (p_views = how many times this path was
-- opened since the last call) or per heartbeat (p_views = 0: seen, nothing
-- opened). Atomic upserts, so two tabs never lose a count to a
-- read-then-write race. The day comes from the app (WIB); one day either
-- side of the database's own WIB day is accepted for a request that
-- crosses midnight, nothing further. p_views is clamped to 0–50, the most
-- the browser ever batches.
--
-- SECURITY DEFINER, where Sales Activity's is SECURITY INVOKER, and on
-- purpose. An upsert's DO UPDATE reads the row already there
-- (`views = d.views + …`), and Postgres then checks that row against the
-- table's SELECT policy as well as its UPDATE policy. Here SELECT is for
-- admins only, so as the caller everyone else's second page of the day
-- would fail with a row-security error. (Sales Activity lets the unit read
-- its own rows, which is why invoker works there.) So the function runs as
-- its owner and does itself what the write policies say: the day row it
-- writes is `auth.uid()`'s and nobody else's, the day is today, the path
-- is checked, the count is clamped. The policies above still govern any
-- direct write. An empty search_path and fully qualified names, so nothing
-- a caller puts on their path can stand in for these tables.
CREATE OR REPLACE FUNCTION public.record_usage(
  p_path text,
  p_day date,
  p_views integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_views integer := greatest(0, least(coalesce(p_views, 1), 50));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'record_usage needs a signed-in user' USING ERRCODE = '42501';
  END IF;
  IF p_day IS NULL OR p_day < v_today - 1 OR p_day > v_today + 1 THEN
    RAISE EXCEPTION 'record_usage: day % is not today', p_day USING ERRCODE = '22023';
  END IF;
  IF p_path IS NULL
     OR char_length(p_path) > 200
     OR p_path NOT LIKE '/%'
     OR p_path LIKE '/api%'
     OR p_path LIKE '/login%' THEN
    RAISE EXCEPTION 'record_usage: path not accepted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.usage_days AS d (user_id, day, first_seen_at, last_seen_at, views, last_path)
  VALUES (v_user, p_day, now(), now(), v_views, p_path)
  ON CONFLICT (user_id, day) DO UPDATE
    SET views = d.views + EXCLUDED.views,
        last_seen_at = greatest(d.last_seen_at, EXCLUDED.last_seen_at),
        last_path = EXCLUDED.last_path;

  IF v_views > 0 THEN
    INSERT INTO public.usage_pages AS pg (day, path, views)
    VALUES (p_day, p_path, v_views)
    ON CONFLICT (day, path) DO UPDATE
      SET views = pg.views + EXCLUDED.views;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.record_usage(text, date, integer) IS
  'Usage: count page opens (or a heartbeat, p_views = 0) for the signed-in person today. Definer: see migration 20260923120000.';

REVOKE ALL ON FUNCTION public.record_usage(text, date, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_usage(text, date, integer) TO authenticated;

-- ── usage_last_seen: each person's newest day ────────────────────────────────
--
-- Each person's most recent day, however long ago, so "Last active" is
-- right for someone last seen before the page's eight-week window and
-- "Never" means never. Invoker, so the select policy applies: an admin
-- gets everyone, anyone else gets nothing.
CREATE OR REPLACE FUNCTION public.usage_last_seen()
RETURNS TABLE (user_id uuid, day date, last_seen_at timestamptz, last_path text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (d.user_id) d.user_id, d.day, d.last_seen_at, d.last_path
  FROM public.usage_days AS d
  ORDER BY d.user_id, d.day DESC;
$$;

REVOKE ALL ON FUNCTION public.usage_last_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usage_last_seen() TO authenticated;

COMMIT;

-- Outside the transaction: PostgREST must see the new tables and functions
-- before the app's first call.
NOTIFY pgrst, 'reload schema';
