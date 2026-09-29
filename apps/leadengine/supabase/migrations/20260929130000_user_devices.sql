-- ============================================================
-- Several sessions at once, and a list of them ("Active devices").
--
-- Until now both apps ran "last login wins": a sign-in stamped a fresh id on
-- profiles.active_session_id, and LeadEngine signed out every browser that
-- held an older one. It signed a field rep's phone out every time they opened
-- the CRM on a laptop, and Sales Activity never checked the id at all, so a
-- Sales Activity sign-in threw LeadEngine out elsewhere while nothing ever
-- threw Sales Activity out. Salesforce, HubSpot and Google allow concurrent
-- sessions by default and give the person a list to sign devices out of;
-- both apps now do the same.
--
-- The session is Supabase Auth's own. Every access token carries a
-- `session_id` claim, the primary key of auth.sessions, and GoTrue's own
-- sign-out is `DELETE FROM auth.sessions WHERE id = …` (refresh tokens and
-- AMR claims go with the row, ON DELETE CASCADE). Once the row is gone,
-- GET /auth/v1/user answers 403 session_not_found for that token and the
-- refresh token no longer exists, and both apps' proxies ask /user on every
-- navigation, so a device signed out here is out on its next request.
--
-- What this adds:
--   1. public.user_devices: what the apps know about a session that Auth does
--      not keep reliably (the browser's own user agent — auth.sessions keeps
--      the agent of the last refresh, which is often the app's server — the
--      city Vercel saw, and the app used last), keyed by the session id.
--      Its owner reads it; only the functions below write it.
--   2. fn_touch_device, fn_list_my_devices, fn_sign_out_device,
--      fn_sign_out_other_devices, fn_admin_sign_out_user: SECURITY DEFINER,
--      search_path pinned, EXECUTE for `authenticated` only.
--   3. fn_cleanup_idle_sessions and a daily pg_cron job: a session idle for
--      30 days signs out on its own.
--   4. profiles.active_session_id is marked deprecated. Nothing reads or
--      writes it any more; a later migration drops it.
--
-- Every function reaches auth.sessions as its owner, the role that runs
-- migrations (postgres on Supabase). The first block checks that role can
-- read and delete there, so a project where it cannot fails here, loudly,
-- rather than shipping functions that fail on every call.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('auth.sessions') IS NULL THEN
    RAISE EXCEPTION 'auth.sessions does not exist: this migration needs Supabase Auth';
  END IF;
  IF NOT has_table_privilege('auth.sessions', 'SELECT') OR NOT has_table_privilege('auth.sessions', 'DELETE') THEN
    RAISE EXCEPTION 'Role % needs SELECT and DELETE on auth.sessions for the device functions', current_user;
  END IF;
END $$;

-- ── 4. The old single-session id ─────────────────────────────────────────────

COMMENT ON COLUMN public.profiles.active_session_id IS
  'DEPRECATED 2026-09-29: the "last login wins" id. No app reads or writes it since multiple sessions and Active devices (migration 20260929130000_user_devices.sql). Kept for one release, then dropped.';

-- ── 1. Devices ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_devices (
  -- auth.sessions.id, the JWT's session_id claim. No foreign key: auth's
  -- tables are Supabase's to change, and a row whose session is gone is never
  -- shown (the list joins auth.sessions) and is swept by the functions below.
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The app this session was used in last. One sign-in covers both.
  app text NOT NULL CHECK (app IN ('leadengine', 'sales_activity')),
  -- navigator.userAgent, parsed for display by the apps.
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  -- From Vercel's geo headers; null locally and when Vercel does not know.
  city text CHECK (city IS NULL OR char_length(city) <= 120),
  country text CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_devices IS
  'Active devices: one row per Supabase Auth session the apps have seen (user agent, city, last app, last seen). Read by its owner; written by fn_touch_device; removed with the session.';

CREATE INDEX IF NOT EXISTS user_devices_user ON public.user_devices (user_id);
-- The daily sweep reads by age.
CREATE INDEX IF NOT EXISTS user_devices_last_seen ON public.user_devices (last_seen_at);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_devices_select_own ON public.user_devices;
CREATE POLICY user_devices_select_own ON public.user_devices
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No write policy: every write goes through a SECURITY DEFINER function.
REVOKE ALL ON public.user_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_devices TO authenticated;

-- ── 2. Functions ─────────────────────────────────────────────────────────────

-- The session id of the token this request carries, or null (a token from
-- before session ids, or no token). GoTrue mints the claim, so it is a uuid;
-- anything else reads as none rather than failing the caller. Used inside
-- the functions below only.
CREATE OR REPLACE FUNCTION public.fn_current_session_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN claim.v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN claim.v::uuid
         END
    FROM (SELECT auth.jwt() ->> 'session_id' AS v) AS claim
$$;

-- Record that the caller's current session is in use, from which app and
-- where. Called by both apps on load and, throttled, on focus. It writes at
-- most once per five minutes per session, unless the app changed (switching
-- apps should show at once), so a busy tab costs one small update now and
-- then. City and country only replace what is stored when they arrive: a
-- request without Vercel's headers (local development) keeps the last known.
CREATE OR REPLACE FUNCTION public.fn_touch_device(
  p_app text,
  p_user_agent text,
  p_city text,
  p_country text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sid uuid := public.fn_current_session_id();
  v_agent text := left(nullif(btrim(p_user_agent), ''), 512);
  v_city text := left(nullif(btrim(p_city), ''), 120);
  v_country text := CASE WHEN btrim(p_country) ~ '^[A-Za-z]{2}$' THEN upper(btrim(p_country)) END;
  v_written integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_app IS NULL OR p_app NOT IN ('leadengine', 'sales_activity') THEN
    RAISE EXCEPTION 'unknown_app' USING ERRCODE = '22023';
  END IF;
  -- A token without a session has nothing to attach to.
  IF v_sid IS NULL THEN
    RETURN;
  END IF;
  -- Only a live session of this person. A token outliving its session (up to
  -- the access token's hour) must not bring the row back.
  IF NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = v_sid AND s.user_id = v_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_devices AS d (session_id, user_id, app, user_agent, city, country)
  VALUES (v_sid, v_uid, p_app, v_agent, v_city, v_country)
  ON CONFLICT (session_id) DO UPDATE
     SET app = EXCLUDED.app,
         user_agent = coalesce(EXCLUDED.user_agent, d.user_agent),
         city = CASE WHEN EXCLUDED.city IS NOT NULL OR EXCLUDED.country IS NOT NULL THEN EXCLUDED.city ELSE d.city END,
         country = coalesce(EXCLUDED.country, d.country),
         last_seen_at = now()
   WHERE d.user_id = v_uid
     AND (d.last_seen_at < now() - interval '5 minutes' OR d.app IS DISTINCT FROM EXCLUDED.app);

  GET DIAGNOSTICS v_written = ROW_COUNT;

  -- While writing anyway, drop this person's rows whose session has ended
  -- (signed out elsewhere, password changed): a few rows, by index.
  IF v_written > 0 THEN
    DELETE FROM public.user_devices d
     WHERE d.user_id = v_uid
       AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = d.session_id);
  END IF;
END;
$$;

-- The caller's live sessions, this one first, then by last activity. Driven
-- by auth.sessions, so a signed-out device never shows and a session no app
-- has touched yet (signed in before this release, not opened since) still
-- shows, with Auth's own user agent, and can be signed out. Last activity
-- is the latest of what the apps recorded and when Auth last refreshed the
-- session: an open tab refreshes its token hourly without anyone focusing it.
CREATE OR REPLACE FUNCTION public.fn_list_my_devices()
RETURNS TABLE (
  session_id uuid,
  app text,
  user_agent text,
  city text,
  country text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid, public.fn_current_session_id() AS sid
  )
  SELECT s.id,
         d.app,
         coalesce(d.user_agent, s.user_agent),
         d.city,
         d.country,
         coalesce(d.first_seen_at, s.created_at),
         greatest(d.last_seen_at, s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at),
         coalesce(s.id = me.sid, false)
    FROM me
    JOIN auth.sessions s ON s.user_id = me.uid
    LEFT JOIN public.user_devices d ON d.session_id = s.id AND d.user_id = s.user_id
   WHERE me.uid IS NOT NULL
     AND (s.not_after IS NULL OR s.not_after > now())
   ORDER BY (s.id = me.sid) DESC NULLS LAST,
            greatest(d.last_seen_at, s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at) DESC NULLS LAST
$$;

-- Sign one of the caller's other devices out. Deleting the auth.sessions row
-- is exactly GoTrue's own sign-out; its refresh tokens go with it. The
-- current session is refused: the app's own Sign out is the door for that,
-- and it also clears this browser's cookie. Returns whether a session ended
-- (false when it had already gone).
CREATE OR REPLACE FUNCTION public.fn_sign_out_device(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ended integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_required' USING ERRCODE = '22023';
  END IF;
  IF p_session_id = public.fn_current_session_id() THEN
    RAISE EXCEPTION 'current_session' USING ERRCODE = '22023',
      HINT = 'Use Sign out to leave the device you are on.';
  END IF;

  DELETE FROM auth.sessions WHERE id = p_session_id AND user_id = v_uid;
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  DELETE FROM public.user_devices WHERE session_id = p_session_id AND user_id = v_uid;

  RETURN v_ended > 0;
END;
$$;

-- Sign the caller out everywhere but here. Refuses when the token names no
-- session, since "everywhere but here" would then mean everywhere. Returns
-- how many sessions ended.
CREATE OR REPLACE FUNCTION public.fn_sign_out_other_devices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sid uuid := public.fn_current_session_id();
  v_ended integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_sid IS NULL THEN
    RAISE EXCEPTION 'no_current_session' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = v_uid AND id <> v_sid;
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  DELETE FROM public.user_devices WHERE user_id = v_uid AND session_id <> v_sid;

  RETURN v_ended;
END;
$$;

-- Whether the caller may sign `p_user_id` out everywhere: the same grant
-- Settings › Users asks for its other account actions (deactivate, reset
-- password), `members` update in the permission matrix, held in a business
-- unit the person belongs to, or in a holding company (a holding sees every
-- unit, as everywhere in LeadEngine). A super admin may act on anyone; only a
-- super admin may act on a super admin, as with an admin password reset.
CREATE OR REPLACE FUNCTION public.fn_can_sign_out_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_user_id IS NULL THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(replace(coalesce(p.role, ''), ' ', '_')) = 'super_admin'
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles t
       WHERE t.id = p_user_id
         AND lower(replace(coalesce(t.role, ''), ' ', '_')) = 'super_admin'
    ) THEN false
    ELSE EXISTS (
      SELECT 1
        FROM unnest(public.fn_user_company_ids()) AS mine(company_id)
        JOIN public.companies c ON c.id = mine.company_id
       WHERE public.fn_user_has_matrix_permission(mine.company_id, 'members', 'update')
         AND (
           c.is_holding = true
           OR EXISTS (
             SELECT 1 FROM public.company_members m
              WHERE m.user_id = p_user_id
                AND m.company_id = mine.company_id
           )
         )
    )
  END
$$;

-- For a lost phone or someone leaving: end every session of one person, in
-- both apps. Their data stays and they can sign in again unless the account
-- is also deactivated. Not for one's own account (Active devices is). Returns
-- how many sessions ended; the app writes the audit line.
CREATE OR REPLACE FUNCTION public.fn_admin_sign_out_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ended integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_required' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'self' USING ERRCODE = '22023',
      HINT = 'Use Active devices on your own profile.';
  END IF;
  IF NOT public.fn_can_sign_out_user(p_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  DELETE FROM public.user_devices WHERE user_id = p_user_id;

  RETURN v_ended;
END;
$$;

-- ── 3. Idle sessions ─────────────────────────────────────────────────────────

-- End sessions nobody has used for `p_idle` (30 days by default), in batches.
-- "Used" is the latest of every signal there is: the apps' last touch, Auth's
-- last refresh, the row's own update and its creation. A session with no
-- device row is judged by Auth's timestamps alone, so a recent one is never
-- touched; one with no timestamp at all is left alone. Then the device rows
-- whose session is gone. Called by pg_cron only.
CREATE OR REPLACE FUNCTION public.fn_cleanup_idle_sessions(p_idle interval DEFAULT interval '30 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ended integer;
BEGIN
  IF p_idle IS NULL OR p_idle < interval '7 days' THEN
    RAISE EXCEPTION 'idle interval must be at least 7 days' USING ERRCODE = '22023';
  END IF;

  WITH idle AS (
    SELECT s.id
      FROM auth.sessions s
      LEFT JOIN public.user_devices d ON d.session_id = s.id
     WHERE greatest(d.last_seen_at, s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at) < now() - p_idle
     LIMIT 5000
  )
  DELETE FROM auth.sessions s
   USING idle
   WHERE s.id = idle.id;
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  DELETE FROM public.user_devices d
   WHERE NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = d.session_id);

  RETURN v_ended;
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────

-- Supabase grants EXECUTE on new public functions to anon, authenticated and
-- service_role by default; take all of it back, then give each function to
-- whom it is for.
REVOKE ALL ON FUNCTION public.fn_current_session_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_touch_device(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_list_my_devices() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_sign_out_device(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_sign_out_other_devices() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_can_sign_out_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_admin_sign_out_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_cleanup_idle_sessions(interval) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.fn_touch_device(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_my_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sign_out_device(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sign_out_other_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_sign_out_user(uuid) TO authenticated;
-- fn_current_session_id and fn_can_sign_out_user are only called inside the
-- functions above, which run as their owner; fn_cleanup_idle_sessions only by
-- pg_cron, which runs as that same owner. Nobody else executes them.

COMMIT;

-- ── The schedule ─────────────────────────────────────────────────────────────
-- Daily at 03:17 WIB (20:17 UTC), off the hour. Outside the transaction, as in
-- 20260920110000_ai_insights.sql: cron jobs do not roll back cleanly, and a
-- failure here must not undo the rest. pg_cron is already installed by that
-- migration; where it is not, the sweep is simply not scheduled.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE NOTICE 'pg_cron is not installed: idle-session cleanup is not scheduled';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auth-idle-session-cleanup') THEN
    PERFORM cron.unschedule('auth-idle-session-cleanup');
  END IF;
  PERFORM cron.schedule(
    'auth-idle-session-cleanup',
    '17 20 * * *',
    $job$ SELECT public.fn_cleanup_idle_sessions(); $job$
  );
END $$;

NOTIFY pgrst, 'reload schema';
