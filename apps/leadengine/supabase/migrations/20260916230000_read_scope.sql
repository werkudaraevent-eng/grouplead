-- ============================================================
-- Read scope: what a role can SEE, beside what it can change.
--
-- record_scope (20260916220000) bounds Ubah/Hapus and the record-bound
-- actions. Reading stayed unit-wide, and the matrix then said "Sendiri" to
-- an admin who could still see every colleague's mission. HubSpot keeps two
-- reaches per object, View and Edit, each Everything / Team / Owned; so
-- does this column.
--
--   read_scope  own  — records the person owns, plus missions they are
--                      assigned to (a supporting sales must see the visit
--                      they are on) and prospects nobody holds
--               team — own, plus records owned by anyone below them in the
--                      reports_to chain
--               all  — every record of the tenant (today's behaviour)
--
-- Enforced by row security, not by the app: every read path — lists, the
-- paged RPCs, exports, the KPI screen, a typed URL — answers to the same
-- policy. A row you cannot see does not exist for you. Write reach can
-- never exceed read reach (CHECK below): nobody edits what they cannot see.
--
-- Availability stays whole: scheduling a visit still needs a colleague's
-- busy hours to avoid a clash, so schedule blocks are read through a
-- definer function that returns times, not records.
-- ============================================================

BEGIN;

-- ── Step 1: the column, defaulting to today's behaviour ────
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS read_scope text NOT NULL DEFAULT 'all';

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_read_scope_check;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_read_scope_check
  CHECK (read_scope IN ('own', 'team', 'all'));

-- Ubah/Hapus reach within Lihat reach: own < team < all.
ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_write_within_read;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_write_within_read
  CHECK (
    (CASE record_scope WHEN 'own' THEN 0 WHEN 'team' THEN 1 ELSE 2 END)
    <= (CASE read_scope WHEN 'own' THEN 0 WHEN 'team' THEN 1 ELSE 2 END)
  );

COMMENT ON COLUMN public.role_permissions.read_scope IS
  'Whose records Lihat reaches in Sales Mission: own (owner, or assigned, or unowned prospect), team (own + reports_to chain), all. Enforced by RLS on missions, visit_reports, prospects. Inert outside Sales Mission.';

-- ── Step 2: the signed-in person's read scope for a module ─
--
-- Mirrors getSalesMissionAccess + loadPermissionAcross: super admin reaches
-- everything; a role answers for itself (role_id), the legacy user_type
-- row only for a profile with no role; the holding's row first, then the
-- person's own units oldest first; no row means unrestricted.
CREATE OR REPLACE FUNCTION sales_mission.fn_my_read_scope(p_module text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id, p.role_id, lower(replace(coalesce(p.role, ''), ' ', '_')) AS role_slug
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ),
  first_membership AS (
    SELECT cm.user_type
    FROM public.company_members cm, me
    WHERE cm.user_id = me.id
    ORDER BY cm.created_at
    LIMIT 1
  ),
  scopes AS (
    SELECT c.id AS company_id, 0 AS ord
    FROM public.companies c
    WHERE c.is_holding = true
    ORDER BY c.created_at
    LIMIT 1
  ),
  scopes_all AS (
    SELECT company_id, ord FROM scopes
    UNION ALL
    SELECT cm.company_id, 1 + (row_number() OVER (ORDER BY cm.created_at))::int
    FROM public.company_members cm, me
    WHERE cm.user_id = me.id
  ),
  matched AS (
    SELECT rp.read_scope, s.ord
    FROM scopes_all s
    JOIN public.role_permissions rp
      ON rp.company_id = s.company_id AND rp.module_id = p_module
    CROSS JOIN me
    WHERE (me.role_id IS NOT NULL AND rp.role_id = me.role_id)
       OR (me.role_id IS NULL AND rp.role_id IS NULL
           AND rp.user_type = coalesce((SELECT user_type FROM first_membership), me.role_slug))
    ORDER BY s.ord
    LIMIT 1
  )
  SELECT CASE
    WHEN (SELECT role_slug FROM me) = 'super_admin' THEN 'all'
    ELSE coalesce((SELECT read_scope FROM matched), 'all')
  END;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_my_read_scope(text) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_my_read_scope(text) TO authenticated;

-- The owner ids a module's Lihat reaches: NULL means no restriction.
CREATE OR REPLACE FUNCTION sales_mission.fn_visible_owner_ids(p_module text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE sales_mission.fn_my_read_scope(p_module)
    WHEN 'own'  THEN ARRAY[auth.uid()]
    WHEN 'team' THEN ARRAY[auth.uid()]
                     || coalesce((SELECT array_agg(s) FROM sales_mission.fn_my_subordinate_ids() AS s), ARRAY[]::uuid[])
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_visible_owner_ids(text) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_visible_owner_ids(text) TO authenticated;

-- ── Step 3: row security reads the scope ───────────────────
--
-- `(SELECT fn(...))::uuid[]` rather than a bare call: the planner then
-- evaluates the scope once per statement as an init plan instead of once
-- per row, the same trick Supabase documents for auth.uid(). The cast makes
-- `= ANY (...)` read the array form, not the subquery form.

DROP POLICY IF EXISTS missions_select ON sales_mission.missions;
CREATE POLICY missions_select ON sales_mission.missions
  FOR SELECT USING (
    sales_mission.user_has_company_access(company_id)
    AND (
      (SELECT sales_mission.fn_visible_owner_ids('sales_mission_mission')) IS NULL
      OR created_by = ANY ((SELECT sales_mission.fn_visible_owner_ids('sales_mission_mission'))::uuid[])
      OR EXISTS (
        SELECT 1 FROM sales_mission.assignments a
        WHERE a.mission_id = missions.id
          AND (
            a.user_id = auth.uid()
            OR (a.assignment_role = 'PRIMARY'
                AND a.user_id = ANY ((SELECT sales_mission.fn_visible_owner_ids('sales_mission_mission'))::uuid[]))
          )
      )
    )
  );

-- A report is visible when its mission is (the missions policy applies
-- inside the subquery) and, when Laporan kunjungan has its own narrower
-- reach, when its author is inside that reach or the person is on the team.
DROP POLICY IF EXISTS visit_reports_select ON sales_mission.visit_reports;
CREATE POLICY visit_reports_select ON sales_mission.visit_reports
  FOR SELECT USING (
    sales_mission.user_has_company_access(company_id)
    AND EXISTS (SELECT 1 FROM sales_mission.missions m WHERE m.id = visit_reports.mission_id)
    AND (
      (SELECT sales_mission.fn_visible_owner_ids('sales_mission_result')) IS NULL
      OR EXISTS (
        SELECT 1 FROM sales_mission.assignments a
        WHERE a.mission_id = visit_reports.mission_id
          AND (
            a.user_id = auth.uid()
            OR (a.assignment_role = 'PRIMARY'
                AND a.user_id = ANY ((SELECT sales_mission.fn_visible_owner_ids('sales_mission_result'))::uuid[]))
          )
      )
    )
  );

DROP POLICY IF EXISTS prospects_select ON sales_mission.prospects;
CREATE POLICY prospects_select ON sales_mission.prospects
  FOR SELECT USING (
    sales_mission.user_has_company_access(company_id)
    AND (
      (SELECT sales_mission.fn_visible_owner_ids('sales_mission_prospect')) IS NULL
      OR owner_id IS NULL
      OR owner_id = ANY ((SELECT sales_mission.fn_visible_owner_ids('sales_mission_prospect'))::uuid[])
    )
  );

-- ── Step 4: availability without the records ───────────────
--
-- The schedule picker and the server-side clash check need every
-- teammate's busy hours, whoever owns the visit. Times and the place,
-- never the client or the purpose, for the people asked about (NULL = all).
CREATE OR REPLACE FUNCTION sales_mission.fn_schedule_blocks(
  p_company_id uuid,
  p_user_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  user_id uuid,
  mission_id uuid,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  location text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
  SELECT a.user_id, m.id, m.scheduled_start, m.scheduled_end, m.location
  FROM sales_mission.missions m
  JOIN sales_mission.assignments a ON a.mission_id = m.id
  WHERE sales_mission.user_has_company_access(p_company_id)
    AND m.company_id = p_company_id
    AND m.deleted_at IS NULL
    AND (p_user_ids IS NULL OR a.user_id = ANY (p_user_ids))
    AND a.response <> 'REJECTED'
    AND m.status NOT IN ('CANCELLED', 'REJECTED')
    AND m.scheduled_start IS NOT NULL
    AND m.scheduled_start < p_to
    AND coalesce(m.scheduled_end, m.scheduled_start + interval '1 hour') > p_from;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_schedule_blocks(uuid, uuid[], timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_schedule_blocks(uuid, uuid[], timestamptz, timestamptz) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
