-- ============================================================
-- Who can be put on a mission, for the whole group.
--
-- Sales Mission's tenant is the holding, but people belong to units:
-- company_members rows live under their own unit, and row security lets a
-- unit member see only their unit's rows. The people list read
-- company_members WHERE company_id = holding, so a unit member scheduling
-- a visit saw only whoever also sat under the holding — often just
-- themself — and could not put a colleague from another unit on the team.
--
-- This function lists every active member of any company in the group,
-- through a definer, for anyone who belongs to the group. It also answers
-- from the matrix who may lead a visit: the sales utama writes the report,
-- so a person can lead only when their role holds Laporan kunjungan →
-- Buat. Names, avatars and addresses only; nothing about the person's
-- records.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION sales_mission.fn_group_people()
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
  -- The matrix row that answers for each person and module: the holding's
  -- row first, then the person's own units; a role answers for itself, the
  -- legacy user_type row only for a profile with no role.
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
  WHERE sales_mission.user_has_company_access((SELECT id FROM holding))
    -- Someone the app itself refuses cannot answer an assignment.
    AND (
      pe.role_slug = 'super_admin'
      OR coalesce((SELECT x.can_read FROM perm x WHERE x.person_id = pe.id AND x.module_id = 'sales_mission' AND x.rn = 1), 'none') <> 'none'
    )
  ORDER BY pe.full_name;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_group_people() FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_group_people() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
