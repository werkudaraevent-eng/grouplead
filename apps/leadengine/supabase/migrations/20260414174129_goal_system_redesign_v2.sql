-- ============================================================
-- PHASE 1: Create new V2 tables
-- ============================================================

CREATE TABLE public.goals_v2 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly','quarterly','yearly')),
  target_amount numeric(18,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  attribution_basis text NOT NULL DEFAULT 'event_date'
    CHECK (attribution_basis IN ('event_date','closed_won_date')),
  monthly_cutoff_day int DEFAULT 25 CHECK (monthly_cutoff_day BETWEEN 1 AND 28),
  per_month_cutoffs jsonb,
  weighted_forecast_enabled boolean NOT NULL DEFAULT false,
  breakdown_config jsonb NOT NULL DEFAULT '[]',
  breakdown_targets jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX idx_goals_v2_company ON public.goals_v2 (company_id);
CREATE INDEX idx_goals_v2_active ON public.goals_v2 (company_id, is_active);

CREATE TABLE public.goal_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_field text NOT NULL,
  fallback_name text NOT NULL DEFAULT 'Lainnya',
  mappings jsonb NOT NULL DEFAULT '[]'
);

CREATE UNIQUE INDEX idx_goal_segments_company_name
  ON public.goal_segments (company_id, name);
CREATE INDEX idx_goal_segments_company ON public.goal_segments (company_id);

CREATE TABLE public.goal_user_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  goal_id uuid NOT NULL REFERENCES public.goals_v2(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_amount numeric(18,2) NOT NULL DEFAULT 0
    CHECK (target_amount >= 0),
  CONSTRAINT chk_period_range CHECK (period_start < period_end)
);

CREATE UNIQUE INDEX idx_goal_user_targets_unique
  ON public.goal_user_targets (goal_id, user_id, period_start);
CREATE INDEX idx_goal_user_targets_goal ON public.goal_user_targets (goal_id);
CREATE INDEX idx_goal_user_targets_company ON public.goal_user_targets (company_id);

CREATE TABLE public.goal_settings_v2 (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  reporting_critical_fields text[] NOT NULL
    DEFAULT '{actual_value,event_date_start,event_date_end,project_name,company_id,pic_sales_id}',
  auto_lock_enabled boolean NOT NULL DEFAULT false,
  auto_lock_day_offset int DEFAULT 5,
  stage_weights jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_goal_settings_v2_company ON public.goal_settings_v2 (company_id);

-- ============================================================
-- PHASE 2: Add company_id to contacts and client_companies
-- ============================================================

ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- ============================================================
-- PHASE 3: Backfill company_id
-- ============================================================

-- Backfill client_companies.company_id from most common lead company_id
UPDATE public.client_companies cc
SET company_id = sub.most_common_company
FROM (
  SELECT l.client_company_id, l.company_id AS most_common_company
  FROM (
    SELECT client_company_id, company_id,
           ROW_NUMBER() OVER (
             PARTITION BY client_company_id
             ORDER BY COUNT(*) DESC
           ) AS rn
    FROM public.leads
    WHERE client_company_id IS NOT NULL AND company_id IS NOT NULL
    GROUP BY client_company_id, company_id
  ) l
  WHERE l.rn = 1
) sub
WHERE cc.id = sub.client_company_id AND cc.company_id IS NULL;

-- Backfill contacts.company_id from linked client_company
UPDATE public.contacts c
SET company_id = cc.company_id
FROM public.client_companies cc
WHERE c.client_company_id = cc.id
  AND cc.company_id IS NOT NULL
  AND c.company_id IS NULL;

-- ============================================================
-- PHASE 4: Migrate goal data → goals_v2
-- ============================================================

INSERT INTO public.goals_v2 (
  id, created_at, updated_at, company_id, name, period_type,
  target_amount, is_active, attribution_basis, monthly_cutoff_day,
  per_month_cutoffs, weighted_forecast_enabled, breakdown_config,
  breakdown_targets, created_by
)
SELECT
  g.id,
  g.created_at,
  g.updated_at,
  g.company_id,
  g.name,
  g.period_type,
  g.target_amount,
  g.is_active,
  COALESCE(gs.attribution_basis, 'event_date'),
  COALESCE(gs.monthly_cutoff_day, 25),
  gs.per_month_cutoffs,
  COALESCE(gs.weighted_forecast_enabled, false),
  '[]'::jsonb,
  COALESCE(g.breakdown_targets, '{}'::jsonb),
  g.created_by
FROM public.goals g
LEFT JOIN public.goal_settings gs ON gs.company_id = g.company_id;

-- ============================================================
-- PHASE 5: Migrate segment data → goal_segments
-- ============================================================

INSERT INTO public.goal_segments (
  id, created_at, updated_at, company_id, name, source_field,
  fallback_name, mappings
)
SELECT
  ad.id,
  ad.created_at,
  ad.updated_at,
  ad.company_id,
  ad.dimension_name,
  ad.source_field,
  COALESCE(ad.fallback_segment_name, 'Lainnya'),
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'segment_name', sm.segment_name,
          'match_values', to_jsonb(sm.match_values)
        ) ORDER BY sm.priority_order
      )
      FROM public.segment_mappings sm
      WHERE sm.dimension_id = ad.id
    ),
    '[]'::jsonb
  )
FROM public.analytical_dimensions ad;

-- ============================================================
-- PHASE 6: Migrate settings data → goal_settings_v2
-- ============================================================

INSERT INTO public.goal_settings_v2 (
  company_id, created_at, updated_at, reporting_critical_fields,
  auto_lock_enabled, auto_lock_day_offset, stage_weights
)
SELECT
  gs.company_id,
  gs.created_at,
  gs.updated_at,
  gs.reporting_critical_fields,
  gs.auto_lock_enabled,
  COALESCE(gs.auto_lock_day_offset, 5),
  COALESCE(
    (
      SELECT jsonb_object_agg(
        sw.pipeline_id::text,
        pipeline_weights.weights
      )
      FROM (
        SELECT
          sw2.pipeline_id,
          jsonb_object_agg(sw2.stage_id::text, sw2.weight_percent) AS weights
        FROM public.stage_weights sw2
        WHERE sw2.company_id = gs.company_id
        GROUP BY sw2.pipeline_id
      ) pipeline_weights
      JOIN public.stage_weights sw ON sw.company_id = gs.company_id
      GROUP BY sw.pipeline_id
    ),
    '{}'::jsonb
  )
FROM public.goal_settings gs
ON CONFLICT (company_id) DO NOTHING;

-- For companies that have stage_weights but no goal_settings row, create a default
INSERT INTO public.goal_settings_v2 (company_id, stage_weights)
SELECT DISTINCT sw.company_id,
  (
    SELECT jsonb_object_agg(
      sw2.pipeline_id::text,
      pipeline_weights.weights
    )
    FROM (
      SELECT
        sw3.pipeline_id,
        jsonb_object_agg(sw3.stage_id::text, sw3.weight_percent) AS weights
      FROM public.stage_weights sw3
      WHERE sw3.company_id = sw.company_id
      GROUP BY sw3.pipeline_id
    ) pipeline_weights
    JOIN public.stage_weights sw2 ON sw2.company_id = sw.company_id
    GROUP BY sw2.pipeline_id
  )
FROM public.stage_weights sw
WHERE sw.company_id NOT IN (SELECT company_id FROM public.goal_settings_v2)
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================
-- PHASE 7: Enable RLS on new tables
-- ============================================================

ALTER TABLE public.goals_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_user_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_settings_v2 ENABLE ROW LEVEL SECURITY;

-- goals_v2 policies
CREATE POLICY "goals_v2_select" ON public.goals_v2
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );
CREATE POLICY "goals_v2_insert" ON public.goals_v2
  FOR INSERT WITH CHECK (
    company_id = ANY(public.fn_user_company_ids())
  );
CREATE POLICY "goals_v2_update" ON public.goals_v2
  FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));
CREATE POLICY "goals_v2_delete" ON public.goals_v2
  FOR DELETE USING (
    company_id = ANY(public.fn_user_company_ids())
  );

-- goal_segments policies
CREATE POLICY "goal_segments_select" ON public.goal_segments
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );
CREATE POLICY "goal_segments_insert" ON public.goal_segments
  FOR INSERT WITH CHECK (
    company_id = ANY(public.fn_user_company_ids())
  );
CREATE POLICY "goal_segments_update" ON public.goal_segments
  FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));
CREATE POLICY "goal_segments_delete" ON public.goal_segments
  FOR DELETE USING (
    company_id = ANY(public.fn_user_company_ids())
  );

-- goal_user_targets policies
CREATE POLICY "goal_user_targets_select" ON public.goal_user_targets
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );
CREATE POLICY "goal_user_targets_insert" ON public.goal_user_targets
  FOR INSERT WITH CHECK (
    company_id = ANY(public.fn_user_company_ids())
  );
CREATE POLICY "goal_user_targets_update" ON public.goal_user_targets
  FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));
CREATE POLICY "goal_user_targets_delete" ON public.goal_user_targets
  FOR DELETE USING (
    company_id = ANY(public.fn_user_company_ids())
  );

-- goal_settings_v2 policies
CREATE POLICY "goal_settings_v2_select" ON public.goal_settings_v2
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );
CREATE POLICY "goal_settings_v2_insert" ON public.goal_settings_v2
  FOR INSERT WITH CHECK (
    company_id = ANY(public.fn_user_company_ids())
  );
CREATE POLICY "goal_settings_v2_update" ON public.goal_settings_v2
  FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));
CREATE POLICY "goal_settings_v2_delete" ON public.goal_settings_v2
  FOR DELETE USING (
    company_id = ANY(public.fn_user_company_ids())
  );

-- ============================================================
-- PHASE 8: Update RLS on contacts and client_companies
-- ============================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "client_companies_select" ON public.client_companies;
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;

-- New company-scoped SELECT policies
CREATE POLICY "client_companies_select_v2" ON public.client_companies
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  );

CREATE POLICY "contacts_select_v2" ON public.contacts
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
    OR company_id IS NULL
  );

-- ============================================================
-- PHASE 9: Drop old tables in dependency order
-- ============================================================

DROP TABLE IF EXISTS public.snapshot_buckets CASCADE;
DROP TABLE IF EXISTS public.period_snapshots CASCADE;
DROP TABLE IF EXISTS public.period_audit_log CASCADE;
DROP TABLE IF EXISTS public.post_win_adjustments CASCADE;
DROP TABLE IF EXISTS public.template_buckets CASCADE;
DROP TABLE IF EXISTS public.template_nodes CASCADE;
DROP TABLE IF EXISTS public.template_versions CASCADE;
DROP TABLE IF EXISTS public.goal_templates CASCADE;
DROP TABLE IF EXISTS public.goal_periods CASCADE;
DROP TABLE IF EXISTS public.stage_weights CASCADE;
DROP TABLE IF EXISTS public.segment_mappings CASCADE;
DROP TABLE IF EXISTS public.analytical_dimensions CASCADE;
DROP TABLE IF EXISTS public.goal_settings CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;

-- ============================================================
-- PHASE 10: Update app_modules
-- ============================================================

-- Remove old goal-related modules
DELETE FROM public.app_modules WHERE id IN ('goal_template', 'goal_period');

-- Upsert updated modules
INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('management_dashboard', 'Management Dashboard', 'Goal attainment and forecast dashboard', 10),
  ('goal_settings',        'Goal Settings',        'Goal settings and configuration',        11),
  ('forecast_settings',    'Forecast Settings',    'Stage weights and forecast configuration', 12),
  ('segment_settings',     'Segment Settings',     'Segment definitions and mappings',        13)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
;
