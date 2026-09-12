-- Mission team joining and per-tenant operational settings.
--
-- Sales who have a free slot can join a colleague's mission to learn, to back
-- them up, or to widen coverage. Two guards make that safe rather than chaotic:
-- the primary keeps control of the room they are accountable for, and a cap
-- stops a client who was promised two people meeting a crowd.

BEGIN;

-- A primary preparing a delicate negotiation can close the mission to joiners.
ALTER TABLE sales_mission.missions
  ADD COLUMN IF NOT EXISTS allow_join boolean NOT NULL DEFAULT true;

-- One row per tenant. Defaults match the MVP spec §7.
CREATE TABLE IF NOT EXISTS sales_mission.mission_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,

  conflict_check_enabled boolean NOT NULL DEFAULT true,
  default_travel_buffer_minutes integer NOT NULL DEFAULT 30,
  allow_same_location_back_to_back boolean NOT NULL DEFAULT false,

  -- Supporting sales allowed per mission, excluding the primary.
  max_supporting_per_mission integer NOT NULL DEFAULT 2,

  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT mission_settings_buffer_check
    CHECK (default_travel_buffer_minutes >= 0 AND default_travel_buffer_minutes <= 480),
  CONSTRAINT mission_settings_max_supporting_check
    CHECK (max_supporting_per_mission >= 0 AND max_supporting_per_mission <= 20)
);

ALTER TABLE sales_mission.mission_settings ENABLE ROW LEVEL SECURITY;

-- Everyone in the tenant reads the settings — the join rules are applied in the
-- UI, so the client needs to know the buffer and the cap.
CREATE POLICY mission_settings_select ON sales_mission.mission_settings
  FOR SELECT USING (sales_mission.user_has_company_access(company_id));
CREATE POLICY mission_settings_insert ON sales_mission.mission_settings
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));
CREATE POLICY mission_settings_update ON sales_mission.mission_settings
  FOR UPDATE USING (sales_mission.user_has_company_access(company_id))
  WITH CHECK (sales_mission.user_has_company_access(company_id));

-- Joining is an assignment insert, and RLS already scopes that by tenant. The
-- rule that must not be bypassed is that a joiner never becomes primary: the
-- existing one-primary index enforces uniqueness, and this trigger stops a
-- self-service insert from claiming the role at all.
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
    RAISE EXCEPTION 'Mission sudah mencapai batas % sales pendukung', cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_supporting_cap ON sales_mission.assignments;
CREATE TRIGGER enforce_supporting_cap
  BEFORE INSERT ON sales_mission.assignments
  FOR EACH ROW EXECUTE FUNCTION sales_mission.enforce_supporting_cap();

REVOKE ALL ON FUNCTION sales_mission.enforce_supporting_cap() FROM PUBLIC;

COMMIT;
