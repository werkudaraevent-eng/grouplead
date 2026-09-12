-- Sales Mission foundation tables.
-- Uses shared Supabase Auth and tenant tables, but owns mission data here.
-- Every business row is scoped by internal tenant company_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sales_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_company_id uuid,
  client_company_name_snapshot text NOT NULL,
  mission_type text NOT NULL DEFAULT 'Meeting',
  status text NOT NULL DEFAULT 'DRAFT',
  objective text,
  location text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sales_missions_status_check CHECK (status IN (
    'DRAFT', 'SCHEDULED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS',
    'COMPLETED', 'CANCELLED', 'RESCHEDULE_REQUESTED', 'REJECTED'
  )),
  CONSTRAINT sales_missions_schedule_check CHECK (
    scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end > scheduled_start
  )
);

CREATE INDEX IF NOT EXISTS sales_missions_company_status_idx
  ON public.sales_missions(company_id, status);
CREATE INDEX IF NOT EXISTS sales_missions_company_schedule_idx
  ON public.sales_missions(company_id, scheduled_start);

CREATE TABLE IF NOT EXISTS public.sales_mission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.sales_missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assignment_role text NOT NULL,
  response text NOT NULL DEFAULT 'PENDING',
  response_note text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sales_mission_assignments_role_check CHECK (assignment_role IN ('PRIMARY', 'SUPPORTING')),
  CONSTRAINT sales_mission_assignments_response_check CHECK (response IN ('PENDING', 'ACCEPTED', 'REJECTED', 'RESCHEDULE_REQUESTED')),
  CONSTRAINT sales_mission_assignments_unique_user UNIQUE (mission_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_mission_one_primary_idx
  ON public.sales_mission_assignments(mission_id)
  WHERE assignment_role = 'PRIMARY';
CREATE INDEX IF NOT EXISTS sales_mission_assignments_user_idx
  ON public.sales_mission_assignments(company_id, user_id, response);

CREATE TABLE IF NOT EXISTS public.sales_mission_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.sales_missions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS sales_mission_status_history_idx
  ON public.sales_mission_status_history(mission_id, created_at);

ALTER TABLE public.sales_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_mission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_mission_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sales_mission_user_has_company_access(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members AS member
    WHERE member.company_id = target_company_id
      AND member.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND lower(replace(coalesce(profile.role, ''), ' ', '_')) = 'super_admin'
  );
$$;

CREATE POLICY sales_missions_select ON public.sales_missions
  FOR SELECT USING (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_missions_insert ON public.sales_missions
  FOR INSERT WITH CHECK (
    public.sales_mission_user_has_company_access(company_id)
    AND created_by = auth.uid()
  );
CREATE POLICY sales_missions_update ON public.sales_missions
  FOR UPDATE USING (public.sales_mission_user_has_company_access(company_id))
  WITH CHECK (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_missions_delete ON public.sales_missions
  FOR DELETE USING (public.sales_mission_user_has_company_access(company_id));

CREATE POLICY sales_mission_assignments_select ON public.sales_mission_assignments
  FOR SELECT USING (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_mission_assignments_insert ON public.sales_mission_assignments
  FOR INSERT WITH CHECK (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_mission_assignments_update ON public.sales_mission_assignments
  FOR UPDATE USING (public.sales_mission_user_has_company_access(company_id))
  WITH CHECK (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_mission_assignments_delete ON public.sales_mission_assignments
  FOR DELETE USING (public.sales_mission_user_has_company_access(company_id));

CREATE POLICY sales_mission_status_history_select ON public.sales_mission_status_history
  FOR SELECT USING (public.sales_mission_user_has_company_access(company_id));
CREATE POLICY sales_mission_status_history_insert ON public.sales_mission_status_history
  FOR INSERT WITH CHECK (
    public.sales_mission_user_has_company_access(company_id)
    AND changed_by = auth.uid()
  );

REVOKE ALL ON FUNCTION public.sales_mission_user_has_company_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_mission_user_has_company_access(uuid) TO authenticated;

COMMIT;
