-- ============================================================
-- Record scope: the third dimension of the permission matrix.
--
-- The matrix answered "may this role do X on module M" (Lihat / Buat / Ubah /
-- Hapus). Sales Mission then asked a second question on every record-bound
-- action that the matrix never showed: is this person the sales utama or the
-- creator of the mission, the owner of the prospect, or "admin" (Ubah on
-- Pengaturan mission)? An Admin with Ubah on Mission was still refused on any
-- mission they were not on. The screen said one thing, the app did another.
--
-- HubSpot (View/Edit/Delete × Everything/Team/Owned) and Salesforce (object
-- CRUD + role hierarchy over record ownership) both keep the action and the
-- reach as two settings on one page. This column is the reach.
--
--   own  — records the person owns
--   team — own, plus records owned by anyone below them in the reports_to chain
--   all  — every record of the tenant
--
-- Who owns what (the app and the help panel use these exact definitions):
--   mission        sales utama (PRIMARY assignment) and created_by
--   visit report   the mission's sales utama (its author)
--   prospect       owner_id; an unowned prospect is inside everyone's "own"
--
-- Scope governs Ubah, Hapus, and the record-bound actions that are neither a
-- new record nor an edit: writing the visit report, pushing the lead, managing
-- the team, cancelling, requesting clarification, assigning a prospect. Lihat
-- stays tenant-wide in Sales Mission: missions are a shared calendar.
--
-- LeadEngine enforces no record ownership, so its rows are set to 'all', which
-- describes today, and its matrix does not draw the column.
-- ============================================================

BEGIN;

-- ── Step 1: the column ──────────────────────────────────────
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS record_scope text NOT NULL DEFAULT 'own';

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_record_scope_check;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_record_scope_check
  CHECK (record_scope IN ('own', 'team', 'all'));

COMMENT ON COLUMN public.role_permissions.record_scope IS
  'Reach of Ubah/Hapus and record-bound actions in Sales Mission: own (mission = sales utama + creator; report = sales utama; prospect = owner, unowned = everyone), team (own + profiles.reports_to chain), all. Inert outside Sales Mission.';

-- ── Step 2: LeadEngine modules describe today: no ownership, so 'all' ─
-- The pattern escapes the underscores, so the parent `sales_mission` row is
-- a LeadEngine-side app gate here and gets 'all' as well; the cascade in the
-- matrix UI never stores a scope on it.
UPDATE public.role_permissions
SET record_scope = 'all'
WHERE module_id NOT LIKE 'sales\_mission\_%';

-- ── Step 3: Sales Mission sub-modules, by role, so that nobody loses a
-- right they hold today. Until now only a super admin could touch a mission
-- they were not on; Admin and Executive gain that reach on purpose (this is
-- the request that prompted the column). Leader reaches its own chain.
UPDATE public.role_permissions rp
SET record_scope = CASE r.name
  WHEN 'Super Admin' THEN 'all'
  WHEN 'Admin'       THEN 'all'
  WHEN 'Executive'   THEN 'all'
  WHEN 'Leader'      THEN 'team'
  ELSE 'own'
END
FROM public.roles r
WHERE rp.role_id = r.id
  AND rp.module_id LIKE 'sales\_mission\_%';

UPDATE public.role_permissions
SET record_scope = CASE user_type
  WHEN 'super_admin' THEN 'all'
  WHEN 'admin'       THEN 'all'
  WHEN 'executive'   THEN 'all'
  WHEN 'leader'      THEN 'team'
  ELSE 'own'
END
WHERE role_id IS NULL
  AND module_id LIKE 'sales\_mission\_%';

-- ── Step 4: "edit a sent report whenever" and "request clarification" move
-- from Pengaturan mission → Ubah to Laporan kunjungan → Ubah (within scope).
-- Whoever is an admin today keeps both buttons: grant the column the rule now
-- reads, in every company where they hold the old one.
UPDATE public.role_permissions target
SET can_update = true,
    can_read = CASE WHEN target.can_read = 'none' THEN 'company' ELSE target.can_read END
FROM public.role_permissions src
WHERE src.module_id = 'sales_mission_settings'
  AND src.can_update = true
  AND target.module_id = 'sales_mission_result'
  AND target.company_id = src.company_id
  AND (
    (target.role_id IS NOT NULL AND target.role_id = src.role_id)
    OR (target.role_id IS NULL AND src.role_id IS NULL AND target.user_type = src.user_type)
  );

-- ── Step 5: the person's own subordinate chain ──────────────
--
-- DEFINER because it reads other people's reports_to, which row security
-- does not open; no argument, so nobody can enumerate someone else's chain.
-- UNION rather than UNION ALL and a depth cap: a reports_to loop (A→B→A,
-- which the Users screen does not forbid) then ends instead of hanging, which
-- is what the older public.fn_get_subordinate_ids(uuid) does.
CREATE OR REPLACE FUNCTION sales_mission.fn_my_subordinate_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT p.id, 1 AS depth
    FROM public.profiles p
    WHERE p.reports_to = auth.uid()
      AND p.id <> auth.uid()
    UNION
    SELECT p.id, c.depth + 1
    FROM public.profiles p
    JOIN chain c ON p.reports_to = c.id
    WHERE c.depth < 10
      AND p.id <> auth.uid()
  )
  SELECT DISTINCT id FROM chain;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_my_subordinate_ids() FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_my_subordinate_ids() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
