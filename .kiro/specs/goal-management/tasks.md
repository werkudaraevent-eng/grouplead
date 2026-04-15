# Implementation Plan: Goal Management & Management Dashboard

## Overview

Implement a management-grade goal and reporting system within LeadEngine. The implementation follows a layered approach: database schema and RLS → TypeScript types → pure engine functions with property tests → server actions → CMS settings surfaces → management dashboard → integration and wiring. Each engine function is tested with property-based tests (fast-check) alongside implementation to catch errors early.

## Tasks

- [x] 1. Database schema, RLS policies, and permission registration
  - [x] 1.1 Create the goal management migration SQL file
    - Create `supabase/migrations/20260414_goal_management.sql` with all 14 goal-related tables:
    - `goals`, `goal_periods`, `goal_templates`, `template_versions`, `template_nodes`, `template_buckets`
    - `analytical_dimensions`, `segment_mappings`
    - `goal_settings`, `stage_weights`
    - `period_snapshots`, `snapshot_buckets`
    - `post_win_adjustments`, `saved_views`, `period_audit_log`
    - Include all constraints, CHECK constraints, partial unique indexes (e.g., one published version per template), and FK relationships as specified in the design Data Models section
    - Create indexes: `(goal_id, start_date)`, `(company_id, status)` on goal_periods; `(company_id, dimension_name)` unique on analytical_dimensions; `(company_id, pipeline_id, stage_id)` unique on stage_weights; `(period_id, revision)` unique on period_snapshots
    - Insert 5 new `app_modules` rows: `management_dashboard`, `goal_settings`, `goal_template`, `goal_period`, `forecast_settings`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 18.1_

  - [x] 1.2 Create RLS policies for all goal-related tables
    - In the same migration file or a separate `20260414_goal_management_rls.sql`:
    - Enable RLS on all 14 goal-related tables plus `period_audit_log`
    - Create SELECT/INSERT/UPDATE/DELETE policies using `fn_user_company_ids()` and `fn_user_has_holding_access()` pattern consistent with existing RLS model
    - Create the special `saved_views_select` policy with owner-only personal views and company-scoped shared views
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 2. Checkpoint — Verify migration
  - Ensure migration applies cleanly, all tables exist, RLS policies are active, and app_modules are registered. Ask the user if questions arise.

- [x] 3. TypeScript types for goal management
  - [x] 3.1 Create `src/types/goals.ts` with all goal-related TypeScript interfaces
    - Define all interfaces as specified in the design TypeScript Types section:
    - Core entities: `Goal`, `GoalInsert`, `GoalUpdate`, `GoalPeriod`, `GoalPeriodInsert`, `GoalPeriodUpdate`, `GoalTemplate`, `GoalTemplateInsert`, `TemplateVersion`, `TemplateNode`, `TemplateNodeUpdate`, `TemplateBucket`, `TemplateBucketUpdate`
    - Classification: `ClassificationRule`
    - Dimensions: `AnalyticalDimension`, `AnalyticalDimensionInsert`, `AnalyticalDimensionUpdate`, `SegmentMapping`, `SegmentMappingInsert`, `SegmentMappingUpdate`
    - Settings: `GoalSettings`, `GoalSettingsUpdate`, `StageWeight`, `StageWeightUpsert`
    - Snapshots: `PeriodSnapshot`, `SnapshotBucket`
    - Adjustments: `PostWinAdjustment`
    - Saved views: `SavedView`, `SavedViewConfig`, `SavedViewInsert`, `SavedViewUpdate`
    - Engine I/O: `LeadClassificationInput`, `BucketAssignment`, `AttributionSettings`, `LeadAttributionInput`, `AttainmentResult`, `ForecastResult`, `HierarchyRollup`, `LeadAttainmentInput`, `LeadForecastInput`
    - Audit: `PeriodAuditEntry`
    - _Requirements: 1.1–1.9_

  - [x] 3.2 Update `src/types/index.ts` to re-export from `goals.ts`
    - Add `export * from './goals'`
    - _Requirements: 1.1_


- [x] 4. Classification engine (pure function + property tests)
  - [x] 4.1 Implement the classification engine in `src/features/goals/lib/classification-engine.ts`
    - Implement `classifyLead(lead, nodes, buckets, dimensions, mappings): BucketAssignment[]`
    - For dimension-type nodes, resolve lead field values through segment mappings first
    - Evaluate bucket rules in priority_order ASC with AND logic across classification_rules
    - Each rule uses `is_one_of` operator: `lead[rule.field]` must be in `rule.values`
    - Assign to first matching non-fallback bucket; if none match, assign to fallback bucket
    - Return exactly one BucketAssignment per template node level
    - Handle edge cases: malformed rules (skip bucket, continue), missing lead fields (treat as non-match)
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write property test for classification completeness and determinism
    - Create `src/features/goals/lib/__tests__/classification-engine.property.test.ts`
    - **Property 3: Classification Completeness and Determinism**
    - For any lead and any template node with at least one fallback bucket, the engine assigns exactly one bucket. If multiple non-fallback buckets match, the one with lowest priority_order wins. If none match, fallback is assigned.
    - **Validates: Requirements 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x] 4.3 Implement overlap detection utility in `src/features/goals/lib/classification-engine.ts`
    - Add `detectOverlaps(buckets: TemplateBucket[]): OverlapWarning[]` function
    - Add `detectSegmentOverlaps(mappings: SegmentMapping[]): OverlapWarning[]` function
    - Return warnings when a single field value combination matches multiple non-fallback buckets, or a single source value appears in multiple segment mappings
    - _Requirements: 2.5, 3.6_

  - [ ]* 4.4 Write property test for overlap detection correctness
    - In the same test file `classification-engine.property.test.ts`
    - **Property 4: Overlap Detection Correctness**
    - For any set of bucket rules or segment mappings, overlap detection returns a warning if and only if at least one value appears in multiple non-fallback rules.
    - **Validates: Requirements 2.5, 3.6**

- [x] 5. Attribution engine (pure function + property tests)
  - [x] 5.1 Implement the attribution engine in `src/features/goals/lib/attribution-engine.ts`
    - Implement `attributeLeadToPeriod(lead, periods, settings): string | null`
    - Determine attributed_date based on `attribution_basis`: use `event_date_end` (fallback to `event_date_start`) for event_date basis, or `closed_won_date` for closed_won_date basis
    - Apply monthly cutoff logic: if day > effective cutoff, shift to next month's period
    - Support per-month cutoff overrides via `per_month_cutoffs` map
    - Find matching goal_period by date range; return period_id or null
    - Handle edge cases: null dates (return null), invalid cutoff (clamp to 28)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 5.2 Write property test for attribution period placement
    - Create `src/features/goals/lib/__tests__/attribution-engine.property.test.ts`
    - **Property 5: Attribution Engine Period Placement**
    - For any lead with a valid attributed date and a set of goal periods, the engine places the lead into the correct period based on basis and cutoff. If day > cutoff, lead is attributed to next month's period.
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 6. Attainment calculator (pure function + property tests)
  - [x] 6.1 Implement the attainment calculator in `src/features/goals/lib/attainment-calculator.ts`
    - Implement `calculateAttainment(leads, bucketAssignments): AttainmentResult`
    - Filter leads where `pipeline_stage.closed_status = 'won'`
    - Sum `actual_value` grouped by bucket assignment
    - Return total, by_bucket map, and lead_count
    - Exclude leads in any stage other than Closed Won
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.2 Write property test for attainment calculation correctness
    - Create `src/features/goals/lib/__tests__/attainment-calculator.property.test.ts`
    - **Property 6: Attainment Calculation Correctness**
    - For any set of leads and a target period, attainment equals the sum of actual_value from Closed Won leads attributed to that period. Non-won leads contribute zero.
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 7. Forecast calculator (pure function + property tests)
  - [x] 7.1 Implement the forecast calculator in `src/features/goals/lib/forecast-calculator.ts`
    - Implement `calculateForecast(leads, bucketAssignments, stageWeights, weightedEnabled): ForecastResult`
    - Filter leads in open pipeline stages only (exclude Closed Won and Lost)
    - Raw forecast: sum `estimated_value` (or `actual_value` where available)
    - Weighted forecast: multiply each lead's value by `stage_weight_percent / 100`
    - Return total_raw, total_weighted, by_bucket maps, and lead_count
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 7.2 Write property test for forecast exclusion correctness
    - Create `src/features/goals/lib/__tests__/forecast-calculator.property.test.ts`
    - **Property 7: Forecast Exclusion Correctness**
    - For any set of leads, forecast includes only open-stage leads (not Closed Won, not Lost). Raw total equals sum of estimated_value from these leads.
    - **Validates: Requirements 8.1, 8.7, 8.8**

  - [ ]* 7.3 Write property test for weighted forecast calculation
    - In the same test file `forecast-calculator.property.test.ts`
    - **Property 8: Weighted Forecast Calculation**
    - For any set of open-stage leads and stage weights, weighted forecast for each lead equals `value × weight / 100`, and total equals sum of individual weighted values.
    - **Validates: Requirements 8.2**

- [x] 8. Rollup engine (pure function + property tests)
  - [x] 8.1 Implement the rollup engine in `src/features/goals/lib/rollup-engine.ts`
    - Implement `rollUpHierarchy(nodes, bucketValues): HierarchyRollup`
    - Build tree from flat node list using parent_node_id references
    - Aggregate attainment, forecast_raw, forecast_weighted from leaf buckets up to root
    - Return nested `HierarchyRollup` structure with computed values at every level
    - _Requirements: 7.5, 20.1, 20.2, 20.3, 20.4_

  - [ ]* 8.2 Write property test for hierarchy rollup sum invariant
    - Create `src/features/goals/lib/__tests__/rollup-engine.property.test.ts`
    - **Property 9: Hierarchy Rollup Sum Invariant**
    - For any template hierarchy tree with computed leaf values, every parent node's value equals the sum of its children's values (within ±1 IDR tolerance). Holds for attainment, raw forecast, and weighted forecast independently.
    - **Validates: Requirements 7.5, 20.1, 20.2, 20.3, 20.4**

- [x] 9. Allocation, adjustment detection, and settings validation utilities
  - [x] 9.1 Implement target allocation utility in `src/features/goals/lib/allocation.ts`
    - Implement percentage-based allocation: distribute parent target across children by percentage
    - Implement history-based allocation: fallback chain (same period last year → previous comparable → manual)
    - Validate child targets sum to parent target within rounding tolerance
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 9.2 Write property test for percentage allocation sum constraint
    - Create `src/features/goals/lib/__tests__/allocation.property.test.ts`
    - **Property 12: Percentage Allocation Sum Constraint**
    - For any parent target and child percentages summing to 100%, resulting child amounts sum to parent target (within ±1 IDR).
    - **Validates: Requirements 10.2, 10.5**

  - [x] 9.3 Implement post-win adjustment detection in `src/features/goals/lib/adjustment-detection.ts`
    - Implement `detectCriticalFieldChange(oldLead, newLead, criticalFields): PostWinAdjustmentInput | null`
    - Compare old and new values for each field in the critical fields list
    - Return adjustment record if any critical field changed; null otherwise
    - Determine `affects_closed_period` by checking if lead's attributed date falls in a closed period
    - _Requirements: 9.1, 9.2, 9.4_

  - [ ]* 9.4 Write property test for post-win adjustment detection
    - Create `src/features/goals/lib/__tests__/adjustment-detection.property.test.ts`
    - **Property 10: Post-Win Adjustment Detection**
    - For any update to a Closed Won lead, if a reporting-critical field is modified, a post-win adjustment record is produced. If the lead's period is closed, `affects_closed_period` is true.
    - **Validates: Requirements 9.2, 9.4**

  - [x] 9.5 Implement goal settings validation in `src/features/goals/lib/goal-settings-validation.ts`
    - Implement `validateCriticalFieldUpdate(currentFields, newFields): { valid: boolean; error?: string }`
    - Enforce that the mandatory minimum set is always preserved: `{actual_value, event_date_start, event_date_end, project_name, company_id, pic_sales_id}`
    - Fields may be added but minimum set cannot be removed
    - _Requirements: 9.5, 9.6_

  - [ ]* 9.6 Write property test for minimum critical field set preservation
    - Create `src/features/goals/lib/__tests__/goal-settings-validation.property.test.ts`
    - **Property 11: Minimum Critical Field Set Preservation**
    - For any attempted update to the critical fields list, the resulting list always contains the mandatory minimum set.
    - **Validates: Requirements 9.6**

  - [x] 9.7 Implement template version management utility in `src/features/goals/lib/template-version.ts`
    - Implement `resolveVersionEditAction(version, closedPeriodIds): 'edit_in_place' | 'create_new_draft'`
    - If the version is adopted by any closed period, return `create_new_draft`; otherwise `edit_in_place`
    - Implement `publishVersion(versions): TemplateVersion[]` that sets one to published and archives previous published
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [ ]* 9.8 Write property tests for template version management
    - Create `src/features/goals/lib/__tests__/template-version.property.test.ts`
    - **Property 1: Single Published Version Invariant** — After publishing, exactly one version is published and all previously published are archived.
    - **Property 13: Version Protection for Closed-Period Adopted Versions** — Edit on a version adopted by a closed period produces a new draft, not a mutation.
    - **Validates: Requirements 1.5, 11.2, 11.4**

  - [ ]* 9.9 Write property test for fallback bucket invariant
    - Create `src/features/goals/lib/__tests__/template-validation.property.test.ts`
    - **Property 2: Fallback Bucket Invariant** — For any valid template node with a non-empty bucket list, exactly one bucket has `is_fallback = true`.
    - **Validates: Requirements 1.8**

- [x] 10. Checkpoint — Engine functions and property tests
  - Ensure all engine functions compile and all property tests pass. Ask the user if questions arise.

- [x] 11. Goal server actions
  - [x] 11.1 Create `src/app/actions/goal-actions.ts` with goal and period CRUD actions
    - Implement `createGoalAction`, `updateGoalAction` with Zod validation, permission checks (`goal_settings.manage`), and company_id scoping
    - Implement `createGoalPeriodAction` — validates published template version exists, sets status to 'open'
    - Implement `closeGoalPeriodAction` — permission check (`goal_period` update), generates snapshot via snapshot logic, sets status to 'closed', records audit log entry
    - Implement `reopenGoalPeriodAction` — permission check (`goal_period` delete as reopen), requires reason, creates new snapshot revision, records audit log entry
    - All actions follow existing `ActionResult` pattern and call `revalidatePath`
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.6, 5.7, 18.5, 18.6, 18.7_

  - [x] 11.2 Add template and version management actions to `goal-actions.ts`
    - Implement `createGoalTemplateAction`, `createTemplateVersionAction`, `publishTemplateVersionAction`
    - Publishing: set target version to 'published', archive any previously published version of the same template
    - Implement `updateTemplateNodeAction`, `updateTemplateBucketAction`
    - Prevent deletion of template versions referenced by goal periods
    - Permission checks using `goal_template.manage`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 11.1, 11.2, 11.3, 11.4, 11.5, 18.4_

  - [x] 11.3 Add analytical dimension and segment mapping actions to `goal-actions.ts`
    - Implement `createDimensionAction`, `updateDimensionAction`
    - Implement `createSegmentMappingAction`, `updateSegmentMappingAction`
    - Run overlap detection on save and include warnings in response (without blocking save)
    - Permission checks using `goal_settings.manage`
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 14.3, 14.5_

  - [x] 11.4 Add goal settings and stage weight actions to `goal-actions.ts`
    - Implement `updateGoalSettingsAction` — validates cutoff range (1–28), validates critical field minimum set preservation
    - Implement `updateStageWeightsAction` — validates weights 0–100, upserts stage_weights rows
    - Permission checks using `goal_settings.manage` and `forecast_settings.manage`
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 18.3, 18.8_

  - [x] 11.5 Add saved view actions to `goal-actions.ts`
    - Implement `createSavedViewAction`, `updateSavedViewAction`, `deleteSavedViewAction`
    - Personal views: owner can CRUD freely
    - Shared view deletion requires `goal_settings.manage` permission
    - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6_

  - [x] 11.6 Add target allocation action to `goal-actions.ts`
    - Implement `allocateTargetsAction(nodeId, mode, data)` — supports manual, percentage, and history modes
    - Percentage mode: validate percentages sum to 100%, distribute parent target
    - History mode: query historical attainment data, apply fallback chain
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. Snapshot server action
  - [x] 12.1 Create `src/app/actions/snapshot-actions.ts`
    - Implement `generatePeriodSnapshotAction(periodId)`
    - Fetch all leads attributed to the period using the attribution engine
    - Run classification engine to assign leads to buckets
    - Calculate attainment and forecast using the calculator engines
    - Run rollup engine for hierarchy aggregation
    - Create `period_snapshots` row with frozen totals and config (template_version_id, attribution_basis, cutoff config)
    - Create `snapshot_buckets` rows for each node/bucket combination
    - Wrap in a transaction — rollback on failure, period remains open
    - _Requirements: 5.2, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Extend lead-actions.ts for post-win adjustment hook
  - [x] 13.1 Extend `updateLeadAction` in `src/app/actions/lead-actions.ts`
    - Before applying updates to a Closed Won lead, check if any reporting-critical fields are being modified
    - If so, use `detectCriticalFieldChange` to create a `post_win_adjustments` record
    - Require special permission for critical field changes on won leads
    - Flag `affects_closed_period` if the lead's attributed date falls in a closed period
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 14. Checkpoint — Server actions
  - Ensure all server actions compile, permission checks are in place, and snapshot generation logic is wired. Ask the user if questions arise.

- [x] 15. Goal Settings CMS surface
  - [x] 15.1 Create the Goal Settings CMS shell and routing
    - Create `src/app/settings/goals/page.tsx` — Goal Settings landing page with tabbed sections
    - Create `src/features/goals/components/settings/goal-settings-page.tsx` — main shell component
    - Wrap with `PermissionGate` checking `goal_settings` read permission
    - _Requirements: 12.1, 12.7_

  - [x] 15.2 Implement period manager component
    - Create `src/features/goals/components/settings/period-manager.tsx`
    - Display goal periods in a data table with status, date range, and template version
    - Add create period form (goal selection, date range, template version selection)
    - Add close/reopen actions with confirmation dialogs (reopen requires reason input)
    - Wire to `createGoalPeriodAction`, `closeGoalPeriodAction`, `reopenGoalPeriodAction`
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 12.1_

  - [x] 15.3 Implement attribution and cutoff settings component
    - Create `src/features/goals/components/settings/attribution-settings.tsx`
    - Form for global attribution basis (event_date / closed_won_date radio)
    - Single global cutoff day input (1–28) with optional per-month override toggle
    - Per-month cutoff inputs (January–December) when override is enabled
    - Wire to `updateGoalSettingsAction`
    - _Requirements: 4.4, 12.2, 12.3_

  - [x] 15.4 Implement forecast settings component
    - Create `src/features/goals/components/settings/forecast-settings.tsx`
    - Toggle for weighted forecast enabled/disabled
    - Stage weight configuration: list pipelines, for each pipeline show stages with weight_percent input (0–100)
    - Support global default weights and pipeline-level overrides
    - Wire to `updateGoalSettingsAction` and `updateStageWeightsAction`
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 12.4, 12.5_

  - [x] 15.5 Implement critical fields and auto-lock settings components
    - Create `src/features/goals/components/settings/critical-fields-settings.tsx` — manage reporting-critical field list with add/remove (minimum set protected)
    - Create `src/features/goals/components/settings/auto-lock-settings.tsx` — auto-lock toggle and day offset configuration
    - Wire to `updateGoalSettingsAction`
    - _Requirements: 5.3, 9.5, 9.6, 12.6_

- [x] 16. Goal Template CMS surface
  - [x] 16.1 Create template list page and routing
    - Create `src/app/settings/goals/templates/page.tsx` — template list page
    - Create `src/features/goals/components/templates/template-list-page.tsx` — data table of templates with create button
    - Wire to `createGoalTemplateAction`
    - Wrap with `PermissionGate` checking `goal_template` read permission
    - _Requirements: 13.1, 13.8_

  - [x] 16.2 Create template version editor page and shell
    - Create `src/app/settings/goals/templates/[id]/page.tsx` — template detail/editor page
    - Create `src/features/goals/components/templates/template-editor.tsx` — version editor shell with version selector, publish button, and draft/published status
    - Wire to `createTemplateVersionAction`, `publishTemplateVersionAction`
    - _Requirements: 11.1, 11.2, 13.2_

  - [x] 16.3 Implement node tree component with drag-and-drop
    - Create `src/features/goals/components/templates/node-tree.tsx`
    - Display hierarchical node structure as a tree
    - Support drag-and-drop reordering of nodes
    - Allow adding nodes with dimension_type selection (analytical dimensions or ownership fields: company_id, pic_sales_id)
    - Wire to `updateTemplateNodeAction`
    - _Requirements: 13.2, 13.3_

  - [x] 16.4 Implement bucket rule builder and bucket list
    - Create `src/features/goals/components/templates/bucket-rule-builder.tsx` — rule builder UI for "is one of" conditions with AND combinations across lead fields
    - Create `src/features/goals/components/templates/bucket-list.tsx` — priority-ordered bucket list with drag-and-drop reordering, fallback bucket indicator
    - Run overlap detection on save and display warnings
    - Wire to `updateTemplateBucketAction`
    - _Requirements: 3.1, 3.6, 13.4, 13.5, 13.6, 13.7_

  - [x] 16.5 Implement target allocation panel
    - Create `src/features/goals/components/templates/target-allocation-panel.tsx`
    - Support manual, percentage, and history allocation modes
    - Percentage mode: input fields that must sum to 100%
    - History mode: display historical data and fallback chain
    - Wire to `allocateTargetsAction`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 17. Analytical Dimension CMS surface
  - [x] 17.1 Create dimension list page and routing
    - Create `src/app/settings/goals/dimensions/page.tsx` — dimension list page
    - Create `src/features/goals/components/dimensions/dimension-list-page.tsx` — data table of dimensions with create button
    - Wrap with `PermissionGate` checking `goal_settings` read permission
    - _Requirements: 14.1, 14.5_

  - [x] 17.2 Create dimension editor page with segment mapping form
    - Create `src/app/settings/goals/dimensions/[id]/page.tsx` — dimension detail page
    - Create `src/features/goals/components/dimensions/dimension-editor.tsx` — dimension detail form
    - Create `src/features/goals/components/dimensions/segment-mapping-form.tsx` — mapping rule form with segment name, multi-select source values, priority order
    - Run overlap detection on save and display warnings
    - Wire to `createDimensionAction`, `updateDimensionAction`, `createSegmentMappingAction`, `updateSegmentMappingAction`
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 17.3 Implement classification preview component
    - Create `src/features/goals/components/dimensions/classification-preview.tsx`
    - Fetch a sample of current leads and display how they would be classified under the configured mappings
    - Show segment assignment for each lead with visual indicators for unmapped leads
    - _Requirements: 14.4_

- [x] 18. Checkpoint — CMS surfaces
  - Ensure all CMS pages render, forms submit correctly, permission gates work, and overlap warnings display. Ask the user if questions arise.

- [x] 19. Management Dashboard — data hooks and core shell
  - [x] 19.1 Create dashboard data fetching hooks
    - Create `src/features/goals/hooks/use-goal-data.ts` — fetches attainment, forecast, and breakdown data for a selected period; for open periods calls engine functions on live data, for closed periods reads from snapshots
    - Create `src/features/goals/hooks/use-goal-periods.ts` — fetches goal period list with status for period selector
    - Create `src/features/goals/hooks/use-saved-views.ts` — CRUD hook for saved views
    - _Requirements: 5.4, 5.5, 15.5, 17.1, 17.4_

  - [x] 19.2 Create the management dashboard shell and routing
    - Create or update `src/app/dashboard/page.tsx` (or update `src/app/page.tsx` per design route structure) for the management dashboard route
    - Create `src/features/goals/components/dashboard/management-dashboard.tsx` — main dashboard shell with period selector, scope selector (holding → company drill-down), and widget grid layout
    - Default landing: holding-consolidated view
    - Wrap with `PermissionGate` checking `management_dashboard` read permission
    - _Requirements: 15.2, 15.5, 15.6, 15.7_

- [x] 20. Management Dashboard — widgets
  - [x] 20.1 Implement attainment and forecast summary widgets
    - Create `src/features/goals/components/dashboard/attainment-summary-widget.tsx` — displays total attainment vs target with progress indicator
    - Create `src/features/goals/components/dashboard/pipeline-widget.tsx` — displays raw pipeline value
    - Create `src/features/goals/components/dashboard/forecast-widget.tsx` — displays weighted forecast (if enabled)
    - Attainment and forecast values are always displayed separately
    - _Requirements: 15.1, 15.3_

  - [x] 20.2 Implement variance and trend widgets
    - Create `src/features/goals/components/dashboard/variance-widget.tsx` — gap between target and attainment, gap between target and attainment+forecast
    - Create `src/features/goals/components/dashboard/trend-widget.tsx` — historical trend chart across closed periods using snapshot data
    - _Requirements: 15.1, 15.4_

  - [x] 20.3 Implement breakdown widgets
    - Create `src/features/goals/components/dashboard/company-breakdown-widget.tsx` — attainment/forecast by company
    - Create `src/features/goals/components/dashboard/segment-breakdown-widget.tsx` — attainment/forecast by segment
    - Create `src/features/goals/components/dashboard/sales-contribution-widget.tsx` — attainment/forecast by sales owner
    - _Requirements: 15.1, 15.6, 20.1, 20.2, 20.3_

  - [x] 20.4 Implement exception list and drill-down panel
    - Create `src/features/goals/components/dashboard/exception-list-widget.tsx` — lists leads or segments with notable gaps or anomalies
    - Create `src/features/goals/components/dashboard/drill-down-panel.tsx` — filtered lead detail view shown when clicking a breakdown segment; supports filtering by period, company, segment, sales owner, and template
    - Clicking a lead navigates to existing lead detail page; clicking a company navigates to existing company detail page
    - _Requirements: 15.1, 16.1, 16.2, 16.3, 16.4_

  - [x] 20.5 Implement saved view selector and widget reordering
    - Create `src/features/goals/components/dashboard/saved-view-selector.tsx` — load/save/share view UI
    - Implement drag-and-drop widget reordering within the dashboard grid, persisted per user via saved view config
    - Wire to saved view actions
    - _Requirements: 16.5, 16.6, 17.1, 17.2, 17.3, 17.4_

  - [ ]* 20.6 Write unit tests for dashboard widgets
    - Test widget rendering with mock attainment/forecast data
    - Test variance calculation display
    - Test drill-down panel filtering behavior
    - _Requirements: 15.1, 15.3, 15.4, 16.1, 16.4_

- [x] 21. Dashboard export support
  - [x] 21.1 Implement drill-down data export
    - Add export functionality to the drill-down panel — export current filtered view to CSV/Excel
    - _Requirements: 16.5_

- [x] 22. Checkpoint — Dashboard
  - Ensure the management dashboard renders with all widgets, period/scope selection works, drill-down navigates correctly, and saved views persist. Ask the user if questions arise.

- [x] 23. Sidebar navigation and route wiring
  - [x] 23.1 Update sidebar navigation for goal management routes
    - Update `src/components/layout/sidebar.tsx` to add navigation entries:
    - "Dashboard" link pointing to the management dashboard route
    - Under Settings: "Goals" section with sub-links for Goal Settings, Templates, Dimensions
    - Use `PermissionGate` or `usePermissions()` to conditionally show links based on `management_dashboard` and `goal_settings` permissions
    - _Requirements: 15.7, 12.7, 13.8, 14.5, 18.2_

  - [x] 23.2 Create settings/goals layout and sub-navigation
    - Create `src/app/settings/goals/layout.tsx` if needed for shared sub-navigation across goal settings pages (periods, templates, dimensions)
    - Ensure consistent tab/link navigation between Goal Settings, Templates, and Dimensions pages
    - _Requirements: 12.1_

- [x] 24. Final checkpoint — Full integration
  - Ensure all routes are accessible, navigation works, permissions gate correctly, open periods show live data, closed periods show snapshot data, and the full close → snapshot → reopen → revision flow works end-to-end. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- All engine functions are pure TypeScript in `src/features/goals/lib/` for testability without database dependencies
- Server actions follow the existing `ActionResult` pattern from `lead-actions.ts`
- RLS is the security boundary — UI permission checks via `PermissionGate` and `usePermissions()` are convenience only
