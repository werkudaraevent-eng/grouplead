-- ============================================================
-- A team calendar feed, next to the personal one.
--
-- "Kalender saya" serves the visits a person is on. A manager or an
-- admin also wants the team's schedule on their phone: every visit
-- their role may see. A feed link now carries a scope ('own' or
-- 'team'); one active link per person and scope.
--
-- The feed is fetched by a calendar server with no session, so row
-- security cannot decide what "the team" is. These three functions
-- answer the same questions as fn_my_read_scope / fn_my_subordinate_ids
-- / fn_visible_owner_ids for a given user id instead of auth.uid(), and
-- only the service role may call them.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.calendar_tokens
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'own';

ALTER TABLE sales_mission.calendar_tokens DROP CONSTRAINT IF EXISTS calendar_tokens_scope_check;
ALTER TABLE sales_mission.calendar_tokens ADD CONSTRAINT calendar_tokens_scope_check
  CHECK (scope IN ('own', 'team'));

CREATE INDEX IF NOT EXISTS calendar_tokens_user_scope_idx
  ON sales_mission.calendar_tokens(user_id, scope, created_at DESC);

CREATE OR REPLACE FUNCTION sales_mission.fn_read_scope_for(p_user uuid, p_module text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id, p.role_id, lower(replace(coalesce(p.role, ''), ' ', '_')) AS role_slug
    FROM public.profiles p
    WHERE p.id = p_user
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

CREATE OR REPLACE FUNCTION sales_mission.fn_subordinate_ids_for(p_user uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT p.id, 1 AS depth
    FROM public.profiles p
    WHERE p.reports_to = p_user
      AND p.id <> p_user
    UNION
    SELECT p.id, c.depth + 1
    FROM public.profiles p
    JOIN chain c ON p.reports_to = c.id
    WHERE c.depth < 10
      AND p.id <> p_user
  )
  SELECT DISTINCT id FROM chain;
$$;

-- NULL means unrestricted (read scope "all"), as fn_visible_owner_ids does.
CREATE OR REPLACE FUNCTION sales_mission.fn_visible_owner_ids_for(p_user uuid, p_module text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE sales_mission.fn_read_scope_for(p_user, p_module)
    WHEN 'own'  THEN ARRAY[p_user]
    WHEN 'team' THEN ARRAY[p_user]
                     || coalesce((SELECT array_agg(s) FROM sales_mission.fn_subordinate_ids_for(p_user) AS s), ARRAY[]::uuid[])
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_read_scope_for(uuid, text) FROM public, authenticated, anon;
REVOKE ALL ON FUNCTION sales_mission.fn_subordinate_ids_for(uuid) FROM public, authenticated, anon;
REVOKE ALL ON FUNCTION sales_mission.fn_visible_owner_ids_for(uuid, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION sales_mission.fn_read_scope_for(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION sales_mission.fn_subordinate_ids_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION sales_mission.fn_visible_owner_ids_for(uuid, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
