-- ============================================================
-- Sales Mission is now Sales Activity, and a "mission" is an "aktivitas"
-- wherever a person reads it. The schema, tables, functions and module
-- ids keep their names (that is a later, separate migration); this one
-- changes the two pieces of user-facing text the database itself holds.
-- ============================================================

BEGIN;

-- The core field label is data, and it is the CSV column header. Only the
-- untouched default is renamed; a label an admin already edited is theirs.
UPDATE sales_mission.form_fields
SET label = 'Jenis aktivitas'
WHERE reporting_key = 'mission_type'
  AND label = 'Jenis mission';

-- The one error message raised from inside the database.
CREATE OR REPLACE FUNCTION sales_mission.enforce_supporting_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  IF NEW.assignment_role <> 'SUPPORTING' THEN
    RETURN NEW;
  END IF;

  SELECT max_supporting_per_mission INTO cap
  FROM sales_mission.mission_settings
  WHERE company_id = NEW.company_id;

  -- No settings row yet means the tenant has never configured anything, so the
  -- documented default applies rather than "unlimited".
  cap := COALESCE(cap, 2);

  SELECT count(*) INTO current_count
  FROM sales_mission.assignments
  WHERE mission_id = NEW.mission_id
    AND assignment_role = 'SUPPORTING';

  IF current_count >= cap THEN
    RAISE EXCEPTION 'Aktivitas sudah mencapai batas % sales pendukung', cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
