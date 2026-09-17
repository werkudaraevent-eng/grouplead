-- ============================================================
-- Two kinds of public link, one table.
--
-- A screen link opens the TV board. A calendar link opens a read-only month
-- calendar for management, in a browser, without a session. They are separate
-- links on purpose: handing a director the TV link would let them park it on a
-- screen, and handing a screen the calendar link would put a clickable page on
-- a wall. The kind is bound to the row, so neither link can be edited into the
-- other from the URL — the same reasoning as show_client_names.
--
-- Also: fn_group_people, split so the people list has one definition. The
-- public calendar has no session, so the "who can I filter by" list cannot be
-- read through a function that asks whether the caller belongs to the group.
-- fn_group_people_all is that list without the membership check, reachable by
-- service_role only; fn_group_people keeps its old name, signature and grant
-- and simply filters it.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.board_tokens
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'screen';

ALTER TABLE sales_mission.board_tokens
  DROP CONSTRAINT IF EXISTS board_tokens_kind_check;

ALTER TABLE sales_mission.board_tokens
  ADD CONSTRAINT board_tokens_kind_check CHECK (kind IN ('screen', 'calendar'));

COMMENT ON COLUMN sales_mission.board_tokens.kind IS
  'What this link opens: screen = the TV board at /board, calendar = the read-only month calendar at /jadwal. Bound at creation; a link of one kind is refused by the other route.';

CREATE INDEX IF NOT EXISTS board_tokens_company_kind_idx
  ON sales_mission.board_tokens (company_id, kind, created_at DESC);

-- The people list, without the membership check. Definer, and reachable only
-- by service_role: the public calendar reads it with no session, every other
-- caller goes through fn_group_people below.
CREATE OR REPLACE FUNCTION sales_mission.fn_group_people_all()
RETURNS TABLE (id uuid, full_name text, email text, avatar_url text, can_lead boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH holding AS (
    SELECT c.id FROM public.companies c WHERE c.is_holding = true ORDER BY c.created_at LIMIT 1
  ),
  people AS (
    SELECT DISTINCT ON (p.id)
      p.id, p.full_name, p.email, p.avatar_url, p.role_id,
      lower(replace(coalesce(p.role, ''), ' ', '_')) AS role_slug,
      (SELECT cm2.user_type FROM public.company_members cm2 WHERE cm2.user_id = p.id ORDER BY cm2.created_at LIMIT 1) AS user_type
    FROM public.profiles p
    JOIN public.company_members cm ON cm.user_id = p.id
    WHERE p.is_active = true
      AND p.full_name IS NOT NULL
      AND btrim(p.full_name) <> ''
    ORDER BY p.id
  ),
  perm AS (
    SELECT
      pe.id AS person_id,
      m.module_id,
      rp.can_read,
      rp.can_create,
      row_number() OVER (
        PARTITION BY pe.id, m.module_id
        ORDER BY CASE WHEN rp.company_id = (SELECT id FROM holding) THEN 0 ELSE 1 END, rp.company_id
      ) AS rn
    FROM people pe
    CROSS JOIN (VALUES ('sales_mission'), ('sales_mission_result')) AS m(module_id)
    JOIN public.role_permissions rp
      ON rp.module_id = m.module_id
     AND (
       (pe.role_id IS NOT NULL AND rp.role_id = pe.role_id)
       OR (pe.role_id IS NULL AND rp.role_id IS NULL AND rp.user_type = coalesce(pe.user_type, pe.role_slug))
     )
     AND (
       rp.company_id = (SELECT id FROM holding)
       OR rp.company_id IN (SELECT cm3.company_id FROM public.company_members cm3 WHERE cm3.user_id = pe.id)
     )
  )
  SELECT
    pe.id,
    pe.full_name,
    pe.email,
    pe.avatar_url,
    (
      pe.role_slug = 'super_admin'
      OR coalesce((SELECT x.can_create FROM perm x WHERE x.person_id = pe.id AND x.module_id = 'sales_mission_result' AND x.rn = 1), true)
    ) AS can_lead
  FROM people pe
  WHERE (
      pe.role_slug = 'super_admin'
      OR coalesce((SELECT x.can_read FROM perm x WHERE x.person_id = pe.id AND x.module_id = 'sales_mission' AND x.rn = 1), 'none') <> 'none'
    )
  ORDER BY pe.full_name;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_group_people_all() FROM public;
REVOKE ALL ON FUNCTION sales_mission.fn_group_people_all() FROM anon;
REVOKE ALL ON FUNCTION sales_mission.fn_group_people_all() FROM authenticated;
GRANT EXECUTE ON FUNCTION sales_mission.fn_group_people_all() TO service_role;

-- Same name, same signature, same grant as before: only the body changes, to
-- the list above plus the membership check it always had.
CREATE OR REPLACE FUNCTION sales_mission.fn_group_people()
RETURNS TABLE (id uuid, full_name text, email text, avatar_url text, can_lead boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.can_lead
  FROM sales_mission.fn_group_people_all() p
  WHERE sales_mission.user_has_company_access(
    (SELECT c.id FROM public.companies c WHERE c.is_holding = true ORDER BY c.created_at LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_group_people() FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_group_people() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
