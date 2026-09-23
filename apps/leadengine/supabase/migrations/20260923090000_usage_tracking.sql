-- ============================================================
-- Pemakaian: who opens Sales Activity, when, and which pages.
--
-- The unit's admin could see every write (Riwayat perubahan) but not whether
-- anyone opens the app at all. This is the lightweight shape Salesforce's
-- Lightning Usage App, Notion's workspace analytics and Microsoft 365's
-- active-users report share: one row per person per day (first and last
-- seen, how many pages they opened, the last one), and one counter per page
-- per day. No event stream, no timeline of clicks: a day row answers "is this
-- person using it", a page counter answers "which screens earn their place",
-- and neither can be replayed into a trail of what someone did.
--
-- Paths arrive normalised by the app (ids replaced by :id, no query string,
-- see lib/usage/usage-path.ts), so no record id ever lands here. Nothing
-- typed and no location is recorded.
--
-- Writes go through record_usage(), SECURITY INVOKER so the policies below
-- apply: a person writes only their own day row, inside their own company.
-- Reads are open to the unit like audit_log's; the page (Pengaturan →
-- Pemakaian) narrows them to settings admins. No delete policy: a person
-- cannot erase their own attendance, and the tables are small (one row per
-- person-day), so there is no sweep.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.usage_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The day in WIB, as the app's calendar counts days.
  day date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- Pages opened that day. A heartbeat (still on the page, five minutes on)
  -- moves last_seen_at and adds nothing here.
  views integer NOT NULL DEFAULT 1 CHECK (views >= 0),
  last_path text CHECK (last_path IS NULL OR (char_length(last_path) <= 200 AND last_path LIKE '/workspace%')),
  CONSTRAINT usage_days_person_day UNIQUE (company_id, user_id, day)
);

COMMENT ON TABLE sales_mission.usage_days IS
  'Pemakaian: one row per person per WIB day (first/last seen, pages opened, last page). Written by record_usage().';

-- The admin page reads a window of days for the whole unit.
CREATE INDEX IF NOT EXISTS usage_days_company_day ON sales_mission.usage_days (company_id, day);

CREATE TABLE IF NOT EXISTS sales_mission.usage_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day date NOT NULL,
  -- Normalised: /workspace/activities/:id, never a record's id.
  path text NOT NULL CHECK (char_length(path) <= 200 AND path LIKE '/workspace%'),
  views integer NOT NULL DEFAULT 1 CHECK (views >= 0),
  -- Leads with (company_id, day), so it also serves the window read; a
  -- second index on those two columns would only slow every page open.
  CONSTRAINT usage_pages_page_day UNIQUE (company_id, day, path)
);

COMMENT ON TABLE sales_mission.usage_pages IS
  'Pemakaian: pages opened per WIB day for the unit, by normalised path. Written by record_usage().';

ALTER TABLE sales_mission.usage_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_mission.usage_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_days_select ON sales_mission.usage_days;
CREATE POLICY usage_days_select ON sales_mission.usage_days
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS usage_days_insert ON sales_mission.usage_days;
CREATE POLICY usage_days_insert ON sales_mission.usage_days
  FOR INSERT WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS usage_days_update ON sales_mission.usage_days;
CREATE POLICY usage_days_update ON sales_mission.usage_days
  FOR UPDATE USING (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id))
  WITH CHECK (user_id = auth.uid() AND sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS usage_pages_select ON sales_mission.usage_pages;
CREATE POLICY usage_pages_select ON sales_mission.usage_pages
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));

-- A counter the whole unit adds to; it names no one.
DROP POLICY IF EXISTS usage_pages_insert ON sales_mission.usage_pages;
CREATE POLICY usage_pages_insert ON sales_mission.usage_pages
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));

DROP POLICY IF EXISTS usage_pages_update ON sales_mission.usage_pages;
CREATE POLICY usage_pages_update ON sales_mission.usage_pages
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

GRANT SELECT, INSERT, UPDATE ON sales_mission.usage_days TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sales_mission.usage_pages TO authenticated;

-- One call per page open (p_views = 1, or the count of a batched burst) or
-- per heartbeat (p_views = 0: seen, nothing opened). Atomic upserts, so two
-- tabs never lose a count to a read-then-write race. The day comes from the
-- app (WIB); one day either side of the database's own WIB day is accepted
-- for a request that crosses midnight, nothing further.
CREATE OR REPLACE FUNCTION sales_mission.record_usage(
  p_company_id uuid,
  p_path text,
  p_day date,
  p_views integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = sales_mission, public
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
  IF p_path IS NULL OR char_length(p_path) > 200 OR p_path NOT LIKE '/workspace%' THEN
    RAISE EXCEPTION 'record_usage: path not accepted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO sales_mission.usage_days AS d (company_id, user_id, day, first_seen_at, last_seen_at, views, last_path)
  VALUES (p_company_id, v_user, p_day, now(), now(), v_views, p_path)
  ON CONFLICT (company_id, user_id, day) DO UPDATE
    SET views = d.views + EXCLUDED.views,
        last_seen_at = greatest(d.last_seen_at, EXCLUDED.last_seen_at),
        last_path = EXCLUDED.last_path;

  IF v_views > 0 THEN
    INSERT INTO sales_mission.usage_pages AS pg (company_id, day, path, views)
    VALUES (p_company_id, p_day, p_path, v_views)
    ON CONFLICT (company_id, day, path) DO UPDATE
      SET views = pg.views + EXCLUDED.views;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION sales_mission.record_usage(uuid, text, date, integer) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.record_usage(uuid, text, date, integer) TO authenticated;

-- Each person's most recent day, however long ago, so "Terakhir aktif" is
-- right for someone last seen before the page's eight-week window and
-- "Belum pernah" means never. Invoker, so the select policy applies.
CREATE OR REPLACE FUNCTION sales_mission.usage_last_seen(p_company_id uuid)
RETURNS TABLE (user_id uuid, day date, last_seen_at timestamptz, last_path text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = sales_mission, public
AS $$
  SELECT DISTINCT ON (d.user_id) d.user_id, d.day, d.last_seen_at, d.last_path
  FROM sales_mission.usage_days AS d
  WHERE d.company_id = p_company_id
  ORDER BY d.user_id, d.day DESC;
$$;

REVOKE ALL ON FUNCTION sales_mission.usage_last_seen(uuid) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.usage_last_seen(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
