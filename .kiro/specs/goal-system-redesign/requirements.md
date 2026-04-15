# Requirements: Goal System Redesign (Phase 1)

## Introduction

This document specifies the requirements for simplifying the LeadEngine goal management system from 14 over-engineered tables down to approximately 4 core tables, while simultaneously fixing critical tenant isolation gaps on `contacts` and `client_companies`. The redesign follows the principle that Salesforce Forecasting uses ~4 tables and HubSpot Goals uses ~3 tables — LeadEngine should be comparable in complexity for its current maturity.

The current system suffers from premature abstraction: template versioning, snapshot-based period reporting, a mini BI engine (template_nodes + template_buckets + analytical_dimensions), and two parallel systems for breakdown targets (JSONB on goals + relational template_buckets). This redesign collapses the goal chain from 8 tables deep to a flat, JSONB-driven model where breakdown configuration lives directly on the goal, segments are stored as JSONB mappings, and stage weights are embedded in settings.

The redesign also addresses a critical security gap: `contacts` and `client_companies` currently lack `company_id` columns, meaning they have no tenant isolation via RLS. This must be fixed as part of this phase.

## Glossary

- **Goal_V2**: A simplified revenue target record combining the responsibilities of the old `goals`, `goal_settings`, and `goal_templates` tables into a single row per company goal. Stores breakdown configuration and breakdown targets as JSONB.
- **Goal_Segment**: A reusable segment definition that groups lead field values into named categories (e.g., line_industry values "Banking", "Finance" → segment "BFSI"). Replaces the old `analytical_dimensions` + `segment_mappings` two-table model with a single table using JSONB mappings.
- **Goal_User_Target**: A per-user target record linking a specific sales owner to a goal with a target amount for a defined period. Replaces the old `sales_targets` and user-level `template_buckets`.
- **Goal_Settings_V2**: A simplified one-row-per-company global settings record. Stores stage weights as JSONB instead of a separate `stage_weights` table. Stores reporting critical fields and auto-lock configuration.
- **Breakdown_Config**: A JSONB structure stored on Goal_V2 that defines the ordered list of breakdown levels and their field sources (e.g., `[{field: "company_id", label: "Subsidiary"}, {field: "pic_sales_id", label: "Sales Owner"}]`). Replaces the old `template_nodes` relational hierarchy.
- **Breakdown_Targets**: A JSONB structure stored on Goal_V2 that stores target allocations per breakdown path using nested `_target` keys. Replaces the old `template_buckets` target allocation system.
- **Segment_Mapping_Entry**: A JSON object within Goal_Segment's `mappings` JSONB array, containing `segment_name` and `match_values` fields.
- **Lead_Field_Registry**: The existing `src/config/lead-field-registry.ts` configuration that defines all analyzable lead fields, their value sources, and segmentation support.
- **Subsidiary**: An internal company within Werkudara Group (e.g., WNW, WNS, UK), represented by the `companies` table. Available as a breakdown dimension via the `company_id` field on leads.
- **Attribution_Basis**: The configured rule determining which date field places a lead into a goal period — either `event_date` (using `event_date_end`) or `closed_won_date`.
- **Monthly_Cutoff**: The day-of-month boundary that determines whether a lead's attributed date falls into the current or next month's period.
- **Attainment**: Revenue already achieved, calculated from Closed Won leads using `actual_value`.
- **Forecast**: Revenue still in pipeline, shown as raw pipeline value and optionally as weighted forecast using stage-level probability weights.
- **RLS**: Row Level Security — the authoritative access control boundary in LeadEngine, enforced via `fn_user_company_ids()` and `fn_user_has_holding_access()`.

---

## Requirements

### Requirement 1: Simplified Goal Table (goals_v2)

**User Story:** As a management admin, I want a single goal table that combines goal definition, breakdown configuration, and breakdown targets into one record, so that the goal chain is flat and easy to understand.

#### Acceptance Criteria

1. WHEN a goal is created, THE Goal_Service SHALL store it in `goals_v2` with `company_id`, `name`, `period_type` (monthly, quarterly, yearly), `target_amount`, `is_active`, `attribution_basis`, `monthly_cutoff_day`, and `created_by` fields.
2. WHEN a goal's breakdown structure is configured, THE Goal_Service SHALL store the breakdown level definitions in the `breakdown_config` JSONB column as an ordered array of objects containing `field` (lead field key or `segment:{segmentId}`) and `label` (display name).
3. WHEN target allocations are set per breakdown path, THE Goal_Service SHALL store them in the `breakdown_targets` JSONB column using nested objects with `_target` keys at each level.
4. THE Goal_Service SHALL support a `per_month_cutoffs` JSONB column for per-month cutoff day overrides as an alternative to the single `monthly_cutoff_day`.
5. THE Goal_Service SHALL support a `weighted_forecast_enabled` boolean column to control whether weighted forecast is displayed for the goal.
6. THE Goal_Service SHALL enforce a maximum of 10 breakdown levels in `breakdown_config`.
7. WHEN a goal is queried, THE Goal_Service SHALL return all configuration (breakdown structure, targets, attribution settings) in a single row without requiring joins to other tables.

---

### Requirement 2: Simplified Segment Definitions (goal_segments)

**User Story:** As a management admin, I want to define reusable segments with JSONB-based mappings in a single table, so that lead classification groupings are simple to manage without a separate mappings table.

#### Acceptance Criteria

1. WHEN a segment is created, THE Segment_Service SHALL store it in `goal_segments` with `company_id`, `name`, `source_field` (referencing a lead field from Lead_Field_Registry), and `fallback_name` (default segment for unmatched values).
2. THE Segment_Service SHALL store all segment mappings in a single `mappings` JSONB column as an array of Segment_Mapping_Entry objects, each containing `segment_name` and `match_values`.
3. WHEN a lead is evaluated against a segment definition, THE Segment_Service SHALL iterate the `mappings` array in order and assign the lead to the first matching segment whose `match_values` contains the lead's source field value.
4. IF no mapping matches a lead's source field value, THEN THE Segment_Service SHALL assign the lead to the `fallback_name` segment.
5. THE Segment_Service SHALL surface an overlap warning when a single source field value appears in multiple Segment_Mapping_Entry objects within the same segment definition.
6. THE Segment_Service SHALL enforce that `source_field` references a valid field from Lead_Field_Registry that supports segmentation (`supportsSegmentation: true`).

---

### Requirement 3: Per-User Goal Targets (goal_user_targets)

**User Story:** As a management admin, I want to assign individual revenue targets to sales users per goal and period, so that user-level performance tracking is connected to the goal system.

#### Acceptance Criteria

1. WHEN a user target is created, THE Target_Service SHALL store it in `goal_user_targets` with `goal_id` (referencing `goals_v2`), `user_id` (referencing `profiles`), `company_id`, `period_start`, `period_end`, and `target_amount`.
2. THE Target_Service SHALL enforce a unique constraint on `(goal_id, user_id, period_start)` to prevent duplicate targets for the same user, goal, and period.
3. WHEN user targets are queried for a goal, THE Target_Service SHALL return all user targets for the specified goal filtered by the requested period range.
4. THE Target_Service SHALL validate that `period_start` is before `period_end`.
5. THE Target_Service SHALL validate that `target_amount` is a non-negative number.

---

### Requirement 4: Simplified Goal Settings (goal_settings_v2)

**User Story:** As a management admin, I want a single settings row per company that includes stage weights as JSONB, so that global goal configuration does not require a separate stage weights table.

#### Acceptance Criteria

1. THE Settings_Service SHALL maintain one row per company in `goal_settings_v2` with `company_id`, `reporting_critical_fields` (text array), `auto_lock_enabled` (boolean), and `auto_lock_day_offset` (integer).
2. THE Settings_Service SHALL store stage weights in a `stage_weights` JSONB column as an object mapping `pipeline_id` → `stage_id` → `weight_percent` (integer 0-100).
3. WHEN stage weights are updated, THE Settings_Service SHALL validate that each `weight_percent` value is between 0 and 100 inclusive.
4. THE Settings_Service SHALL enforce a protected minimum set of `reporting_critical_fields`: `actual_value`, `event_date_start`, `event_date_end`, `project_name`, `company_id`, and `pic_sales_id`.
5. WHEN a super_admin extends the `reporting_critical_fields` list, THE Settings_Service SHALL add the field while preserving the mandatory minimum set.
6. THE Settings_Service SHALL prevent removal of fields from the protected minimum set.

---

### Requirement 5: Add company_id to contacts and client_companies

**User Story:** As a security architect, I want `contacts` and `client_companies` to have a `company_id` column with RLS enforcement, so that tenant isolation is consistent across all CRM data.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL add a `company_id` UUID column to the `contacts` table with a foreign key reference to `companies(id)`.
2. WHEN the migration runs, THE Migration SHALL add a `company_id` UUID column to the `client_companies` table with a foreign key reference to `companies(id)`.
3. WHEN the migration runs, THE Migration SHALL backfill `company_id` on existing `client_companies` records by deriving the value from related leads (using the most common `company_id` among leads referencing each client company).
4. WHEN the migration runs, THE Migration SHALL backfill `company_id` on existing `contacts` records by deriving the value from their linked `client_company_id`'s newly populated `company_id`.
5. WHEN the backfill is complete, THE Migration SHALL replace the existing permissive RLS policies on `contacts` with company-scoped policies using `fn_user_company_ids()` and `fn_user_has_holding_access()`.
6. WHEN the backfill is complete, THE Migration SHALL replace the existing permissive RLS policies on `client_companies` with company-scoped policies using `fn_user_company_ids()` and `fn_user_has_holding_access()`.
7. IF a `client_company` or `contact` has no related leads to derive `company_id` from, THEN THE Migration SHALL leave `company_id` as NULL and THE RLS_Policy SHALL still allow holding-level users to access those records.

---

### Requirement 6: Drop Old Goal Tables

**User Story:** As a system architect, I want the old 14-table goal schema removed after migration to the simplified schema, so that there is no confusion about which tables are canonical.

#### Acceptance Criteria

1. WHEN the redesign migration runs, THE Migration SHALL drop the following tables in dependency order: `snapshot_buckets`, `period_snapshots`, `period_audit_log`, `post_win_adjustments`, `template_buckets`, `template_nodes`, `template_versions`, `goal_templates`, `goal_periods`, `stage_weights`, `segment_mappings`, `analytical_dimensions`.
2. WHEN the old tables are dropped, THE Migration SHALL also drop associated RLS policies, indexes, and constraints.
3. THE Migration SHALL preserve the existing `goals` table data by migrating relevant fields into `goals_v2` before dropping.
4. THE Migration SHALL preserve the existing `goal_settings` table data by migrating relevant fields into `goal_settings_v2` before dropping.
5. THE Migration SHALL preserve the existing `analytical_dimensions` and `segment_mappings` data by migrating them into `goal_segments` JSONB format before dropping.
6. THE Migration SHALL preserve the `saved_views` table as-is (no changes needed).

---

### Requirement 7: RLS for New Goal Tables

**User Story:** As a security architect, I want RLS policies on all new goal tables that enforce company-scoped data isolation with holding-level read access, so that the simplified schema follows the same security model as the rest of LeadEngine.

#### Acceptance Criteria

1. WHEN a user queries `goals_v2`, THE RLS_Policy SHALL return records where `company_id` matches one of the user's company memberships or the user has holding-level access.
2. WHEN a user queries `goal_segments`, THE RLS_Policy SHALL return records where `company_id` matches one of the user's company memberships or the user has holding-level access.
3. WHEN a user queries `goal_user_targets`, THE RLS_Policy SHALL return records where `company_id` matches one of the user's company memberships or the user has holding-level access.
4. WHEN a user queries `goal_settings_v2`, THE RLS_Policy SHALL return records where `company_id` matches one of the user's company memberships or the user has holding-level access.
5. WHEN a user attempts to insert or update records in any new goal table, THE RLS_Policy SHALL verify the user is a member of the target `company_id`.
6. THE RLS_Policy SHALL use the existing `fn_user_company_ids()` and `fn_user_has_holding_access()` helper functions for consistency with the current RLS model.

---

### Requirement 8: Update TypeScript Types

**User Story:** As a developer, I want TypeScript types that reflect the new simplified schema, so that the codebase has a single source of truth for goal data shapes.

#### Acceptance Criteria

1. WHEN the redesign is implemented, THE Type_System SHALL define a `GoalV2` interface matching the `goals_v2` table schema, including typed `breakdown_config` and `breakdown_targets` JSONB fields.
2. WHEN the redesign is implemented, THE Type_System SHALL define a `GoalSegment` interface matching the `goal_segments` table schema, including a typed `mappings` JSONB field as an array of `{segment_name: string, match_values: string[]}`.
3. WHEN the redesign is implemented, THE Type_System SHALL define a `GoalUserTarget` interface matching the `goal_user_targets` table schema.
4. WHEN the redesign is implemented, THE Type_System SHALL define a `GoalSettingsV2` interface matching the `goal_settings_v2` table schema, including a typed `stage_weights` JSONB field.
5. THE Type_System SHALL define corresponding Insert and Update utility types for each interface.
6. WHEN the old types are replaced, THE Type_System SHALL remove all old goal-related interfaces (`Goal`, `GoalPeriod`, `GoalTemplate`, `TemplateVersion`, `TemplateNode`, `TemplateBucket`, `AnalyticalDimension`, `SegmentMapping`, `GoalSettings`, `StageWeight`, `PeriodSnapshot`, `SnapshotBucket`, `PostWinAdjustment`, `PeriodAuditEntry`).

---

### Requirement 9: Update Server Actions

**User Story:** As a developer, I want server actions rewritten to work with the new simplified schema, so that all mutations go through the correct tables.

#### Acceptance Criteria

1. WHEN the redesign is implemented, THE Goal_Actions SHALL provide `createGoalV2Action`, `updateGoalV2Action`, and `deleteGoalV2Action` functions that operate on the `goals_v2` table.
2. WHEN the redesign is implemented, THE Goal_Actions SHALL provide `upsertGoalSegmentAction`, `updateGoalSegmentAction`, and `deleteGoalSegmentAction` functions that operate on the `goal_segments` table.
3. WHEN the redesign is implemented, THE Goal_Actions SHALL provide `upsertGoalUserTargetAction` and `deleteGoalUserTargetAction` functions that operate on the `goal_user_targets` table.
4. WHEN the redesign is implemented, THE Goal_Actions SHALL provide `updateGoalSettingsV2Action` that operates on the `goal_settings_v2` table, including stage weight updates via the JSONB column.
5. WHEN the redesign is implemented, THE Goal_Actions SHALL remove all server actions that reference dropped tables (`goal_periods`, `goal_templates`, `template_versions`, `template_nodes`, `template_buckets`, `analytical_dimensions`, `segment_mappings`, `stage_weights`, `period_snapshots`, `snapshot_buckets`, `post_win_adjustments`, `period_audit_log`).
6. THE Goal_Actions SHALL validate `breakdown_config` has a maximum of 10 levels before saving.
7. THE Goal_Actions SHALL validate that `monthly_cutoff_day` is between 1 and 28 when provided.

---

### Requirement 10: Update Goal Settings UI

**User Story:** As a management admin, I want the Goal Settings page to work with the simplified schema, so that I can manage goals, segments, user targets, and settings through an intuitive interface.

#### Acceptance Criteria

1. WHEN an admin navigates to Goal Settings, THE Settings_Page SHALL display goal management (create, edit, delete goals) using the `goals_v2` table.
2. WHEN an admin configures a goal's breakdown, THE Settings_Page SHALL allow selecting up to 10 breakdown levels from Lead_Field_Registry fields and segment dimensions, with "Subsidiary" always available as a breakdown option.
3. WHEN an admin sets breakdown targets, THE Settings_Page SHALL save them as JSONB in the `breakdown_targets` column of `goals_v2`.
4. WHEN an admin configures attribution settings, THE Settings_Page SHALL save `attribution_basis` and `monthly_cutoff_day` directly on the `goals_v2` record.
5. WHEN an admin configures stage weights, THE Settings_Page SHALL save them as JSONB in the `stage_weights` column of `goal_settings_v2`.
6. WHEN an admin manages segments, THE Settings_Page SHALL link to the global Segment Settings page at `/settings/segments` (segments are not inside Goal Settings).
7. THE Settings_Page SHALL display values sourced from existing database data (master_options, client_companies fields) rather than free-text entry for breakdown and segment configuration.

---

### Requirement 11: Update Goal Breakdown UI

**User Story:** As a management admin, I want the goal breakdown tree view to work with the simplified JSONB-based breakdown config, so that I can see attainment by any combination of dimensions without the old template system.

#### Acceptance Criteria

1. WHEN a goal has `breakdown_config` defined, THE Breakdown_UI SHALL render a multi-level tree view showing attainment, pipeline value, and targets at each level.
2. WHEN a user expands a tree node, THE Breakdown_UI SHALL compute child nodes by filtering leads through the next breakdown level.
3. WHEN a user edits targets in the tree, THE Breakdown_UI SHALL serialize the changes into the `breakdown_targets` JSONB format and save via `updateGoalV2Action`.
4. THE Breakdown_UI SHALL read breakdown level definitions from `breakdown_config` on the `goals_v2` record instead of querying `template_nodes`.
5. THE Breakdown_UI SHALL read segment definitions from `goal_segments` instead of querying `analytical_dimensions` and `segment_mappings` separately.
6. THE Breakdown_UI SHALL support all value source types from Lead_Field_Registry: `master_options`, `leads_distinct`, `profiles`, `client_companies`, `client_company_field`, and `subsidiaries`.

---

### Requirement 12: Update Segment Settings UI

**User Story:** As a management admin, I want the Segment Settings page to work with the simplified `goal_segments` table, so that I can manage segment definitions with JSONB mappings.

#### Acceptance Criteria

1. WHEN an admin creates a segment definition, THE Segment_UI SHALL save it to `goal_segments` with the `mappings` JSONB array.
2. WHEN an admin adds or edits a mapping entry, THE Segment_UI SHALL update the `mappings` JSONB array on the `goal_segments` record.
3. WHEN an admin deletes a mapping entry, THE Segment_UI SHALL remove it from the `mappings` JSONB array.
4. THE Segment_UI SHALL display source field values from existing database data using the Lead_Field_Registry value source configuration.
5. THE Segment_UI SHALL validate for value overlaps across mapping entries within the same segment definition and display warnings.
6. THE Segment_UI SHALL allow configuring the `fallback_name` for each segment definition.

---

### Requirement 13: Update Pure Engine Functions

**User Story:** As a developer, I want the pure engine functions (classification, attribution, attainment, forecast, rollup) updated to work with the new simplified data structures, so that calculation logic is consistent with the new schema.

#### Acceptance Criteria

1. WHEN the classification engine evaluates a lead against segments, THE Classification_Engine SHALL accept `GoalSegment` objects with JSONB `mappings` instead of separate `AnalyticalDimension` and `SegmentMapping` records.
2. WHEN the attribution engine determines period placement, THE Attribution_Engine SHALL read `attribution_basis` and `monthly_cutoff_day` from the `GoalV2` record instead of a separate `goal_settings` table.
3. WHEN the attainment calculator computes revenue, THE Attainment_Service SHALL calculate attainment by summing `actual_value` from Closed Won leads, consistent with the existing calculation logic.
4. WHEN the forecast calculator computes pipeline value, THE Forecast_Service SHALL read stage weights from the `stage_weights` JSONB column on `goal_settings_v2` instead of querying the `stage_weights` table.
5. WHEN the rollup engine aggregates values, THE Rollup_Service SHALL traverse the `breakdown_config` JSONB levels on `GoalV2` instead of querying `template_nodes`.
6. THE Breakdown_Utils SHALL continue to support the `parseLegacyBreakdown` function for backward compatibility during migration.

---

### Requirement 14: Attainment and Forecast Calculation

**User Story:** As a management user, I want attainment and forecast calculated correctly against the new schema, so that dashboard numbers remain accurate after the redesign.

#### Acceptance Criteria

1. THE Attainment_Service SHALL calculate attainment by summing `actual_value` from leads that have reached the Closed Won pipeline stage.
2. THE Attainment_Service SHALL exclude leads in any pipeline stage other than Closed Won from attainment calculations.
3. WHEN calculating attainment for a breakdown node, THE Attainment_Service SHALL include only Closed Won leads that match the node's field value in the breakdown hierarchy.
4. THE Forecast_Service SHALL calculate raw pipeline value by summing `estimated_value` from leads in open pipeline stages (excluding Closed Won and Lost).
5. WHEN weighted forecast is enabled on a goal, THE Forecast_Service SHALL multiply each open lead's value by the probability weight configured for its current pipeline stage in `goal_settings_v2.stage_weights`.
6. THE Forecast_Service SHALL exclude Closed Won leads and Lost leads from forecast calculations.
7. THE Rollup_Service SHALL ensure that roll-up totals at a parent breakdown node equal the sum of its child node values within rounding tolerance.

---

### Requirement 15: Dashboard Widget Compatibility

**User Story:** As a management user, I want the existing dashboard widgets to continue working after the schema redesign, so that management reporting is not disrupted.

#### Acceptance Criteria

1. WHEN the dashboard loads goal data, THE Dashboard SHALL query `goals_v2` instead of the old `goals` + `goal_templates` + `template_versions` join chain.
2. WHEN the dashboard displays breakdown views, THE Dashboard SHALL read `breakdown_config` from `goals_v2` to determine the breakdown hierarchy.
3. WHEN the dashboard displays segment breakdowns, THE Dashboard SHALL read segment definitions from `goal_segments` instead of `analytical_dimensions` + `segment_mappings`.
4. WHEN the dashboard displays user-level performance, THE Dashboard SHALL read user targets from `goal_user_targets`.
5. WHEN the dashboard displays forecast data with weighted forecast enabled, THE Dashboard SHALL read stage weights from `goal_settings_v2.stage_weights` JSONB.
6. THE Dashboard SHALL continue to display attainment, pipeline value, and target columns for each breakdown node.

