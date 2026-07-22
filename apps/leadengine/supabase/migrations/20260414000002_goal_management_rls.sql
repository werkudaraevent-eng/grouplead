-- ============================================================
-- Goal Management — Row Level Security Policies
-- Enables RLS and creates company-scoped policies on all
-- goal-related tables using existing helper functions:
--   fn_user_company_ids()
--   fn_user_has_holding_access()
-- Run AFTER 20260414_goal_management.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. goals
-- ============================================================
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select" ON public.goals FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "goals_insert" ON public.goals FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goals_update" ON public.goals FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goals_delete" ON public.goals FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 2. goal_periods
-- ============================================================
ALTER TABLE public.goal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_periods_select" ON public.goal_periods FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "goal_periods_insert" ON public.goal_periods FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_periods_update" ON public.goal_periods FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_periods_delete" ON public.goal_periods FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 3. goal_templates
-- ============================================================
ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_templates_select" ON public.goal_templates FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "goal_templates_insert" ON public.goal_templates FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_templates_update" ON public.goal_templates FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_templates_delete" ON public.goal_templates FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 4. template_versions
-- ============================================================
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_versions_select" ON public.template_versions FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "template_versions_insert" ON public.template_versions FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_versions_update" ON public.template_versions FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_versions_delete" ON public.template_versions FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 5. template_nodes
-- ============================================================
ALTER TABLE public.template_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_nodes_select" ON public.template_nodes FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "template_nodes_insert" ON public.template_nodes FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_nodes_update" ON public.template_nodes FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_nodes_delete" ON public.template_nodes FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 6. template_buckets
-- ============================================================
ALTER TABLE public.template_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_buckets_select" ON public.template_buckets FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "template_buckets_insert" ON public.template_buckets FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_buckets_update" ON public.template_buckets FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "template_buckets_delete" ON public.template_buckets FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 7. analytical_dimensions
-- ============================================================
ALTER TABLE public.analytical_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytical_dimensions_select" ON public.analytical_dimensions FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "analytical_dimensions_insert" ON public.analytical_dimensions FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "analytical_dimensions_update" ON public.analytical_dimensions FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "analytical_dimensions_delete" ON public.analytical_dimensions FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 8. segment_mappings
-- ============================================================
ALTER TABLE public.segment_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segment_mappings_select" ON public.segment_mappings FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "segment_mappings_insert" ON public.segment_mappings FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "segment_mappings_update" ON public.segment_mappings FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "segment_mappings_delete" ON public.segment_mappings FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 9. goal_settings
-- ============================================================
ALTER TABLE public.goal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_settings_select" ON public.goal_settings FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "goal_settings_insert" ON public.goal_settings FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_settings_update" ON public.goal_settings FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_settings_delete" ON public.goal_settings FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 10. stage_weights
-- ============================================================
ALTER TABLE public.stage_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_weights_select" ON public.stage_weights FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "stage_weights_insert" ON public.stage_weights FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "stage_weights_update" ON public.stage_weights FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "stage_weights_delete" ON public.stage_weights FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 11. period_snapshots
-- ============================================================
ALTER TABLE public.period_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_snapshots_select" ON public.period_snapshots FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "period_snapshots_insert" ON public.period_snapshots FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "period_snapshots_update" ON public.period_snapshots FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "period_snapshots_delete" ON public.period_snapshots FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 12. snapshot_buckets
-- ============================================================
ALTER TABLE public.snapshot_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshot_buckets_select" ON public.snapshot_buckets FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "snapshot_buckets_insert" ON public.snapshot_buckets FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "snapshot_buckets_update" ON public.snapshot_buckets FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "snapshot_buckets_delete" ON public.snapshot_buckets FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 13. post_win_adjustments
-- ============================================================
ALTER TABLE public.post_win_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_win_adjustments_select" ON public.post_win_adjustments FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "post_win_adjustments_insert" ON public.post_win_adjustments FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "post_win_adjustments_update" ON public.post_win_adjustments FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "post_win_adjustments_delete" ON public.post_win_adjustments FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 14. saved_views (SPECIAL: owner-only personal + company-scoped shared)
-- ============================================================
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

-- SELECT: personal views visible to owner only; shared views visible
-- to company members and holding users
CREATE POLICY "saved_views_select" ON public.saved_views FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (is_shared = true AND (
      company_id = ANY(public.fn_user_company_ids())
      OR public.fn_user_has_holding_access()
    ))
  );

CREATE POLICY "saved_views_insert" ON public.saved_views FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "saved_views_update" ON public.saved_views FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "saved_views_delete" ON public.saved_views FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

-- ============================================================
-- 15. period_audit_log
-- ============================================================
ALTER TABLE public.period_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_audit_log_select" ON public.period_audit_log FOR SELECT
  USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "period_audit_log_insert" ON public.period_audit_log FOR INSERT
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "period_audit_log_update" ON public.period_audit_log FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "period_audit_log_delete" ON public.period_audit_log FOR DELETE
  USING (company_id = ANY(public.fn_user_company_ids()));

COMMIT;
