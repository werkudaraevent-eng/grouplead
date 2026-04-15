# Implementation Plan: Goal System Redesign

## Overview

Replace the over-engineered 14-table goal system with a flat, JSONB-driven 4-table model (`goals_v2`, `goal_segments`, `goal_user_targets`, `goal_settings_v2`). The implementation follows a layered approach: migration → types → engine functions → validation → server actions → UI components → dashboard updates → cleanup of old files/routes.

## Tasks

- [x] 1. Database migration via Supabase
  - [x] 1.1 Create new tables and migrate data
    - Write a single Supabase migration SQL file that:
    - Creates `goals_v2`, `goal_segments`, `goal_user_targets`, `goal_settings_v2` tables with all columns, constraints, and indexes as specified in the design
    - Adds `company_id` UUID column to `contacts` and `client_companies` with FK to `companies(id)`
    - Backfills `company_id` on `client_companies` from most common lead `company_id`
    - Backfills `company_id` on `contacts` from linked `client_company.company_id`
    - Migrates goal data from `goals` + `goal_settings` → `goals_v2` (including attribution settings, breakdown config/targets)
    - Migrates segment data from `analytical_dimensions` + `segment_mappings` → `goal_segments` with JSONB mappings
    - Migrates settings data from `goal_settings` + `stage_weights` → `goal_settings_v2` with JSONB stage_weights
    - Enables RLS on all new tables using `fn_user_company_ids()` and `fn_user_has_holding_access()` patterns
    - Replaces existing RLS policies on `contacts` and `client_companies` with company-scoped policies (preserving NULL company_id access for holding users)
    - Drops old tables in dependency order: `snapshot_buckets`, `period_snapshots`, `period_audit_log`, `post_win_adjustments`, `template_buckets`, `template_nodes`, `template_versions`, `goal_templates`, `goal_periods`, `stage_weights`, `segment_mappings`, `analytical_dimensions`, `goal_settings`, `goals`
    - Updates `app_modules` to reflect new permission structure
    - Apply migration via Supabase MCP (project ID: `lfudnmpcmgiopbtluukd`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1–5.7, 6.1–6.6, 7.1–7.6_

- [x] 2. Checkpoint — Verify migration
  - Ensure migration applied successfully, ask the user if questions arise.

- [x] 3. Replace TypeScript types
  - [x] 3.1 Rewrite `src/types/goals.ts` with V2 types
    - Remove all old interfaces: `Goal`, `GoalPeriod`, `GoalTemplate`, `TemplateVersion`, `TemplateNode`, `TemplateBucket`, `ClassificationRule`, `AnalyticalDimension`, `SegmentMapping`, `GoalSettings`, `StageWeight`, `PeriodSnapshot`, `SnapshotBucket`, `PostWinAdjustment`, `PeriodAuditEntry`, `BucketAssignment`, `HierarchyRollup`, `AttainmentResult`, `ForecastResult`, and their Insert/Update/Upsert variants
    - Add new interfaces as specified in design: `BreakdownLevelConfig`, `BreakdownTargets`, `GoalV2`, `GoalV2Insert`, `GoalV2Update`, `SegmentMappingEntry`, `GoalSegment`, `GoalSegmentInsert`, `GoalSegmentUpdate`, `GoalUserTarget`, `GoalUserTargetInsert`, `GoalUserTargetUpdate`, `StageWeightsMap`, `GoalSettingsV2`, `GoalSettingsV2Update`
    - Keep and update engine input types: `LeadAttributionInput`, `LeadAttainmentInput`, `LeadForecastInput` (unchanged), `LeadClassificationInput` (unchanged)
    - Keep `SavedView`, `SavedViewConfig`, `SavedViewInsert`, `SavedViewUpdate` (unchanged)
    - Keep `AttributionSettings` but update to reference GoalV2 fields
    - Add `OverlapWarning` type (moved from classification-engine)
    - _Requirements: 8.1–8.6_

- [x] 4. Update pure engine functions
  - [x] 4.1 Update `src/features/goals/lib/classification-engine.ts` for GoalSegment
    - Add `classifyLeadBySegment(rawValue: string | null, segment: GoalSegment): string` — iterates `mappings` array in order, returns first match or `fallback_name`
    - Add `detectSegmentOverlapsV2(mappings: SegmentMappingEntry[]): OverlapWarning[]` — detects values appearing in multiple mapping entries
    - Remove old `classifyLead()`, `detectBucketOverlaps()`, `detectSegmentOverlaps()` functions and all bucket/template-related code
    - Keep `OverlapWarning` interface
    - _Requirements: 2.3, 2.4, 2.5, 13.1_

  - [x] 4.2 Write property test for segment classification (Property 3)
    - **Property 3: Segment classification first-match with fallback**
    - File: `src/features/goals/lib/__tests__/classification-engine.property.test.ts`
    - Use fast-check to generate arbitrary GoalSegment mappings and raw values
    - Verify first-match semantics and fallback behavior
    - **Validates: Requirements 2.3, 2.4, 13.1**

  - [x] 4.3 Write property test for segment overlap detection (Property 4)
    - **Property 4: Segment overlap detection completeness**
    - File: `src/features/goals/lib/__tests__/classification-engine.property.test.ts`
    - Use fast-check to generate arbitrary SegmentMappingEntry arrays
    - Verify overlapping values produce warnings, non-overlapping produce empty array
    - **Validates: Requirements 2.5**

  - [x] 4.4 Update `src/features/goals/lib/attribution-engine.ts` for GoalV2
    - Replace `attributeLeadToPeriod()` with `attributeLeadToPeriodV2(lead, goal, periodStart, periodEnd): boolean`
    - Read `attribution_basis`, `monthly_cutoff_day`, `per_month_cutoffs` from `GoalV2` pick type instead of separate `AttributionSettings` + `GoalPeriod[]`
    - Keep `clampCutoff()`, `getEffectiveCutoff()`, `formatDate()` helpers
    - _Requirements: 13.2_

  - [x] 4.5 Write property test for attribution engine (Property 8)
    - **Property 8: Attribution engine period placement**
    - File: `src/features/goals/lib/__tests__/attribution-engine.property.test.ts`
    - Use fast-check to generate leads with valid dates and goals with cutoff days in [1,28]
    - Verify cutoff logic: day > cutoff → next month, day <= cutoff → current month
    - **Validates: Requirements 13.2**

  - [x] 4.6 Simplify `src/features/goals/lib/attainment-calculator.ts`
    - Replace `calculateAttainment()` with `calculateAttainmentV2(leads: LeadAttainmentInput[]): { total: number; lead_count: number }`
    - Remove bucket assignment parameters and by_bucket grouping (no more buckets)
    - Sum `actual_value` only for leads where `is_closed_won === true`
    - _Requirements: 13.3, 14.1, 14.2, 14.3_

  - [x] 4.7 Write property test for attainment calculator (Property 9)
    - **Property 9: Attainment includes only Closed Won actual_value**
    - File: `src/features/goals/lib/__tests__/attainment-calculator.property.test.ts`
    - Use fast-check to generate leads with mixed `is_closed_won` states
    - Verify only Closed Won leads contribute to total and lead_count
    - **Validates: Requirements 13.3, 14.1, 14.2, 14.3**

  - [x] 4.8 Update `src/features/goals/lib/forecast-calculator.ts` for JSONB stage weights
    - Replace `calculateForecast()` with `calculateForecastV2(leads, stageWeights: StageWeightsMap, weightedEnabled: boolean): { total_raw: number; total_weighted: number; lead_count: number }`
    - Remove bucket assignment parameters and by_bucket grouping
    - Read stage weights from `StageWeightsMap` JSONB structure instead of `StageWeight[]`
    - Exclude Closed Won and Lost leads from both raw and weighted totals
    - _Requirements: 13.4, 14.4, 14.5, 14.6_

  - [x] 4.9 Write property test for forecast calculator (Property 10)
    - **Property 10: Forecast excludes Closed Won and Lost leads**
    - File: `src/features/goals/lib/__tests__/forecast-calculator.property.test.ts`
    - Use fast-check to generate leads with mixed stages and StageWeightsMap
    - Verify Closed Won and Lost leads contribute zero; weighted calculation uses correct weights
    - **Validates: Requirements 13.4, 14.4, 14.5, 14.6**

  - [x] 4.10 Update `src/features/goals/lib/rollup-engine.ts` for breakdown_config JSONB
    - Replace `rollUpHierarchy()` with `rollUpFromBreakdownConfig(leads, breakdownConfig, segments, breakdownTargets, valueMaps): TreeNodeData`
    - Work with `BreakdownLevelConfig[]` from GoalV2 instead of `TemplateNode[]`
    - Reuse `buildBreakdownTree()` and `computeChildren()` from breakdown-utils
    - Ensure parent node values equal sum of children values
    - _Requirements: 13.5, 14.7_

  - [x] 4.11 Write property test for rollup engine (Property 11)
    - **Property 11: Rollup parent equals sum of children**
    - File: `src/features/goals/lib/__tests__/rollup-engine.property.test.ts`
    - Use fast-check to generate breakdown trees with arbitrary nesting
    - Verify at every non-leaf node: wonRevenue, pipelineValue, target equal sum of children (within 0.01 tolerance)
    - **Validates: Requirements 13.5, 14.7**

  - [x] 4.12 Update `src/features/goals/lib/breakdown-utils.ts` for V2 types
    - Update `BreakdownLevel` interface to align with `BreakdownLevelConfig` from design
    - Update `serializeTargets()` and `deserializeTargets()` to work with `BreakdownTargets` type
    - Keep `parseLegacyBreakdown()` for backward compatibility during migration
    - Update `buildBreakdownTree()` and `computeChildren()` to use `GoalSegment` for segment resolution instead of `AnalyticalDimension` + `SegmentMapping`
    - Update `setDimensionSourceFields()` / `getDimensionSourceField()` to work with `GoalSegment`
    - _Requirements: 1.2, 1.3, 11.4, 11.5, 13.6_

  - [x] 4.13 Write property test for breakdown targets round-trip (Property 1)
    - **Property 1: Breakdown targets serialization round-trip**
    - File: `src/features/goals/lib/__tests__/breakdown-utils.property.test.ts`
    - Use fast-check to generate arbitrary TreeNodeData trees (up to 10 levels)
    - Verify `serializeTargets()` → `deserializeTargets()` returns original target amounts
    - **Validates: Requirements 1.2, 1.3, 11.3**

- [x] 5. Checkpoint — Verify engine functions compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update validation functions
  - [x] 6.1 Add goal validation functions
    - Create or update `src/features/goals/lib/goal-validation.ts`
    - Add `validateBreakdownConfig(config: BreakdownLevelConfig[]): { valid: boolean; error?: string }` — rejects if length > 10
    - Add `validateMonthlyCutoff(day: number): { valid: boolean; error?: string }` — rejects if outside [1, 28]
    - Add `validateUserTarget(periodStart: string, periodEnd: string, targetAmount: number): { valid: boolean; error?: string }` — rejects if start >= end or amount < 0
    - Add `validateStageWeights(weights: StageWeightsMap): { valid: boolean; error?: string }` — rejects if any weight not integer in [0, 100]
    - Keep existing `validateCriticalFieldUpdate()` in `goal-settings-validation.ts`
    - _Requirements: 1.6, 3.4, 3.5, 4.3, 4.4, 4.5, 4.6, 9.6, 9.7_

  - [x] 6.2 Write property test for goal validation (Property 2)
    - **Property 2: Goal validation rejects invalid configs**
    - File: `src/features/goals/lib/__tests__/goal-validation.property.test.ts`
    - Use fast-check to generate breakdown_config arrays of varying lengths and cutoff values
    - Verify rejection for length > 10 and cutoff outside [1, 28]
    - **Validates: Requirements 1.6, 9.6, 9.7**

  - [x] 6.3 Write property test for user target validation (Property 5)
    - **Property 5: User target validation**
    - File: `src/features/goals/lib/__tests__/goal-validation.property.test.ts`
    - Use fast-check to generate date pairs and target amounts
    - Verify acceptance iff period_start < period_end and target_amount >= 0
    - **Validates: Requirements 3.4, 3.5**

  - [x] 6.4 Write property test for stage weight validation (Property 6)
    - **Property 6: Stage weight validation range**
    - File: `src/features/goals/lib/__tests__/goal-validation.property.test.ts`
    - Use fast-check to generate StageWeightsMap with various weight values
    - Verify acceptance iff every weight is integer in [0, 100]
    - **Validates: Requirements 4.3**

  - [x] 6.5 Write property test for protected critical fields (Property 7)
    - **Property 7: Protected critical fields invariant**
    - File: `src/features/goals/lib/__tests__/goal-validation.property.test.ts`
    - Use fast-check to generate reporting_critical_fields arrays
    - Verify rejection when missing any mandatory field, acceptance when all present
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 7. Rewrite server actions
  - [x] 7.1 Rewrite `src/app/actions/goal-actions.ts` for V2 schema
    - Remove all old action functions (createGoalAction, updateGoalAction, createGoalPeriodAction, closeGoalPeriodAction, reopenGoalPeriodAction, createGoalTemplateAction, createTemplateVersionAction, publishTemplateVersionAction, updateTemplateNodeAction, updateTemplateBucketAction, createDimensionAction, updateDimensionAction, deleteDimensionAction, createSegmentMappingAction, updateSegmentMappingAction, deleteSegmentMappingAction, updateGoalSettingsAction, updateStageWeightsAction, createSavedViewAction, updateSavedViewAction, deleteSavedViewAction, allocateTargetsAction)
    - Add `createGoalV2Action(data: GoalV2Insert)` — validates breakdown_config max 10 levels, cutoff [1,28], target >= 0
    - Add `updateGoalV2Action(goalId: string, data: GoalV2Update)` — validates same constraints on partial updates
    - Add `deleteGoalV2Action(goalId: string)` — deletes from goals_v2
    - Add `upsertGoalSegmentAction(data: GoalSegmentInsert)` — validates source_field against Lead_Field_Registry with `supportsSegmentation: true`
    - Add `updateGoalSegmentAction(segmentId: string, data: GoalSegmentUpdate)` — validates same
    - Add `deleteGoalSegmentAction(segmentId: string)` — deletes from goal_segments
    - Add `upsertGoalUserTargetAction(data: GoalUserTargetInsert)` — validates period_start < period_end, target >= 0
    - Add `deleteGoalUserTargetAction(targetId: string)` — deletes from goal_user_targets
    - Add `updateGoalSettingsV2Action(companyId: string, data: GoalSettingsV2Update)` — validates stage weights [0,100], critical fields minimum set
    - Keep saved view actions (createSavedViewAction, updateSavedViewAction, deleteSavedViewAction) — saved_views table is preserved
    - _Requirements: 9.1–9.7_

  - [x] 7.2 Delete `src/app/actions/snapshot-actions.ts`
    - Remove the entire file — snapshots are eliminated in the redesign
    - _Requirements: 6.1, 9.5_

- [x] 8. Checkpoint — Verify server actions compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update goal settings UI components
  - [x] 9.1 Update `src/features/goals/components/settings/goal-settings-page.tsx`
    - Query `goals_v2` and `goal_settings_v2` instead of old tables
    - Remove template/period tab navigation
    - Simplify layout: goal list + goal detail (breakdown, attribution, forecast settings)
    - _Requirements: 10.1, 10.6_

  - [x] 9.2 Update `src/features/goals/components/settings/goal-manager.tsx`
    - CRUD against `goals_v2` using new server actions
    - Remove template/period selection UI
    - Add breakdown level selector (up to 10 levels from Lead_Field_Registry + segments)
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 9.3 Update `src/features/goals/components/settings/goal-breakdown.tsx`
    - Read `breakdown_config` from `goals_v2` instead of `template_nodes`
    - Read segment definitions from `goal_segments` instead of `analytical_dimensions` + `segment_mappings`
    - Serialize target edits to `breakdown_targets` JSONB via `updateGoalV2Action`
    - _Requirements: 11.1–11.6_

  - [x] 9.4 Update `src/features/goals/components/settings/segment-settings.tsx`
    - Read/write `goal_segments` with JSONB `mappings` array
    - Use `upsertGoalSegmentAction` and `updateGoalSegmentAction`
    - Display overlap warnings from `detectSegmentOverlapsV2()`
    - Validate `source_field` against Lead_Field_Registry
    - _Requirements: 12.1–12.6_

  - [x] 9.5 Update `src/features/goals/components/settings/forecast-settings.tsx`
    - Read/write `stage_weights` JSONB on `goal_settings_v2` via `updateGoalSettingsV2Action`
    - Remove references to old `stage_weights` table
    - _Requirements: 10.5_

  - [x] 9.6 Update `src/features/goals/components/settings/attribution-settings.tsx`
    - Read/write `attribution_basis`, `monthly_cutoff_day`, `per_month_cutoffs` on `goals_v2` via `updateGoalV2Action`
    - Remove references to `goal_settings` table
    - _Requirements: 10.4_

- [x] 10. Update dashboard widgets
  - [x] 10.1 Update dashboard goal data queries
    - Update `src/features/goals/hooks/use-goal-data.ts` to query `goals_v2` instead of old join chain
    - Remove `src/features/goals/hooks/use-goal-periods.ts` (no more goal_periods)
    - Keep `src/features/goals/hooks/use-saved-views.ts` (saved_views preserved)
    - _Requirements: 15.1_

  - [x] 10.2 Update dashboard widgets for V2 schema
    - Update `management-dashboard.tsx` to use `goals_v2` data
    - Update `company-breakdown-widget.tsx` to read `breakdown_config` from `goals_v2`
    - Update `segment-breakdown-widget.tsx` to read from `goal_segments`
    - Update `sales-contribution-widget.tsx` to read user targets from `goal_user_targets`
    - Update `forecast-widget.tsx` to read stage weights from `goal_settings_v2.stage_weights`
    - Update `attainment-summary-widget.tsx`, `pipeline-widget.tsx`, `variance-widget.tsx`, `trend-widget.tsx`, `drill-down-panel.tsx`, `exception-list-widget.tsx` to use V2 engine functions
    - _Requirements: 15.1–15.6_

- [x] 11. Checkpoint — Verify UI compiles and renders
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Clean up old files and routes
  - [x] 12.1 Delete old template components
    - Delete `src/features/goals/components/templates/` directory (all files: `template-editor.tsx`, `template-list-page.tsx`, `bucket-list.tsx`, `bucket-rule-builder.tsx`, `node-tree.tsx`, `target-allocation-panel.tsx`)
    - _Requirements: 6.1_

  - [x] 12.2 Delete old dimension components
    - Delete `src/features/goals/components/dimensions/` directory (all files: `dimension-editor.tsx`, `dimension-list-page.tsx`, `classification-preview.tsx`, `segment-mapping-form.tsx`)
    - _Requirements: 6.1_

  - [x] 12.3 Delete old settings components
    - Delete `src/features/goals/components/settings/period-manager.tsx` (no more goal_periods)
    - _Requirements: 6.1_

  - [x] 12.4 Delete old lib files
    - Delete `src/features/goals/lib/allocation.ts` (no more bucket allocation)
    - Delete `src/features/goals/lib/adjustment-detection.ts` (no more post-win adjustments)
    - Delete `src/features/goals/lib/template-version.ts` (no more template versioning)
    - Delete corresponding test files: `allocation.test.ts`, `adjustment-detection.test.ts`, `template-version.test.ts`
    - _Requirements: 6.1_

  - [x] 12.5 Remove old route pages
    - Delete `src/app/settings/goals/templates/` directory (page.tsx, [id]/page.tsx)
    - Delete `src/app/settings/goals/dimensions/` directory (page.tsx, [id]/page.tsx)
    - Update `src/app/settings/goals/layout.tsx` to remove template/dimension navigation links
    - _Requirements: 6.1_

  - [x] 12.6 Update settings navigation and app_modules references
    - Update `src/app/settings/goals/page.tsx` to reflect simplified goal settings (no template/dimension tabs)
    - Update `src/app/settings/segments/page.tsx` to use `goal_segments` data source
    - Update any sidebar/nav references to removed routes
    - _Requirements: 10.1, 10.6_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major layer
- Property tests validate the 11 correctness properties from the design using fast-check
- Migration should be applied via Supabase MCP (project ID: `lfudnmpcmgiopbtluukd`)
- The `saved_views` table and its components are preserved unchanged
- Old test files for removed lib modules should be deleted alongside the lib files
