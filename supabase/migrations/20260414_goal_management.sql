-- ============================================================
-- Goal Management & Management Dashboard — Schema Migration
-- Creates all goal-related tables, constraints, indexes,
-- and registers new app_modules for RBAC.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. goals
-- ============================================================
CREATE TABLE public.goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly','quarterly','yearly')),
  target_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true
);

-- ============================================================
-- 2. goal_templates (before goal_periods, since template_versions FK is needed)
-- ============================================================
CREATE TABLE public.goal_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id)
);

-- ============================================================
-- 3. template_versions
-- ============================================================
CREATE TABLE public.template_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  template_id uuid NOT NULL REFERENCES public.goal_templates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  published_by uuid REFERENCES public.profiles(id)
);

-- Enforce at most one published version per template
CREATE UNIQUE INDEX idx_template_versions_one_published
  ON public.template_versions (template_id) WHERE status = 'published';

-- ============================================================
-- 4. goal_periods
-- ============================================================
CREATE TABLE public.goal_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  template_version_id uuid REFERENCES public.template_versions(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX idx_goal_periods_goal_start ON public.goal_periods (goal_id, start_date);
CREATE INDEX idx_goal_periods_company_status ON public.goal_periods (company_id, status);

-- ============================================================
-- 5. template_nodes
-- ============================================================
CREATE TABLE public.template_nodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  template_version_id uuid NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_node_id uuid REFERENCES public.template_nodes(id) ON DELETE CASCADE,
  level_order int NOT NULL DEFAULT 0,
  dimension_type text NOT NULL,
  display_name text NOT NULL
);

-- ============================================================
-- 6. template_buckets
-- ============================================================
CREATE TABLE public.template_buckets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  node_id uuid NOT NULL REFERENCES public.template_nodes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bucket_name text NOT NULL,
  classification_rules jsonb NOT NULL DEFAULT '[]',
  priority_order int NOT NULL DEFAULT 0,
  is_fallback boolean NOT NULL DEFAULT false,
  target_amount numeric(18,2) NOT NULL DEFAULT 0,
  allocation_mode text DEFAULT 'manual' CHECK (allocation_mode IN ('manual','percentage','history')),
  allocation_percentage numeric(5,2)
);

-- ============================================================
-- 7. analytical_dimensions
-- ============================================================
CREATE TABLE public.analytical_dimensions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dimension_name text NOT NULL,
  source_field text NOT NULL,
  description text,
  fallback_segment_name text NOT NULL DEFAULT 'Unmapped'
);

CREATE UNIQUE INDEX idx_analytical_dimensions_company_name
  ON public.analytical_dimensions (company_id, dimension_name);

-- ============================================================
-- 8. segment_mappings
-- ============================================================
CREATE TABLE public.segment_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  dimension_id uuid NOT NULL REFERENCES public.analytical_dimensions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  match_values text[] NOT NULL,
  priority_order int NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. goal_settings (one row per company)
-- ============================================================
CREATE TABLE public.goal_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  attribution_basis text NOT NULL DEFAULT 'event_date' CHECK (attribution_basis IN ('event_date','closed_won_date')),
  monthly_cutoff_day int DEFAULT 25 CHECK (monthly_cutoff_day BETWEEN 1 AND 28),
  per_month_cutoffs jsonb,
  weighted_forecast_enabled boolean NOT NULL DEFAULT false,
  auto_lock_enabled boolean NOT NULL DEFAULT false,
  auto_lock_day_offset int DEFAULT 5,
  reporting_critical_fields text[] NOT NULL DEFAULT '{actual_value,event_date_start,event_date_end,project_name,company_id,pic_sales_id}'
);

-- ============================================================
-- 10. stage_weights
-- ============================================================
CREATE TABLE public.stage_weights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  weight_percent int NOT NULL CHECK (weight_percent BETWEEN 0 AND 100)
);

-- Unique constraint using COALESCE to handle nullable pipeline_id
CREATE UNIQUE INDEX idx_stage_weights_company_pipeline_stage
  ON public.stage_weights (company_id, COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid), stage_id);

-- ============================================================
-- 11. period_snapshots
-- ============================================================
CREATE TABLE public.period_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  period_id uuid NOT NULL REFERENCES public.goal_periods(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  revision int NOT NULL DEFAULT 1,
  template_version_id uuid NOT NULL REFERENCES public.template_versions(id),
  attribution_basis text NOT NULL,
  monthly_cutoff_config jsonb NOT NULL,
  total_attainment numeric(18,2) NOT NULL DEFAULT 0,
  total_forecast_raw numeric(18,2) NOT NULL DEFAULT 0,
  total_forecast_weighted numeric(18,2) NOT NULL DEFAULT 0,
  snapshot_metadata jsonb,
  created_by uuid REFERENCES public.profiles(id),
  reason text
);

CREATE UNIQUE INDEX idx_period_snapshots_period_revision
  ON public.period_snapshots (period_id, revision);

-- ============================================================
-- 12. snapshot_buckets
-- ============================================================
CREATE TABLE public.snapshot_buckets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES public.period_snapshots(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  node_id uuid NOT NULL,
  bucket_id uuid NOT NULL,
  bucket_name text NOT NULL,
  attainment numeric(18,2) NOT NULL DEFAULT 0,
  forecast_raw numeric(18,2) NOT NULL DEFAULT 0,
  forecast_weighted numeric(18,2) NOT NULL DEFAULT 0,
  target_amount numeric(18,2) NOT NULL DEFAULT 0,
  lead_count_won int NOT NULL DEFAULT 0,
  lead_count_pipeline int NOT NULL DEFAULT 0
);

-- ============================================================
-- 13. post_win_adjustments
-- ============================================================
CREATE TABLE public.post_win_adjustments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id int NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  affects_closed_period boolean NOT NULL DEFAULT false,
  reviewed boolean NOT NULL DEFAULT false
);

-- ============================================================
-- 14. saved_views
-- ============================================================
CREATE TABLE public.saved_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  view_config jsonb NOT NULL
);

-- ============================================================
-- 15. period_audit_log
-- ============================================================
CREATE TABLE public.period_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  period_id uuid NOT NULL REFERENCES public.goal_periods(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('close','reopen','snapshot_revision')),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  metadata jsonb
);

-- ============================================================
-- 16. Register new app_modules for goal-specific RBAC
-- ============================================================
INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('management_dashboard', 'Management Dashboard', 'Goal attainment and forecast dashboard',  10),
  ('goal_settings',        'Goal Settings',        'Goal settings and configuration',         11),
  ('goal_template',        'Goal Templates',       'Goal template CRUD',                      12),
  ('goal_period',          'Goal Periods',         'Goal period lifecycle management',         13),
  ('forecast_settings',    'Forecast Settings',    'Stage weights and forecast configuration', 14)
ON CONFLICT (id) DO NOTHING;

COMMIT;
