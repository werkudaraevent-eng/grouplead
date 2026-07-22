-- Migrate breakdown data from goals_v2 to goal_nodes
-- Only for goal 8bceec9f which has breakdown_config

-- Check if nodes already exist (idempotent)
DO $$
DECLARE
  v_goal_id uuid := '8bceec9f-3ff0-4e94-bf59-0be59b588a6f';
  v_company_id uuid := '055a3295-b583-4140-87f3-ed0783803c0b';
  v_existing_count int;
BEGIN
  SELECT COUNT(*) INTO v_existing_count FROM public.goal_nodes WHERE goal_id = v_goal_id;
  IF v_existing_count > 0 THEN
    RAISE NOTICE 'Nodes already exist for goal %, skipping migration', v_goal_id;
    RETURN;
  END IF;

  -- Level 1: Segment nodes (from breakdown_targets top-level keys)
  INSERT INTO public.goal_nodes (goal_id, parent_node_id, name, dimension_type, reference_field, reference_value, allocation_mode, target_amount, sort_order, company_id)
  VALUES
    (v_goal_id, NULL, 'BFSI (Banking, Financial Services, and Insurance)', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'BFSI', 'absolute', 23400000000, 0, v_company_id),
    (v_goal_id, NULL, 'Mining, Metal, Down Streaming & Energy', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Mining, Metal, Down Streaming & Energy', 'absolute', 20800000000, 1, v_company_id),
    (v_goal_id, NULL, 'Healthcare & Pharma + Asosiasi Kedokteran', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Healthcare & Pharma + Asosiasi Kedokteran', 'absolute', 20800000000, 2, v_company_id),
    (v_goal_id, NULL, 'FMCG (Fast-Moving Consumer Goods) / Consumer', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'FMCG (Fast-Moving Consumer Goods) / Consumer', 'absolute', 20800000000, 3, v_company_id),
    (v_goal_id, NULL, 'International Organisations & Associations', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'International Organisations & Associations', 'absolute', 18200000000, 4, v_company_id),
    (v_goal_id, NULL, 'Technology & Agricultural / Agribusiness', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Technology & Agricultural / Agribusiness', 'absolute', 15600000000, 5, v_company_id),
    (v_goal_id, NULL, 'Travel, PCO & Related Ecosystem', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Travel, PCO & Related Ecosystem', 'absolute', 10400000000, 6, v_company_id),
    (v_goal_id, NULL, 'Public Sector & Education', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Public Sector & Education', 'absolute', 0, 7, v_company_id),
    (v_goal_id, NULL, 'Built Environment & Industrial Support', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Built Environment & Industrial Support', 'absolute', 0, 8, v_company_id),
    (v_goal_id, NULL, 'Embassy & Community', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Embassy & Community', 'absolute', 0, 9, v_company_id),
    (v_goal_id, NULL, 'Other', 'segment', 'segment:a743c63f-dc72-4e5a-bb6f-6aa6c53a0102', 'Other', 'absolute', 0, 10, v_company_id);
END $$;
;
