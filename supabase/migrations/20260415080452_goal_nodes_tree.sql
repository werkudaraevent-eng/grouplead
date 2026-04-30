-- ============================================================
-- PHASE 1: Create goal_nodes table
-- ============================================================

CREATE TABLE public.goal_nodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  goal_id uuid NOT NULL REFERENCES public.goals_v2(id) ON DELETE CASCADE,
  parent_node_id uuid REFERENCES public.goal_nodes(id) ON DELETE CASCADE,
  name text NOT NULL,
  dimension_type text NOT NULL DEFAULT 'custom',
  reference_field text NOT NULL,
  reference_value text NOT NULL,
  allocation_mode text NOT NULL DEFAULT 'absolute'
    CHECK (allocation_mode IN ('percentage', 'absolute')),
  percentage numeric(7,4),
  target_amount numeric(18,2) NOT NULL DEFAULT 0
    CHECK (target_amount >= 0),
  monthly_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_goal_nodes_goal ON public.goal_nodes (goal_id);
CREATE INDEX idx_goal_nodes_parent ON public.goal_nodes (parent_node_id);
CREATE INDEX idx_goal_nodes_goal_parent ON public.goal_nodes (goal_id, parent_node_id);
CREATE INDEX idx_goal_nodes_company ON public.goal_nodes (company_id);

-- ============================================================
-- PHASE 2: Add monthly_weights to goals_v2
-- ============================================================

ALTER TABLE public.goals_v2
  ADD COLUMN IF NOT EXISTS monthly_weights jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Make breakdown_config and breakdown_targets nullable (deprecated)
ALTER TABLE public.goals_v2
  ALTER COLUMN breakdown_config DROP NOT NULL;
ALTER TABLE public.goals_v2
  ALTER COLUMN breakdown_targets DROP NOT NULL;

-- ============================================================
-- PHASE 3: Add node_id to goal_user_targets
-- ============================================================

ALTER TABLE public.goal_user_targets
  ADD COLUMN IF NOT EXISTS node_id uuid REFERENCES public.goal_nodes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goal_user_targets_node ON public.goal_user_targets (node_id);

-- ============================================================
-- PHASE 4: Enable RLS on goal_nodes
-- ============================================================

ALTER TABLE public.goal_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_nodes_select" ON public.goal_nodes
  FOR SELECT USING (
    company_id = ANY(public.fn_user_company_ids())
    OR public.fn_user_has_holding_access()
  );

CREATE POLICY "goal_nodes_insert" ON public.goal_nodes
  FOR INSERT WITH CHECK (
    company_id = ANY(public.fn_user_company_ids())
  );

CREATE POLICY "goal_nodes_update" ON public.goal_nodes
  FOR UPDATE
  USING (company_id = ANY(public.fn_user_company_ids()))
  WITH CHECK (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "goal_nodes_delete" ON public.goal_nodes
  FOR DELETE USING (
    company_id = ANY(public.fn_user_company_ids())
  );

-- ============================================================
-- PHASE 5: Update app_modules
-- ============================================================

INSERT INTO public.app_modules (id, name, description, sort_order) VALUES
  ('goal_nodes', 'Goal Nodes', 'Goal breakdown node tree management', 15)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
;
