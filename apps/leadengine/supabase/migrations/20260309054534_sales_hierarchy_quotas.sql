-- TASK 1: HIERARCHY COLUMNS ON PROFILES

ALTER TABLE public.profiles
  ADD COLUMN role_tier integer DEFAULT 1;

ALTER TABLE public.profiles
  ADD COLUMN reports_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN business_unit text;

CREATE INDEX idx_profiles_reports_to ON public.profiles(reports_to);
CREATE INDEX idx_profiles_business_unit ON public.profiles(business_unit);

UPDATE public.profiles SET role_tier = CASE role
  WHEN 'sales'       THEN 1
  WHEN 'finance'     THEN 1
  WHEN 'bu_manager'  THEN 3
  WHEN 'director'    THEN 4
  WHEN 'super_admin' THEN 5
  ELSE 1
END;

UPDATE public.profiles
SET business_unit = department
WHERE department IN ('WNW', 'WNS', 'UK', 'TEP', 'CREATIVE');

-- TASK 2: SALES TARGETS TABLE

CREATE TABLE public.sales_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_amount numeric NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT valid_period CHECK (period_end > period_start)
);

CREATE INDEX idx_sales_targets_profile ON public.sales_targets(profile_id);
CREATE INDEX idx_sales_targets_period ON public.sales_targets(period_start, period_end);

CREATE OR REPLACE FUNCTION public.fn_update_sales_targets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_sales_targets_timestamp();

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_targets_select_own" ON public.sales_targets FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "sales_targets_select_reports" ON public.sales_targets FOR SELECT
  USING (
    EXISTS (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM public.profiles WHERE reports_to = auth.uid()
        UNION ALL
        SELECT p.id FROM public.profiles p
        INNER JOIN subordinates s ON p.reports_to = s.id
      )
      SELECT 1 FROM subordinates WHERE subordinates.id = sales_targets.profile_id
    )
  );

CREATE POLICY "sales_targets_select_admin" ON public.sales_targets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "sales_targets_manage" ON public.sales_targets
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM public.profiles WHERE reports_to = auth.uid()
        UNION ALL
        SELECT p.id FROM public.profiles p
        INNER JOIN subordinates s ON p.reports_to = s.id
      )
      SELECT 1 FROM subordinates WHERE subordinates.id = sales_targets.profile_id
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      WITH RECURSIVE subordinates AS (
        SELECT id FROM public.profiles WHERE reports_to = auth.uid()
        UNION ALL
        SELECT p.id FROM public.profiles p
        INNER JOIN subordinates s ON p.reports_to = s.id
      )
      SELECT 1 FROM subordinates WHERE subordinates.id = sales_targets.profile_id
    )
  );

-- TASK 3: LEADS TABLE — ADD UUID FK COLUMNS + HIERARCHY RLS

ALTER TABLE public.leads
  ADD COLUMN pic_sales_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN account_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_pic_sales_id ON public.leads(pic_sales_id);
CREATE INDEX idx_leads_account_manager_id ON public.leads(account_manager_id);

CREATE OR REPLACE FUNCTION public.fn_get_subordinate_ids(manager_id uuid)
RETURNS SETOF uuid AS $$
  WITH RECURSIVE subordinates AS (
    SELECT id FROM public.profiles WHERE reports_to = manager_id
    UNION ALL
    SELECT p.id FROM public.profiles p
    INNER JOIN subordinates s ON p.reports_to = s.id
  )
  SELECT id FROM subordinates;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;

CREATE POLICY "leads_select_policy" ON public.leads FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR pic_sales_id = auth.uid()
    OR account_manager_id = auth.uid()
    OR pic_sales_id IN (SELECT public.fn_get_subordinate_ids(auth.uid()))
    OR account_manager_id IN (SELECT public.fn_get_subordinate_ids(auth.uid()))
  );;
