# Requirements: Goal Node Tree

## Introduction

This document specifies the definitive architecture for LeadEngine's goal breakdown system. It replaces the current JSONB-based `breakdown_config` and `breakdown_targets` columns on `goals_v2` with a relational `goal_nodes` table that supports unlimited-depth recursive breakdown trees with percentage and absolute allocation modes.

The current system (implemented in the `goal-system-redesign` spec) stores breakdown hierarchies as JSONB arrays on `goals_v2`. While functional for flat breakdowns, this approach cannot express the real business hierarchy — subsidiaries with regions, regions with source clients, source clients with revenue streams — each with independent allocation modes and per-node target amounts that cascade when parents change.

This redesign introduces:
- A `goal_nodes` relational table with self-referencing `parent_node_id` FK for unlimited-depth trees
- `monthly_weights` JSONB on `goals_v2` for period-based target distribution (replacing the earlier `period_targets` concept)
- Updated `goal_user_targets` that attach to specific nodes rather than just goals
- Cross-module integration points for dashboard, leads, client companies, contacts, user management, subsidiaries, RBAC, and period selection

Tables preserved as-is: `goal_segments`, `goal_settings_v2`.

Tables modified: `goals_v2` (add `monthly_weights`, deprecate `breakdown_config`/`breakdown_targets`), `goal_user_targets` (add `node_id`).

New table: `goal_nodes`.

This is the final goal system architecture. It must not need to be redesigned again.

## Glossary

- **Goal_Node**: A row in the `goal_nodes` table representing one node in the breakdown tree. Each node has a `target_amount`, an `allocation_mode` governing its sibling group, a `reference_field` + `reference_value` for mapping to lead data, and a `parent_node_id` FK (NULL = direct child of the goal root).
- **Goal_V2**: The existing goal record in `goals_v2`. Retains `target_amount` as the root-level annual target. Gains `monthly_weights` JSONB for period distribution. `breakdown_config` and `breakdown_targets` are deprecated and will be removed after migration.
- **Monthly_Weights**: A JSONB object on `goals_v2` keyed by month number (1–12) with decimal weight values that sum to 1.0. Each node's monthly target = `node.target_amount × monthly_weight`. Example: `{"1": 0.02, "2": 0.04, ..., "12": 0.08}`.
- **Allocation_Mode**: Per sibling group, either `'percentage'` (admin inputs %, system computes `target_amount` from parent) or `'absolute'` (admin inputs amount, system computes % for display). Stored on each node; all siblings under the same parent share the same mode.
- **Reference_Field**: A string on `goal_nodes` identifying which lead field this node maps to (e.g., `'company_id'`, `'area'`, `'main_stream'`, `'segment:{id}'`, `'client_company_id'`). Used by the attribution engine to determine which leads contribute to this node.
- **Reference_Value**: The specific value of `reference_field` that this node matches (e.g., a subsidiary UUID, `'Jakarta'`, `'MICE'`). A lead contributes to a node when `lead[reference_field] == node.reference_value`.
- **Dimension_Type**: A descriptive label on `goal_nodes` indicating the semantic level (e.g., `'subsidiary'`, `'region'`, `'source_client'`, `'stream'`, `'custom'`). Not enforced as an enum — purely for display and grouping.
- **Cascade_Recalculation**: When a parent node's `target_amount` changes, all percentage-mode children recalculate their `target_amount` as `parent.target_amount × (percentage / 100)`. This cascades recursively through the entire subtree.
- **Goal_Segment**: The existing `goal_segments` table for lead classification. Nodes can reference segment values via `reference_field = 'segment:{segmentId}'`.
- **Goal_Settings_V2**: The existing company-level settings table with `stage_weights` JSONB. Unchanged.
- **Goal_User_Target**: The existing `goal_user_targets` table, extended with an optional `node_id` FK so targets can attach to any node in the tree (not just the goal root).
- **Ancestor_Path**: The ordered list of nodes from root to a given node. A lead contributes to a node if it matches the `reference_field`/`reference_value` of every ancestor in the path.
- **RLS**: Row Level Security enforced via `fn_user_company_ids()` and `fn_user_has_holding_access()`.
- **Lead_Field_Registry**: The existing `src/config/lead-field-registry.ts` defining all analyzable lead fields and their value sources.
- **Attainment**: Revenue achieved from Closed Won leads using `actual_value`.
- **Forecast**: Revenue in pipeline from open-stage leads using `estimated_value`, optionally weighted by stage probability.
- **Period_Selector**: A UI control for filtering views by week, month, quarter, year, or custom date range. Target for the selected period = `node.target_amount × sum(monthly_weights for months in range)`.

---

## Requirements

### Requirement 1: Goal Nodes Relational Table

**User Story:** As a management admin, I want a relational table for goal breakdown nodes with self-referencing parent FK, so that I can build unlimited-depth hierarchical breakdowns without JSONB nesting limitations.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL create a `goal_nodes` table with columns: `id` (UUID PK), `created_at`, `updated_at`, `goal_id` (FK to `goals_v2`), `parent_node_id` (self-referencing FK to `goal_nodes`, NULL for root-level children), `name` (text), `dimension_type` (text), `reference_field` (text), `reference_value` (text), `allocation_mode` (text, CHECK IN `'percentage'`, `'absolute'`), `percentage` (numeric, nullable), `target_amount` (numeric(18,2)), `sort_order` (integer), and `company_id` (FK to `companies`).
2. THE Goal_Node_Service SHALL enforce that `parent_node_id` references a node within the same `goal_id` — cross-goal parent references are invalid.
3. THE Goal_Node_Service SHALL enforce that all sibling nodes (nodes sharing the same `parent_node_id`) use the same `allocation_mode`.
4. WHEN `allocation_mode` is `'percentage'`, THE Goal_Node_Service SHALL store the admin-entered percentage in the `percentage` column and compute `target_amount` as `parent_target × (percentage / 100)`.
5. WHEN `allocation_mode` is `'absolute'`, THE Goal_Node_Service SHALL store the admin-entered amount in `target_amount` and compute `percentage` as `(target_amount / parent_target) × 100` for display purposes.
6. THE Goal_Node_Service SHALL support trees of unlimited depth with no hardcoded maximum level constraint.
7. THE Goal_Node_Service SHALL create indexes on `(goal_id)`, `(parent_node_id)`, and `(goal_id, parent_node_id)` for efficient tree traversal queries.

---

### Requirement 2: Cascade Recalculation

**User Story:** As a management admin, I want child node targets to automatically recalculate when a parent node's target changes, so that the tree stays internally consistent without manual updates at every level.

#### Acceptance Criteria

1. WHEN a node's `target_amount` changes and the node has percentage-mode children, THE Cascade_Service SHALL recalculate each child's `target_amount` as `new_parent_target × (child.percentage / 100)`.
2. THE Cascade_Service SHALL apply recalculation recursively through the entire subtree — if a recalculated child also has percentage-mode children, those grandchildren recalculate as well.
3. WHEN a node's `target_amount` changes and the node has absolute-mode children, THE Cascade_Service SHALL recalculate each child's display `percentage` as `(child.target_amount / new_parent_target) × 100` without changing the child's `target_amount`.
4. WHEN the goal root `target_amount` on `goals_v2` changes, THE Cascade_Service SHALL trigger cascade recalculation starting from all root-level nodes (nodes with `parent_node_id = NULL`).
5. THE Cascade_Service SHALL perform all recalculations within a single database transaction to prevent inconsistent intermediate states.
6. WHEN cascade recalculation completes, THE Cascade_Service SHALL verify that the sum of root-level node targets does not exceed the goal's `target_amount` and return a warning if it does.

---

### Requirement 3: Monthly Weights on Goal Root

**User Story:** As a management admin, I want to define monthly weight percentages on the goal, so that each node's target can be distributed across months for period-based reporting without storing separate monthly targets per node.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL add a `monthly_weights` JSONB column to `goals_v2` with a default value of `'{}'::jsonb`.
2. THE Goal_Service SHALL store monthly weights as an object keyed by month number strings (`"1"` through `"12"`) with decimal values representing the fraction of the annual target for that month.
3. THE Goal_Service SHALL validate that all weight values in `monthly_weights` are non-negative numbers.
4. THE Goal_Service SHALL validate that the sum of all twelve weights equals 1.0 within a tolerance of 0.001.
5. WHEN `monthly_weights` is empty or null, THE Goal_Service SHALL treat each month as equal weight (`1/12` per month).
6. WHEN a node's target for a specific month is requested, THE Target_Calculator SHALL compute it as `node.target_amount × monthly_weights[month]`.
7. WHEN a node's target for a quarter is requested, THE Target_Calculator SHALL compute it as `node.target_amount × sum(monthly_weights for the three months in that quarter)`.
8. WHEN a node's target for a custom date range is requested, THE Target_Calculator SHALL compute it by summing full-month weights for months fully within the range and pro-rating partial months at the boundaries.

---

### Requirement 4: Node-Level Lead Attribution

**User Story:** As a management user, I want each node to define which lead field and value it maps to, so that the system can automatically compute which leads contribute revenue to each node.

#### Acceptance Criteria

1. THE Goal_Node_Service SHALL store `reference_field` and `reference_value` on each node to define the lead-to-node mapping.
2. WHEN computing attainment for a node, THE Attribution_Engine SHALL include only leads where the lead's value for `reference_field` equals the node's `reference_value` AND the lead also matches all ancestor nodes' `reference_field`/`reference_value` pairs up to the root.
3. WHEN `reference_field` starts with `'segment:'`, THE Attribution_Engine SHALL classify the lead using the referenced Goal_Segment's mappings before comparing to `reference_value`.
4. WHEN `reference_field` references a field with `valueSource.type = 'client_company_field'` in Lead_Field_Registry, THE Attribution_Engine SHALL resolve the value from the lead's joined `client_company` record.
5. WHEN `reference_field` is `'company_id'`, THE Attribution_Engine SHALL match against the lead's `company_id` (subsidiary).
6. WHEN `reference_field` is `'pic_sales_id'`, THE Attribution_Engine SHALL match against the lead's `pic_sales_id` (sales owner).
7. THE Attribution_Engine SHALL support all fields defined in Lead_Field_Registry as valid `reference_field` values.

---

### Requirement 5: Updated Goal User Targets

**User Story:** As a management admin, I want to assign user targets to specific nodes in the tree (not just the goal root), so that a sales user's target can be scoped to their subsidiary, region, or stream.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL add a `node_id` UUID column to `goal_user_targets` with a FK reference to `goal_nodes(id)` ON DELETE SET NULL, defaulting to NULL.
2. WHEN a user target has `node_id` set, THE Target_Service SHALL scope that user's target to the specified node's subtree.
3. WHEN a user target has `node_id = NULL`, THE Target_Service SHALL treat it as a goal-level target (backward compatible with existing data).
4. THE Target_Service SHALL validate that the referenced `node_id` belongs to the same `goal_id` as the user target.
5. WHEN user targets are displayed on a user's profile, THE User_Profile SHALL show the node name and path alongside the target amount.

---

### Requirement 6: Dashboard Integration

**User Story:** As a management user, I want the dashboard to read from the goal_nodes tree and show attainment vs target per node with period filtering, so that I can monitor performance at any level of the hierarchy.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Dashboard SHALL fetch the goal_nodes tree for the selected goal and compute attainment and forecast per node.
2. THE Dashboard SHALL display a tree-based breakdown widget where each node shows: name, target amount, attainment (Closed Won actual_value), pipeline value, attainment percentage, and a progress indicator.
3. WHEN a period is selected (week, month, quarter, year, custom range), THE Dashboard SHALL compute the period-specific target for each node using `node.target_amount × sum(applicable monthly_weights)`.
4. WHEN a period is selected, THE Dashboard SHALL filter leads using the existing Attribution_Engine with the period boundaries before computing per-node attainment and forecast.
5. THE Dashboard SHALL support drill-down from any node to see its children, with attainment and forecast computed for the child level.
6. WHEN the company switcher selects a specific subsidiary, THE Dashboard SHALL filter the tree to show only the subtree rooted at nodes matching that subsidiary's `company_id`.

---

### Requirement 7: Lead Pipeline Integration

**User Story:** As a sales user, I want to see which goal node(s) a lead contributes to and track my personal target progress, so that I understand how my deals connect to company goals.

#### Acceptance Criteria

1. WHEN a lead is viewed in the lead detail page, THE Lead_Detail SHALL display the goal node path(s) the lead contributes to, determined by matching the lead's field values against the ancestor path of each leaf node.
2. WHEN a sales user views their pipeline, THE Pipeline_View SHALL show a summary of their personal target progress (attainment vs goal_user_target) for the current period.
3. THE Lead_Attribution_Service SHALL trace a lead's contribution by walking the goal_nodes tree from root to leaves, checking `reference_field`/`reference_value` matches at each level.
4. WHEN a lead's classification fields change (e.g., `company_id`, `pic_sales_id`, `main_stream`), THE Lead_Attribution_Service SHALL recompute which nodes the lead contributes to.

---

### Requirement 8: Client Company Revenue Attribution

**User Story:** As a management user, I want revenue from client companies to flow into the correct goal nodes, so that nodes referencing client company fields (e.g., `line_industry`, `client_company_id`) reflect accurate revenue.

#### Acceptance Criteria

1. WHEN a goal node has `reference_field = 'client_company_id'`, THE Attribution_Engine SHALL match leads whose `client_company_id` equals the node's `reference_value`.
2. WHEN a goal node has `reference_field = 'line_industry'`, THE Attribution_Engine SHALL resolve the value from the lead's joined `client_company.line_industry` field.
3. WHEN a client company's detail page is viewed, THE Client_Company_Detail SHALL display the total revenue attributed to goal nodes that reference that client company.
4. THE Attribution_Engine SHALL handle leads with NULL `client_company_id` by excluding them from nodes that reference client company fields.

---

### Requirement 9: Contact Association via Client Company

**User Story:** As a management user, I want contacts linked to client companies to inherit the company's goal node association for contextual display, so that contact pages show relevant goal context.

#### Acceptance Criteria

1. WHEN a contact is linked to a client company, THE Contact_Detail SHALL display the goal node associations inherited from the contact's `client_company_id`.
2. THE Contact_Detail SHALL show the inherited association as read-only context — contacts do not directly contribute revenue to nodes.
3. IF a contact has no linked client company, THEN THE Contact_Detail SHALL display no goal node association.

---

### Requirement 10: User Management Integration

**User Story:** As a management admin, I want goal_user_targets visible on user profiles with a sales target assignment UI, so that admins can manage individual targets and users can see their goals.

#### Acceptance Criteria

1. WHEN an admin views a user's profile in User Management, THE User_Profile SHALL display all `goal_user_targets` for that user, including the associated goal name, node name (if `node_id` is set), period, and target amount.
2. THE User_Management_UI SHALL provide an interface to create, edit, and delete `goal_user_targets` for any user, with a node picker that shows the goal_nodes tree for node selection.
3. WHEN a sales user views their own profile, THE User_Profile SHALL display their assigned targets and current attainment for each target.
4. THE User_Management_UI SHALL validate that assigned `node_id` values belong to the same `goal_id` as the target.

---

### Requirement 11: Subsidiary-Level Node Filtering

**User Story:** As a subsidiary manager, I want the company switcher to filter the goal tree to my subsidiary's subtree, so that I see only the breakdown relevant to my business unit.

#### Acceptance Criteria

1. WHEN a user switches to a specific subsidiary via the company switcher, THE Goal_Tree_View SHALL filter to show only nodes where the root-level ancestor has `reference_field = 'company_id'` AND `reference_value` matches the selected subsidiary's ID.
2. WHEN a user is in holding view, THE Goal_Tree_View SHALL display the complete tree across all subsidiaries.
3. THE Goal_Tree_View SHALL preserve the filtered subtree's internal hierarchy — filtering to a subsidiary shows that subsidiary's full depth of children.
4. WHEN RLS restricts a user to specific companies, THE Goal_Tree_View SHALL only display subtrees for companies the user has access to.

---

### Requirement 12: RBAC and RLS for Goal Nodes

**User Story:** As a security architect, I want RLS on goal_nodes that cascades from goals_v2.company_id, with role-based UI restrictions for tree management vs viewing, so that the node tree follows the same security model as the rest of LeadEngine.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL enable RLS on `goal_nodes` with SELECT policy allowing access when `company_id` matches `fn_user_company_ids()` OR `fn_user_has_holding_access()` returns true.
2. THE RLS_Policy SHALL enforce INSERT, UPDATE, and DELETE policies on `goal_nodes` requiring `company_id` to match `fn_user_company_ids()`.
3. WHEN a user with `goal_settings.manage` permission accesses the goal tree, THE UI SHALL allow creating, editing, reordering, and deleting nodes.
4. WHEN a user with `management_dashboard.read` permission (but not `goal_settings.manage`) accesses the goal tree, THE UI SHALL display the tree in read-only mode.
5. WHEN a user with `staff` role views the dashboard, THE UI SHALL show only their personal target progress and the nodes relevant to their assigned targets.
6. THE RLS_Policy SHALL use the existing `fn_user_company_ids()` and `fn_user_has_holding_access()` helper functions for consistency with the current RLS model.

---

### Requirement 13: Period Selector Integration

**User Story:** As a management user, I want to filter all goal views by week, month, quarter, or year using monthly_weights for target calculation, so that I can analyze performance for any time window.

#### Acceptance Criteria

1. THE Period_Selector SHALL provide preset options: "This Week", "This Month", "This Quarter", "This Year".
2. THE Period_Selector SHALL provide a "Custom Range" option allowing arbitrary start and end date selection.
3. WHEN a period is selected, THE Period_Selector SHALL compute `period_start` and `period_end` dates based on the current date and the selected preset.
4. WHEN a period is selected, THE Target_Calculator SHALL compute the period-specific target for any node as `node.target_amount × sum(monthly_weights for months overlapping the period)`.
5. WHEN "This Week" is selected, THE Target_Calculator SHALL pro-rate the monthly weight by the fraction of the week's days falling within each month.
6. WHEN a custom range spans multiple months, THE Target_Calculator SHALL sum full-month weights for months fully within the range and pro-rate partial months at the boundaries.
7. WHEN no period is selected (default), THE views SHALL display the full annual target and include all leads without period filtering.

---

### Requirement 14: Segment Integration with Goal Nodes

**User Story:** As a management admin, I want goal nodes to reference segment values via `reference_field = 'segment:{segmentId}'`, so that the existing goal_segments classification system integrates with the node tree.

#### Acceptance Criteria

1. WHEN a goal node has `reference_field` starting with `'segment:'`, THE Attribution_Engine SHALL extract the segment ID, look up the corresponding Goal_Segment, and classify the lead's raw field value using the segment's mappings.
2. THE Attribution_Engine SHALL compare the classified segment name against the node's `reference_value` to determine if the lead matches.
3. WHEN building the node tree editor, THE Node_Editor SHALL allow selecting segment dimensions and display available segment values from the referenced Goal_Segment's mappings plus the fallback name.
4. THE Node_Editor SHALL validate that the referenced segment ID exists in `goal_segments` for the same company.

---

### Requirement 15: Goal Node Tree Editor UI

**User Story:** As a management admin, I want a tree editor UI to create and manage the goal_nodes hierarchy with drag-and-drop reordering, allocation mode selection, and target entry, so that I can build the breakdown structure visually.

#### Acceptance Criteria

1. THE Node_Editor SHALL display the goal_nodes tree as an expandable/collapsible hierarchy with indentation reflecting depth.
2. THE Node_Editor SHALL allow adding child nodes to any existing node, with a form for: name, dimension_type, reference_field, reference_value, and target (amount or percentage depending on allocation_mode).
3. THE Node_Editor SHALL allow selecting the allocation_mode (percentage or absolute) per sibling group — changing one sibling's mode changes all siblings under the same parent.
4. WHEN allocation_mode is `'percentage'`, THE Node_Editor SHALL display percentage inputs and auto-compute target amounts from the parent's target.
5. WHEN allocation_mode is `'absolute'`, THE Node_Editor SHALL display amount inputs and auto-compute percentages for display.
6. THE Node_Editor SHALL display a warning when the sum of sibling targets (percentage or absolute) does not equal the parent's target.
7. THE Node_Editor SHALL support reordering nodes within a sibling group via `sort_order`.
8. THE Node_Editor SHALL support deleting a node and all its descendants with a confirmation dialog.
9. THE Node_Editor SHALL populate `reference_value` options from the appropriate data source based on `reference_field` (subsidiaries from `companies`, sales owners from `profiles`, master options, client companies, segment values from `goal_segments`).

---

### Requirement 16: Migration from JSONB Breakdown to Relational Nodes

**User Story:** As a system architect, I want the migration to convert existing `breakdown_config` and `breakdown_targets` JSONB data into `goal_nodes` rows, so that existing goal configurations are preserved.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL read each `goals_v2` record's `breakdown_config` and `breakdown_targets` JSONB columns.
2. THE Migration SHALL create `goal_nodes` rows for each level in `breakdown_config`, using the field key as `reference_field` and each target key in `breakdown_targets` as a separate node with `reference_value` set to the key and `target_amount` set to the `_target` value.
3. THE Migration SHALL set `allocation_mode` to `'absolute'` for all migrated nodes (since the existing JSONB targets are absolute amounts).
4. THE Migration SHALL set `parent_node_id` based on the nesting structure in `breakdown_targets` — top-level keys become root nodes, nested keys become children.
5. THE Migration SHALL set `dimension_type` based on the `label` field in `breakdown_config` entries.
6. AFTER migration completes successfully, THE Migration SHALL mark `breakdown_config` and `breakdown_targets` as deprecated (nullable, no longer written to by the application).
7. THE Migration SHALL be idempotent — running it multiple times produces the same result without duplicating nodes.

---

### Requirement 17: Goal Node CRUD Server Actions

**User Story:** As a developer, I want server actions for creating, updating, deleting, and reordering goal nodes, so that the tree can be managed through the standard action pattern.

#### Acceptance Criteria

1. THE Goal_Actions SHALL provide a `createGoalNodeAction(data)` function that creates a node, validates sibling allocation_mode consistency, and triggers cascade recalculation if the parent has percentage-mode children.
2. THE Goal_Actions SHALL provide an `updateGoalNodeAction(nodeId, data)` function that updates a node's fields and triggers cascade recalculation for the affected subtree.
3. THE Goal_Actions SHALL provide a `deleteGoalNodeAction(nodeId)` function that deletes a node and all its descendants, then recalculates sibling percentages if needed.
4. THE Goal_Actions SHALL provide a `reorderGoalNodesAction(nodeIds)` function that updates `sort_order` for a set of sibling nodes.
5. THE Goal_Actions SHALL validate that `reference_field` references a valid field from Lead_Field_Registry or a valid `segment:{id}` pattern.
6. THE Goal_Actions SHALL validate that all siblings under the same parent share the same `allocation_mode`.
7. THE Goal_Actions SHALL validate that `percentage` values are between 0 and 100 when `allocation_mode` is `'percentage'`.
8. THE Goal_Actions SHALL validate that `target_amount` is non-negative.

---

### Requirement 18: Updated TypeScript Types

**User Story:** As a developer, I want TypeScript types for goal_nodes and updated types for goals_v2 and goal_user_targets, so that the codebase has type safety for the new relational tree model.

#### Acceptance Criteria

1. THE Type_System SHALL define a `GoalNode` interface with fields: `id`, `created_at`, `updated_at`, `goal_id`, `parent_node_id`, `name`, `dimension_type`, `reference_field`, `reference_value`, `allocation_mode`, `percentage`, `target_amount`, `sort_order`, `company_id`.
2. THE Type_System SHALL define `GoalNodeInsert` and `GoalNodeUpdate` utility types.
3. THE Type_System SHALL add `monthly_weights` field to the `GoalV2` interface typed as `Record<string, number> | null`.
4. THE Type_System SHALL add `node_id` field to the `GoalUserTarget` interface typed as `string | null`.
5. THE Type_System SHALL define a `GoalNodeTree` interface for the in-memory tree representation with `children: GoalNodeTree[]` for recursive rendering.
6. THE Type_System SHALL define `AllocationMode` as a union type: `'percentage' | 'absolute'`.

---

### Requirement 19: Attainment and Forecast per Node

**User Story:** As a management user, I want attainment and forecast computed per node in the tree, with parent nodes equaling the sum of their children, so that the tree provides a complete revenue picture at every level.

#### Acceptance Criteria

1. THE Attainment_Service SHALL compute attainment for a node by summing `actual_value` from Closed Won leads that match the node's full ancestor path (all `reference_field`/`reference_value` pairs from root to node).
2. THE Forecast_Service SHALL compute forecast for a node by summing `estimated_value` from open-stage leads (excluding Closed Won and Lost) that match the node's full ancestor path.
3. WHEN weighted forecast is enabled, THE Forecast_Service SHALL multiply each open lead's value by the stage weight from `goal_settings_v2.stage_weights`.
4. THE Rollup_Service SHALL verify that a parent node's attainment equals the sum of its children's attainment values within rounding tolerance of 0.01.
5. THE Rollup_Service SHALL verify that a parent node's forecast equals the sum of its children's forecast values within rounding tolerance of 0.01.
6. WHEN a period filter is active, THE Attainment_Service SHALL include only leads attributed to the selected period using the existing Attribution_Engine.

---

### Requirement 20: Monthly Weights Editor UI

**User Story:** As a management admin, I want a UI to set monthly weight percentages for a goal, so that I can define how the annual target distributes across months.

#### Acceptance Criteria

1. THE Weights_Editor SHALL display a grid of 12 months with editable weight fields showing percentage values.
2. THE Weights_Editor SHALL display the running total of all weights and warn when the total does not equal 100%.
3. THE Weights_Editor SHALL provide an "Equal Distribution" button that sets all 12 months to `1/12` (8.33%).
4. THE Weights_Editor SHALL display the computed monthly target amount (`goal.target_amount × weight`) next to each month's weight for reference.
5. WHEN the user saves monthly weights, THE Weights_Editor SHALL write the values to the `monthly_weights` JSONB column on `goals_v2` via `updateGoalV2Action`.
6. THE Weights_Editor SHALL validate that all weight values are non-negative before saving.
7. THE Weights_Editor SHALL use the existing `CurrencyInput` component for displaying computed IDR amounts.


---

### Requirement 21: Per-Node Monthly Targets

**User Story:** As a management admin, I want to set per-node monthly target overrides, so that individual nodes can have custom monthly distributions that differ from the goal-level monthly weights.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration SHALL add a `monthly_targets` JSONB column to `goal_nodes` with a default value of `'{}'::jsonb`.
2. THE Goal_Node_Service SHALL store per-node monthly targets as an object keyed by month number strings (`"1"` through `"12"`) with absolute amount values for that node in that month.
3. WHEN a node has a non-empty `monthly_targets` object, THE Target_Calculator SHALL use `monthly_targets[month]` as the node's target for that month instead of computing `node.target_amount × goal.monthly_weights[month]`.
4. WHEN a node has an empty or null `monthly_targets` object, THE Target_Calculator SHALL fall back to computing `node.target_amount × goal.monthly_weights[month]`.
5. THE Goal_Node_Service SHALL validate and warn (but not block) when the sum of a node's 12 monthly target values does not equal the node's `target_amount`.
6. THE Matrix_Grid SHALL allow independent editing of each cell (node × month) — cells are NOT forced to equal distribution.
7. WHEN a cell in the matrix grid is edited, THE Matrix_Grid SHALL update only that specific node's `monthly_targets[month]` value without affecting other months or other nodes.

---

### Requirement 22: Matrix Grid UI

**User Story:** As a management admin, I want a spreadsheet-like matrix grid for goal breakdown, so that I can see and edit all nodes × months in a single view with hierarchy, amounts, and percentages.

#### Acceptance Criteria

1. THE Matrix_Grid SHALL display rows as the node hierarchy (expandable/collapsible, indented by level) and columns as months within the configured timeframe.
2. THE Matrix_Grid SHALL display each cell with the node's target amount for that month (top) and the percentage of the parent node's target for that month (bottom).
3. WHEN a user clicks a cell, THE Matrix_Grid SHALL allow editing by entering either an amount or a percentage — the other value auto-computes.
4. THE Matrix_Grid SHALL provide a Display Metrics toggle with options: Nominal only, Percent only, or Both.
5. THE Matrix_Grid SHALL display a Hierarchy Levels bar showing the configured dimension levels (e.g., Event Type → Market → Planner Team) with an "+ Add Level" action.
6. THE Matrix_Grid SHALL provide a Timeframe Setup control (date range picker) for selecting which months appear as columns.
7. THE Matrix_Grid SHALL display computed Q Total (quarterly sum) and YTD Total (year-to-date sum) columns after the month columns.
8. THE Matrix_Grid SHALL support expanding and collapsing rows to show/hide child nodes in the hierarchy.
9. WHEN a parent cell is edited and its children use percentage-mode allocation, THE Matrix_Grid SHALL cascade the change to children cells in the same month proportionally.
10. THE Matrix_Grid SHALL display month columns ONLY as the column axis — months are never a dimension in the row hierarchy tree.

---

### Requirement 23: Dedicated Goals Route

**User Story:** As a management user, I want a dedicated `/goals` route in the sidebar navigation, so that I can access the primary matrix view page separately from the advanced goal configuration in `/settings/goals`.

#### Acceptance Criteria

1. THE Navigation SHALL add a `/goals` route to the sidebar, positioned below Pipeline and above Companies, using a Target/crosshair icon.
2. THE `/goals` route SHALL serve as the primary matrix view page — separate from `/settings/goals` which remains for advanced configuration.
3. THE `/goals` route SHALL be permission gated: `management_dashboard.read` for viewing, `goal_settings.manage` for editing.

---

### Requirement 24: Goal Configuration Side Panel

**User Story:** As a management admin, I want a slide-out configuration panel triggered from the matrix page header, so that I can manage goal overview, monthly weight distribution, hierarchy structure, and allocation mode defaults without leaving the matrix view.

#### Acceptance Criteria

1. THE Goal_Config_Panel SHALL be triggered by a "Manage Goal Configuration" button in the matrix page header.
2. THE Goal_Config_Panel SHALL be a 540px slide-from-right panel with a backdrop overlay.
3. THE Goal_Config_Panel SHALL contain: Goal Overview (name, period, year, total target, status), Monthly Weight Distribution grid, Hierarchy Structure (drag-to-reorder levels), and Allocation Mode default toggle.
4. WHEN the user clicks Save, THE Goal_Config_Panel SHALL trigger cascade recalculation via server actions.

---

### Requirement 25: Inline Cell Editing

**User Story:** As a management admin, I want to double-click a cell in the matrix grid to enter inline edit mode with keyboard navigation, so that I can quickly edit targets without opening separate dialogs.

#### Acceptance Criteria

1. WHEN a user double-clicks a target cell, THE Matrix_Grid SHALL enter edit mode with auto-focus and select-all on the input.
2. THE Matrix_Grid SHALL respect the node's `allocation_mode`: percentage input → compute amount, or amount input → compute percentage.
3. WHEN the user presses Enter, THE Matrix_Grid SHALL save the value and trigger cascade recalculation of children.
4. WHEN the user presses Escape, THE Matrix_Grid SHALL cancel the edit and revert to the previous value.
5. WHEN the user presses Tab, THE Matrix_Grid SHALL save the current cell and move focus to the next cell right. Shift+Tab SHALL move focus to the previous cell left.
6. THE Matrix_Grid SHALL display a flash green highlight animation on the cell after a successful save.
7. THE Matrix_Grid SHALL restrict cell editing to users with admin or super_admin roles only.
8. THE Matrix_Grid SHALL ensure that actual revenue cells and summary rows are NEVER editable.

---

### Requirement 26: Right-Click Context Menu

**User Story:** As a management admin, I want a right-click context menu on hierarchy rows, so that I can quickly perform node operations like editing, adding children, assigning sales persons, duplicating, or deleting nodes.

#### Acceptance Criteria

1. WHEN a user right-clicks on a hierarchy row, THE Matrix_Grid SHALL display a context menu with options: Edit Node Name, Switch to Absolute/Percentage Mode (toggles children's allocation mode), Add Child Node, Assign Sales Person (opens user picker), Duplicate Branch (copy node + all children), and Delete Node (red, with confirmation dialog).
2. THE Context_Menu SHALL use standard styling: white background, border, shadow, and hover highlight.

---

### Requirement 27: Unallocated and Over-Allocated Row Display

**User Story:** As a management admin, I want visual indicators when child node allocations don't match the parent target, so that I can immediately see allocation gaps or overages.

#### Acceptance Criteria

1. WHEN the sum of children's targets is less than the parent target, THE Matrix_Grid SHALL display an "Unallocated" row with amber background, ⚠ icon, italic text, showing the gap amount per month.
2. WHEN the sum of children's targets exceeds the parent target, THE Matrix_Grid SHALL display an "Over-allocated by Rp X" row with red background, ⚠ icon — this is a blocking error.
3. THE Unallocated/Over-allocated rows SHALL NOT be expandable and NOT be editable.

---

### Requirement 28: Attainment Cell Coloring

**User Story:** As a management user, I want cells in the matrix grid to be color-tinted based on attainment performance, so that I can visually scan which nodes are on track, at risk, or underperforming.

#### Acceptance Criteria

1. FOR past months where actual data exists, THE Matrix_Grid SHALL apply subtle background tints to cells: ≥100% of target → green tint (`rgba(16,185,129, 0.06)`), 70-99% → indigo tint (`rgba(99,102,241, 0.04)`), 40-69% → amber tint (`rgba(245,158,11, 0.06)`), <40% → red tint (`rgba(239,68,68, 0.05)`).
2. FOR future months (target only), THE Matrix_Grid SHALL apply no attainment coloring.
3. FOR the current month, THE Matrix_Grid SHALL display a left border of 2px accent color to highlight the current period.

---

### Requirement 29: Export View

**User Story:** As a management user, I want to export the current matrix view as a CSV file, so that I can share goal breakdowns with stakeholders who don't have system access.

#### Acceptance Criteria

1. THE Matrix_Page SHALL provide an "Export View" button in the page header.
2. WHEN the user clicks "Export View", THE Matrix_Page SHALL export the current matrix view (with current timeframe and display metrics) as a CSV file.
3. THE CSV export SHALL include hierarchy indentation in row names (e.g., "  East" for L2), all visible month columns, Q totals, and YTD totals.
