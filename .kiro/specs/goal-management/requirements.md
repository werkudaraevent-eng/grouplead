# Requirements: Goal Management & Management Dashboard

## Introduction

This document specifies the requirements for a management-grade goal and reporting system within LeadEngine. The system enables Werkudara Group management to define revenue goals, break them down through configurable hierarchical templates and analytical dimensions, monitor attainment versus forecast, and review historical performance through snapshot-based closed-period reporting. The feature builds on the existing multi-company model, RBAC matrix, pipeline stages, and lead schema.

## Glossary

- **Goal**: A revenue target set at the holding or company level for a defined period.
- **Goal_Period**: A planning/reporting time window (monthly, quarterly, or yearly) with open or closed status.
- **Goal_Template**: A versioned hierarchical structure defining how a goal is broken down into levels and buckets.
- **Template_Version**: A specific draft or published snapshot of a Goal_Template.
- **Template_Node**: A level within a Goal_Template hierarchy (e.g., Company → Segment → Sales).
- **Template_Bucket**: A named grouping within a Template_Node, defined by classification rules (e.g., segment "BFSI").
- **Analytical_Dimension**: A rule-based classification used to analyze results, such as segment, line_industry, category, or lead_source.
- **Segment**: A custom Analytical_Dimension built from field-value mappings (e.g., line_industry values "Banking", "Finance" → segment "BFSI").
- **Segment_Mapping**: A rule that maps one or more lead field values to a named Segment.
- **Ownership_Hierarchy**: The path of target ownership through holding → company → sales owner, derived from existing lead fields.
- **Attribution_Basis**: The configured rule determining which date field places a lead into a Goal_Period (event date or closed won date).
- **Monthly_Cutoff**: The day-of-month boundary that determines whether a lead's attributed date falls into the current or next month's period.
- **Attainment**: Revenue already achieved, calculated only from Closed Won leads using actual_value.
- **Forecast**: Revenue still in pipeline, shown as raw pipeline value and optionally as weighted forecast.
- **Weighted_Forecast**: Pipeline value multiplied by configurable stage-level probability weights.
- **Period_Snapshot**: An immutable record of a closed Goal_Period's attainment, forecast, template version, and attribution state.
- **Reporting_Critical_Field**: A lead field whose post-win change materially affects goal attribution or period reporting.
- **Post_Win_Adjustment**: An audited record of changes to Reporting_Critical_Fields on Closed Won leads.
- **Saved_View**: A persisted set of dashboard filter, scope, and layout preferences.
- **Fallback_Bucket**: A mandatory catch-all bucket (e.g., "Others" or "Unmapped") that receives leads matching no other bucket at a given Template_Node level.
- **CMS**: The settings/configuration surfaces for managing goals, templates, dimensions, and periods.
- **Management_Dashboard**: The read-mostly decision-support surface displaying goal attainment, forecast, history, and drill-down analytics.

---

## Requirements

### Requirement 1: Goal Data Model

**User Story:** As a system architect, I want a canonical data model for goals, goal periods, templates, template versions, nodes, and buckets, so that the system can store and govern hierarchical revenue goal structures.

#### Acceptance Criteria

1. WHEN a goal is created, THE Goal_Service SHALL store it with a reference to company_id, period_type (monthly, quarterly, yearly), target_amount, and the creating user.
2. WHEN a Goal_Period is created, THE Goal_Service SHALL store it with goal_id, start_date, end_date, status (open or closed), and a reference to the adopted Template_Version.
3. WHEN a Goal_Template is created, THE Goal_Service SHALL store it with company_id, name, description, and created_by fields.
4. WHEN a Template_Version is created, THE Goal_Service SHALL store it with template_id, version_number, status (draft or published), and a structural snapshot of nodes and buckets.
5. THE Goal_Service SHALL enforce that each Goal_Template has at most one published Template_Version at any time.
6. WHEN a Template_Node is created, THE Goal_Service SHALL store it with template_version_id, parent_node_id (nullable for root), level_order, dimension_type, and display_name.
7. WHEN a Template_Bucket is created, THE Goal_Service SHALL store it with node_id, bucket_name, classification_rules (JSON), priority_order, is_fallback flag, and target_amount.
8. THE Goal_Service SHALL enforce that each Template_Node has exactly one Template_Bucket with is_fallback set to true.
9. WHEN any goal-related record is created or modified, THE Goal_Service SHALL set company_id for RLS-based company scoping consistent with the existing multi-company model.

---

### Requirement 2: Analytical Dimensions Engine

**User Story:** As a management admin, I want to define reusable analytical dimensions with rule-based field mappings, so that leads can be classified into higher-order groupings like segment without code changes.

#### Acceptance Criteria

1. WHEN an Analytical_Dimension is created, THE Dimension_Service SHALL store it with company_id, dimension_name, source_field (referencing a lead schema field), and description.
2. WHEN a Segment_Mapping is created, THE Dimension_Service SHALL store it with dimension_id, segment_name, match_values (array of source field values), and priority_order.
3. WHEN a lead is evaluated against a dimension, THE Dimension_Service SHALL apply Segment_Mappings in priority_order and assign the lead to the first matching segment.
4. IF no Segment_Mapping matches a lead's source field value, THEN THE Dimension_Service SHALL assign the lead to a configurable fallback segment (e.g., "Unmapped").
5. THE Dimension_Service SHALL surface an overlap warning to the admin when a single source field value appears in multiple Segment_Mappings within the same dimension.
6. WHEN a Segment_Mapping is modified, THE Dimension_Service SHALL apply the change only to open Goal_Periods; closed Goal_Periods SHALL retain their snapshot-based classifications.

---

### Requirement 3: Template Bucket Classification Rules

**User Story:** As a management admin, I want to define bucket classification rules using "is one of" conditions with AND combinations, so that leads are deterministically assigned to one bucket per template level.

#### Acceptance Criteria

1. WHEN a Template_Bucket rule is defined, THE Classification_Engine SHALL support "is one of" conditions on lead fields combined with AND logic across multiple fields.
2. WHEN a lead is evaluated against buckets at a Template_Node level, THE Classification_Engine SHALL apply bucket rules in priority_order and assign the lead to the highest-priority matching bucket.
3. THE Classification_Engine SHALL enforce the single-bucket rule: one lead belongs to exactly one bucket per Template_Node level.
4. IF multiple buckets match a lead at the same level, THEN THE Classification_Engine SHALL assign the lead to the bucket with the lowest priority_order value (highest priority).
5. IF no non-fallback bucket matches a lead, THEN THE Classification_Engine SHALL assign the lead to the Fallback_Bucket for that Template_Node.
6. WHEN bucket rules are saved, THE Classification_Engine SHALL validate for potential overlaps and surface warnings to the admin without blocking the save.

---

### Requirement 4: Period Attribution Engine

**User Story:** As a management admin, I want to configure how leads are attributed to goal periods based on event date or closed won date with a monthly cutoff rule, so that period placement matches the company's closing practice.

#### Acceptance Criteria

1. WHEN the Attribution_Basis is set to "event_date", THE Attribution_Engine SHALL use the lead's event_date_end field (for multi-day events) to determine period placement.
2. WHEN the Attribution_Basis is set to "closed_won_date", THE Attribution_Engine SHALL use the date the lead transitioned to Closed Won stage to determine period placement.
3. WHEN a Monthly_Cutoff day is configured (e.g., day 25), THE Attribution_Engine SHALL attribute leads with an attributed date after the cutoff day to the next month's period.
4. THE Attribution_Engine SHALL support a global default Attribution_Basis and Monthly_Cutoff that applies to all Goal_Templates unless overridden.
5. WHERE a Goal_Template specifies an override for Attribution_Basis or Monthly_Cutoff, THE Attribution_Engine SHALL use the template-level override instead of the global default.
6. WHEN a lead's attributed date falls within a closed Goal_Period, THE Attribution_Engine SHALL use the Period_Snapshot data instead of recalculating from live data.
7. THE Attribution_Engine SHALL support per-month cutoff configuration as an alternative to a single global cutoff day.

---

### Requirement 5: Goal Period Governance

**User Story:** As a management admin, I want to manage goal period lifecycle including creation, closing, auto-lock scheduling, and controlled reopening, so that period data integrity is maintained.

#### Acceptance Criteria

1. WHEN a Goal_Period is created, THE Period_Service SHALL set its status to "open" and associate it with a published Template_Version snapshot.
2. WHEN a Goal_Period is manually closed by an authorized user, THE Period_Service SHALL generate a Period_Snapshot and set the period status to "closed".
3. WHEN an auto-lock schedule is configured in CMS, THE Period_Service SHALL automatically close Goal_Periods according to the schedule and generate Period_Snapshots.
4. WHILE a Goal_Period status is "open", THE Period_Service SHALL serve live-calculated attainment and forecast data for that period.
5. WHILE a Goal_Period status is "closed", THE Period_Service SHALL serve data exclusively from the Period_Snapshot.
6. WHEN an authorized user reopens a closed Goal_Period, THE Period_Service SHALL capture the actor, reason, timestamp, and trigger a snapshot revision with recalculated data.
7. THE Period_Service SHALL maintain an audit trail for every close, reopen, and snapshot revision event on a Goal_Period.

---

### Requirement 6: Period Snapshot System

**User Story:** As a management user, I want closed periods to be snapshot-based, so that historical reports remain stable even when templates, dimensions, or mappings change later.

#### Acceptance Criteria

1. WHEN a Goal_Period is closed, THE Snapshot_Service SHALL capture and store the template version used, ownership attribution state, analytical dimension classifications, period attribution rules, attainment totals, and forecast totals.
2. WHEN a Period_Snapshot is created, THE Snapshot_Service SHALL make it immutable unless the period is formally reopened.
3. IF an admin modifies a Goal_Template, Analytical_Dimension, or Segment_Mapping after a period is closed, THEN THE Snapshot_Service SHALL preserve the closed period's snapshot data unchanged.
4. WHEN a closed Goal_Period is reopened and recalculated, THE Snapshot_Service SHALL create a new snapshot revision while retaining the previous revision for audit purposes.
5. THE Snapshot_Service SHALL store sufficient detail in each snapshot to reproduce the period's dashboard view without depending on current live configuration state.

---

### Requirement 7: Attainment Calculation

**User Story:** As a management user, I want attainment calculated exclusively from Closed Won leads using actual_value, so that achieved revenue is clearly separated from pipeline estimates.

#### Acceptance Criteria

1. THE Attainment_Service SHALL calculate attainment by summing actual_value from leads that have reached the Closed Won pipeline stage.
2. THE Attainment_Service SHALL exclude leads in any pipeline stage other than Closed Won from attainment calculations.
3. WHEN calculating attainment for a Goal_Period, THE Attainment_Service SHALL include only leads whose attributed date (per the Attribution_Engine) falls within the period's date range.
4. WHEN calculating attainment for a template bucket, THE Attainment_Service SHALL include only Closed Won leads that the Classification_Engine assigns to that bucket.
5. THE Attainment_Service SHALL roll up attainment values through the template hierarchy from leaf buckets to the root goal.
6. WHILE a Goal_Period is open, THE Attainment_Service SHALL calculate attainment from live lead data.
7. WHILE a Goal_Period is closed, THE Attainment_Service SHALL return attainment from the Period_Snapshot.

---

### Requirement 8: Forecast Calculation

**User Story:** As a management user, I want to see raw pipeline value and optionally weighted forecast separated from attainment, so that I can assess the realistic revenue outlook.

#### Acceptance Criteria

1. THE Forecast_Service SHALL calculate raw pipeline value by summing estimated_value (or actual_value where available) from leads in open pipeline stages (excluding Closed Won and Lost).
2. THE Forecast_Service SHALL calculate Weighted_Forecast by multiplying each open lead's value by the probability weight configured for its current pipeline stage.
3. WHEN weighted forecast is enabled in settings, THE Management_Dashboard SHALL display both raw pipeline and Weighted_Forecast values.
4. WHEN weighted forecast is disabled in settings, THE Management_Dashboard SHALL display only raw pipeline value.
5. THE Forecast_Service SHALL support global default stage weights configurable in CMS.
6. WHERE a pipeline specifies override stage weights, THE Forecast_Service SHALL use the pipeline-level weights instead of global defaults.
7. THE Forecast_Service SHALL never include Closed Won leads in forecast calculations.
8. THE Forecast_Service SHALL never include Lost leads in forecast calculations.

---

### Requirement 9: Post-Win Adjustment Tracking

**User Story:** As a management admin, I want changes to reporting-critical fields on Closed Won leads to be tracked as audited adjustments, so that closed-period history is not silently mutated.

#### Acceptance Criteria

1. THE Adjustment_Service SHALL define a protected minimum set of Reporting_Critical_Fields: actual_value, event_date_start, event_date_end, project_name, company_id, and pic_sales_id.
2. WHEN a Closed Won lead's Reporting_Critical_Field is modified, THE Adjustment_Service SHALL create a Post_Win_Adjustment record capturing the field name, old value, new value, actor, timestamp, and reason.
3. THE Adjustment_Service SHALL require special permission (beyond standard lead update) to modify Reporting_Critical_Fields on Closed Won leads.
4. WHEN a Post_Win_Adjustment affects a closed Goal_Period, THE Adjustment_Service SHALL flag the adjustment for review without automatically mutating the Period_Snapshot.
5. WHERE a super_admin extends the Reporting_Critical_Field list via CMS, THE Adjustment_Service SHALL apply the extended protection to newly added fields.
6. THE Adjustment_Service SHALL prevent removal of fields from the protected minimum set, even by super_admin.

---

### Requirement 10: Goal Target Allocation

**User Story:** As a management admin, I want to allocate target values to template nodes and buckets using manual entry, percentage-based distribution, or history-based automatic allocation, so that goal breakdowns reflect business planning intent.

#### Acceptance Criteria

1. WHEN a target allocation mode is set to "manual", THE Allocation_Service SHALL accept direct numeric target values for each Template_Bucket.
2. WHEN a target allocation mode is set to "percentage", THE Allocation_Service SHALL distribute the parent node's target across child buckets based on admin-entered percentages that sum to 100%.
3. WHEN a target allocation mode is set to "history", THE Allocation_Service SHALL distribute the parent node's target based on historical attainment data using the fallback chain: same period last year, then previous comparable period, then manual fallback if history is insufficient.
4. IF history-based allocation finds insufficient historical data, THEN THE Allocation_Service SHALL prompt the admin to provide manual fallback values.
5. THE Allocation_Service SHALL validate that child bucket targets sum to the parent node's target (within a configurable rounding tolerance).

---

### Requirement 11: Template Versioning and Period Adoption

**User Story:** As a management admin, I want templates to support draft and published versions with snapshot references on period adoption, so that later template edits do not mutate closed history.

#### Acceptance Criteria

1. WHEN a new Template_Version is created, THE Template_Service SHALL set its status to "draft".
2. WHEN an admin publishes a Template_Version, THE Template_Service SHALL set its status to "published" and set any previously published version of the same template to "archived".
3. WHEN a Goal_Period adopts a Template_Version, THE Period_Service SHALL store a versioned snapshot reference linking the period to the specific Template_Version.
4. IF an admin edits a published Template_Version that is already adopted by a closed Goal_Period, THEN THE Template_Service SHALL create a new draft version instead of modifying the adopted version.
5. THE Template_Service SHALL prevent deletion of a Template_Version that is referenced by any Goal_Period.

---

### Requirement 12: Goal Settings CMS

**User Story:** As a management admin, I want a Goal Settings CMS surface to manage goal periods, attribution defaults, cutoff settings, auto-lock schedules, forecast settings, and reporting-critical field extensions, so that governance configuration is centralized.

#### Acceptance Criteria

1. WHEN an admin navigates to the Goal Settings CMS, THE CMS SHALL display sections for: goal period management, global attribution basis, monthly cutoff configuration, auto-lock schedule, default forecast settings, and reporting-critical field management.
2. WHEN an admin modifies the global Attribution_Basis, THE CMS SHALL save the change and apply it to all Goal_Templates that do not have a template-level override.
3. WHEN an admin configures Monthly_Cutoff settings, THE CMS SHALL support both a single global cutoff day and per-month cutoff day configurations.
4. WHEN an admin enables or disables weighted forecast, THE CMS SHALL save the setting and THE Management_Dashboard SHALL reflect the change on next load.
5. WHEN an admin configures stage weights for weighted forecast, THE CMS SHALL validate that each weight is between 0 and 100 (inclusive, representing percentage probability).
6. WHEN an admin extends the Reporting_Critical_Field list, THE CMS SHALL add the field to the protected set while preserving the mandatory minimum set.
7. THE CMS SHALL restrict access based on the goal_settings.manage permission.

---

### Requirement 13: Goal Template CMS

**User Story:** As a management admin, I want a Goal Template CMS surface to manage templates, versions, hierarchical node structures, bucket rules, dimensions, fallback naming, and priority ordering, so that business breakdown structures are configurable without code changes.

#### Acceptance Criteria

1. WHEN an admin creates a Goal_Template, THE Template_CMS SHALL provide a form for template name, description, and initial hierarchical node structure.
2. WHEN an admin edits a Template_Version, THE Template_CMS SHALL display the node hierarchy as a tree with drag-and-drop reordering support.
3. WHEN an admin adds a Template_Node, THE Template_CMS SHALL allow selecting the dimension_type from available Analytical_Dimensions or ownership fields (company_id, pic_sales_id).
4. WHEN an admin defines Template_Bucket rules, THE Template_CMS SHALL provide a rule builder supporting "is one of" conditions with AND combinations across lead fields.
5. WHEN an admin sets bucket priority ordering, THE Template_CMS SHALL display buckets in priority order with drag-and-drop reordering.
6. WHEN an admin saves bucket rules, THE Template_CMS SHALL validate for overlaps and display warnings without blocking the save.
7. THE Template_CMS SHALL enforce that each Template_Node has exactly one Fallback_Bucket with a configurable display name.
8. THE Template_CMS SHALL restrict access based on the goal_template.manage permission.

---

### Requirement 14: Analytical Dimension CMS

**User Story:** As a management admin, I want an Analytical Dimension CMS surface to manage reusable custom dimensions and field-to-segment mappings, so that business groupings can evolve without code changes.

#### Acceptance Criteria

1. WHEN an admin creates an Analytical_Dimension, THE Dimension_CMS SHALL provide a form for dimension name, source lead field selection, and description.
2. WHEN an admin creates a Segment_Mapping, THE Dimension_CMS SHALL provide a form for segment name, source field values (multi-select from existing lead data values), and priority order.
3. WHEN an admin saves Segment_Mappings, THE Dimension_CMS SHALL validate for value overlaps across segments within the same dimension and display warnings.
4. THE Dimension_CMS SHALL display a preview of how current leads would be classified under the configured mappings.
5. THE Dimension_CMS SHALL restrict access based on the goal_settings.manage permission.

---

### Requirement 15: Management Dashboard — Core Widgets

**User Story:** As a management user, I want a Management Dashboard with a default widget set showing attainment, forecast, history, and breakdowns, so that I can quickly assess business performance.

#### Acceptance Criteria

1. WHEN a user navigates to the Management_Dashboard, THE Dashboard SHALL display the default widget set: goal attainment summary, raw pipeline, weighted forecast (if enabled), historical trend, breakdown by company, breakdown by segment, sales contribution, variance/gap indicators, and drill-down exception lists.
2. THE Dashboard SHALL display the holding-consolidated view as the default landing scope.
3. WHEN displaying attainment, THE Dashboard SHALL show attainment values separately from forecast values at all times.
4. WHEN displaying variance/gap indicators, THE Dashboard SHALL calculate the gap between target and attainment, and between target and attainment-plus-forecast.
5. THE Dashboard SHALL support period selection allowing the user to view data for any available Goal_Period.
6. THE Dashboard SHALL support scope selection allowing the user to drill down from holding to subsidiary/company to lower-level breakdowns.
7. THE Dashboard SHALL restrict access based on the management_dashboard.read permission.

---

### Requirement 16: Management Dashboard — Drill-Down and Interaction

**User Story:** As a management user, I want to drill down from dashboard widgets into lead, company, and contact details, so that I can investigate specific contributors to attainment or gaps.

#### Acceptance Criteria

1. WHEN a user clicks a breakdown segment on the Dashboard, THE Dashboard SHALL display a filtered detail view showing the leads contributing to that segment's attainment or forecast.
2. WHEN a user clicks a specific lead in a drill-down view, THE Dashboard SHALL navigate to the existing lead detail page.
3. WHEN a user clicks a company name in a breakdown widget, THE Dashboard SHALL navigate to the existing company detail page.
4. THE Dashboard SHALL support filtering by period, company, segment, sales owner, and template within drill-down views.
5. THE Dashboard SHALL support exporting the current drill-down view data to a downloadable format.
6. THE Dashboard SHALL allow widget reordering within the default widget set via drag-and-drop, persisted per user.

---

### Requirement 17: Saved Views

**User Story:** As a management user, I want to save and share dashboard view configurations, so that I can quickly return to frequently used perspectives.

#### Acceptance Criteria

1. WHEN a user saves a view, THE Saved_View_Service SHALL persist the selected period, scope/company selection, goal template, attribution basis, active filters, and widget layout ordering.
2. WHEN a user creates a saved view, THE Saved_View_Service SHALL store it as a personal view by default.
3. WHEN a user shares a saved view, THE Saved_View_Service SHALL make it available to other users who have management_dashboard.read permission within the same company scope.
4. WHEN a user loads a saved view, THE Dashboard SHALL apply all persisted filter, scope, and layout settings.
5. WHEN a user deletes a personal saved view, THE Saved_View_Service SHALL remove it immediately.
6. WHEN a user deletes a shared saved view, THE Saved_View_Service SHALL require the goal_settings.manage permission.

---

### Requirement 18: Goal-Specific Permissions

**User Story:** As a system administrator, I want dedicated goal-specific permissions registered in the RBAC matrix, so that goal management access is granular and does not rely on broad admin access.

#### Acceptance Criteria

1. WHEN the goal management feature is deployed, THE Permission_Service SHALL register the following app_modules: management_dashboard, goal_settings, goal_template, goal_period, and forecast_settings.
2. WHEN a user with management_dashboard.read permission (can_read >= 'company') accesses the Management_Dashboard, THE Permission_Service SHALL grant read access to dashboard data scoped to the user's company visibility.
3. WHEN a user with goal_settings.manage permission accesses the Goal Settings CMS, THE Permission_Service SHALL grant create, update, and read access to goal settings configuration.
4. WHEN a user with goal_template.manage permission accesses the Goal Template CMS, THE Permission_Service SHALL grant create, update, and read access to templates and versions.
5. WHEN a user with goal_period.manage permission manages goal periods, THE Permission_Service SHALL grant create and update access to goal period records.
6. WHEN a user with goal_period.close permission closes a goal period, THE Permission_Service SHALL allow the close operation and snapshot generation.
7. WHEN a user with goal_period.reopen permission reopens a closed goal period, THE Permission_Service SHALL allow the reopen operation with mandatory reason capture.
8. WHEN a user with forecast_settings.manage permission accesses forecast configuration, THE Permission_Service SHALL grant update access to stage weights and forecast toggle settings.
9. THE Permission_Service SHALL grant super_admin full access to all goal-specific permissions without explicit row entries.

---

### Requirement 19: RLS for Goal Data

**User Story:** As a security architect, I want RLS policies on all goal-related tables that enforce company-scoped data isolation with holding-level access, so that goal data follows the same security model as existing LeadEngine data.

#### Acceptance Criteria

1. WHEN a user queries goal-related tables, THE RLS_Policy SHALL only return records where company_id matches one of the user's company memberships.
2. WHEN a user has holding-level access (member of the holding company), THE RLS_Policy SHALL return goal-related records from all subsidiary companies.
3. WHEN a user attempts to insert or update goal-related records, THE RLS_Policy SHALL verify the user is a member of the target company_id.
4. THE RLS_Policy SHALL use the existing fn_user_company_ids() and fn_user_has_holding_access() helper functions for consistency with the current RLS model.
5. THE RLS_Policy SHALL be applied to all goal-related tables: goals, goal_periods, goal_templates, template_versions, template_nodes, template_buckets, analytical_dimensions, segment_mappings, period_snapshots, post_win_adjustments, and saved_views.

---

### Requirement 20: Ownership Hierarchy Roll-Up

**User Story:** As a management user, I want attainment and forecast to roll up through the ownership hierarchy (holding → company → sales owner), so that I can see contribution at every organizational level.

#### Acceptance Criteria

1. WHEN calculating attainment or forecast for a company-level node, THE Rollup_Service SHALL aggregate values from all leads where company_id matches the target company.
2. WHEN calculating attainment or forecast for a sales-owner-level node, THE Rollup_Service SHALL aggregate values from all leads where pic_sales_id matches the target sales owner.
3. WHEN calculating attainment or forecast for the holding-level node, THE Rollup_Service SHALL aggregate values from all leads across all subsidiary companies.
4. THE Rollup_Service SHALL ensure that roll-up totals at a parent node equal the sum of its child node values (within rounding tolerance).
5. WHEN a lead's company_id or pic_sales_id changes on an open-period lead, THE Rollup_Service SHALL reflect the updated ownership in the next calculation cycle.
