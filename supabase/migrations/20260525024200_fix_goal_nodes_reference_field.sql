-- Repair goal_nodes whose reference_field accidentally stored the
-- dimension_type instead of the canonical lead column. This was caused
-- by autoInsertGoalHierarchyAction in src/app/actions/goal-actions.ts
-- (fixed in code as part of the same change set).
--
-- Symptom in product: Sales Performance widget hides reps that have a
-- target set via goal_nodes (sales_owner dimension) because the
-- dashboard expects reference_field = 'pic_sales_id' to do its join.
--
-- This migration is idempotent: it only updates rows where
-- reference_field is the dimension key.

UPDATE public.goal_nodes
SET reference_field = 'pic_sales_id'
WHERE dimension_type = 'sales_owner'
  AND reference_field = 'sales_owner';

UPDATE public.goal_nodes
SET reference_field = 'company_id'
WHERE dimension_type = 'subsidiary'
  AND reference_field = 'subsidiary';

UPDATE public.goal_nodes
SET reference_field = 'client_company_id'
WHERE dimension_type = 'client_company'
  AND reference_field = 'client_company';
