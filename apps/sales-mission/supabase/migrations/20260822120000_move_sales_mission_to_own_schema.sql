-- Move Sales Mission tables out of `public` into a schema of their own.
--
-- LeadEngine and Sales Mission share one Supabase project (ADR-002). Sharing a
-- database is not the same as sharing a namespace: while mission tables sat in
-- `public` they lived among ~90 migrations of CRM tables, where a name
-- collision or an accidental cross-domain query is easy and nothing objects.
--
-- A dedicated schema is the cheap half of the isolation that a separate
-- database would have bought: it can be granted separately, it reads
-- unambiguously, and mission migrations stop touching the CRM namespace. It
-- costs none of the identity, join, or API surface a split database would.
--
-- Tables lose their now-redundant prefix on the way in — `sales_mission.missions`
-- rather than `sales_mission.sales_missions`.
--
-- This runs safely whether or not the foundation migration was already applied:
-- it always runs after it, so the tables exist in `public` either way.
--
-- MANUAL STEP: add `sales_mission` to Settings -> API -> Exposed schemas in the
-- Supabase dashboard, or PostgREST will not serve these tables and every query
-- returns "The schema must be one of the following".

BEGIN;

CREATE SCHEMA IF NOT EXISTS sales_mission;

-- Indexes, constraints, and RLS policies follow their table automatically.
ALTER TABLE public.sales_missions SET SCHEMA sales_mission;
ALTER TABLE public.sales_mission_assignments SET SCHEMA sales_mission;
ALTER TABLE public.sales_mission_status_history SET SCHEMA sales_mission;

ALTER TABLE sales_mission.sales_missions RENAME TO missions;
ALTER TABLE sales_mission.sales_mission_assignments RENAME TO assignments;
ALTER TABLE sales_mission.sales_mission_status_history RENAME TO status_history;

-- The access helper belongs to this domain too. It keeps `search_path = public`
-- because the identity tables it reads (company_members, profiles) stay there,
-- and it already qualifies them explicitly.
ALTER FUNCTION public.sales_mission_user_has_company_access(uuid) SET SCHEMA sales_mission;
ALTER FUNCTION sales_mission.sales_mission_user_has_company_access(uuid) RENAME TO user_has_company_access;

-- Policy names carried the old table prefix; keep them readable next to the
-- renamed tables.
ALTER POLICY sales_missions_select ON sales_mission.missions RENAME TO missions_select;
ALTER POLICY sales_missions_insert ON sales_mission.missions RENAME TO missions_insert;
ALTER POLICY sales_missions_update ON sales_mission.missions RENAME TO missions_update;
ALTER POLICY sales_missions_delete ON sales_mission.missions RENAME TO missions_delete;

ALTER POLICY sales_mission_assignments_select ON sales_mission.assignments RENAME TO assignments_select;
ALTER POLICY sales_mission_assignments_insert ON sales_mission.assignments RENAME TO assignments_insert;
ALTER POLICY sales_mission_assignments_update ON sales_mission.assignments RENAME TO assignments_update;
ALTER POLICY sales_mission_assignments_delete ON sales_mission.assignments RENAME TO assignments_delete;

ALTER POLICY sales_mission_status_history_select ON sales_mission.status_history RENAME TO status_history_select;
ALTER POLICY sales_mission_status_history_insert ON sales_mission.status_history RENAME TO status_history_insert;

-- A new schema inherits none of the grants Supabase pre-applies to `public`,
-- so every role that needs in must be named. `anon` is deliberately absent:
-- there is no anonymous access to mission data.
GRANT USAGE ON SCHEMA sales_mission TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales_mission TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA sales_mission TO service_role;

-- Tables added by later migrations should not have to repeat the grants above.
ALTER DEFAULT PRIVILEGES IN SCHEMA sales_mission
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales_mission
  GRANT ALL ON TABLES TO service_role;

REVOKE ALL ON FUNCTION sales_mission.user_has_company_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sales_mission.user_has_company_access(uuid) TO authenticated;

COMMIT;
