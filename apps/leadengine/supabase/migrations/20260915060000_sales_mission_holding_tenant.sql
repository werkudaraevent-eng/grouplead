-- Sales Mission belongs to the holding.
--
-- Missions are a group activity: one calendar, one board, one list for the
-- whole of Werkudara, whoever's payroll the rep is on. Scoping the app to
-- whichever company_members row happened to match sent a rep's visits to one
-- unit's calendar and an admin's to another's, and a person in two units saw
-- a different Sales Mission depending on a cookie. From here every row is the
-- holding company's, and anyone who belongs to any unit of the group may act
-- in it.

BEGIN;

-- Who the holding is, readable by any signed-in person. companies is behind
-- RLS that only shows a person their own units, so a rep at a subsidiary
-- could not otherwise find out the holding's id or name.
CREATE OR REPLACE FUNCTION sales_mission.holding_company()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug
  FROM public.companies AS c
  WHERE c.is_holding = true
  ORDER BY c.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION sales_mission.holding_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sales_mission.holding_company() TO authenticated;

-- Row security: a member of the target company, as before, or, when the
-- target is the holding, a member of any company in the group.
CREATE OR REPLACE FUNCTION sales_mission.user_has_company_access(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members AS member
    WHERE member.user_id = auth.uid()
      AND (
        member.company_id = target_company_id
        OR EXISTS (
          SELECT 1 FROM public.companies AS c
          WHERE c.id = target_company_id AND c.is_holding = true
        )
      )
  )
$$;

-- Move what already exists under the holding. Configuration tables
-- (form_fields, mission_settings, board_tokens) stay per company: the
-- holding's own rows are the ones in use from now on, and a unit's rows are
-- simply no longer read. Audit triggers are paused for the move so the log
-- does not fill with one "edited" row per record.
DO $$
DECLARE
  holding_id uuid;
  t record;
BEGIN
  SELECT id INTO holding_id FROM public.companies WHERE is_holding = true ORDER BY created_at LIMIT 1;
  IF holding_id IS NULL THEN
    RAISE EXCEPTION 'No holding company (companies.is_holding = true) to scope Sales Mission to';
  END IF;

  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'sales_mission'
      AND column_name = 'company_id'
      AND table_name NOT IN ('form_fields', 'mission_settings', 'board_tokens')
  LOOP
    EXECUTE format('ALTER TABLE sales_mission.%I DISABLE TRIGGER USER', t.table_name);
    EXECUTE format('UPDATE sales_mission.%I SET company_id = $1 WHERE company_id <> $1', t.table_name) USING holding_id;
    EXECUTE format('ALTER TABLE sales_mission.%I ENABLE TRIGGER USER', t.table_name);
  END LOOP;
END $$;

COMMIT;
