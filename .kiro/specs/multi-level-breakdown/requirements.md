# Requirements: Multi-Level Goal Breakdown

## Introduction

This document specifies the requirements for upgrading the Goal Breakdown feature in LeadEngine from a single-level flat table to a multi-level hierarchical tree view. Currently, the admin selects one breakdown field (e.g., "Client Company") and sees a flat table of values with targets, won revenue, and pipeline. The multi-level breakdown allows the admin to define up to 10 hierarchical levels (e.g., Company → Line Industry → Sales Owner → Category → ...), view data in an expandable/collapsible tree, and set targets at every node in the tree. This feature reuses the existing Lead Field Registry, `fetchFieldValues()` utility, and the `breakdown_targets` JSONB column on the `goals` table — no new database tables are required.

## Glossary

- **Breakdown_Level**: A single dimension in the hierarchy chain, defined by selecting a field from the Lead_Field_Registry (e.g., `client_company_id`, `line_industry`, `pic_sales_id`). Maximum 10 levels.
- **Breakdown_Structure**: The ordered list of Breakdown_Levels that defines the hierarchy (e.g., [Company, Line Industry, Sales Owner]).
- **Tree_Node**: A single row in the hierarchical tree view, representing a specific value at a specific Breakdown_Level (e.g., "WNW" at level 1, "Banking" at level 2).
- **Leaf_Node**: A Tree_Node at the deepest Breakdown_Level that has no children.
- **Parent_Node**: A Tree_Node that contains child Tree_Nodes at the next Breakdown_Level.
- **Breakdown_Tree**: The complete expandable/collapsible tree UI showing all Tree_Nodes across all Breakdown_Levels.
- **Lead_Field_Registry**: The existing configuration (`src/config/lead-field-registry.ts`) defining 15 analyzable lead fields with their value sources.
- **Goal_Breakdown_Component**: The existing UI component (`src/features/goals/components/settings/goal-breakdown.tsx`) that renders the breakdown section on the Goal Settings page.
- **Breakdown_Targets_JSONB**: The existing `breakdown_targets` JSONB column on the `goals` table used to persist level configuration and per-node target amounts.
- **Analytical_Dimension**: An existing rule-based classification (from the goal management spec) that maps lead field values to higher-order groupings like segments.
- **Segment_Mapping**: An existing rule that maps source field values to a named segment within an Analytical_Dimension.

---

## Requirements

### Requirement 1: Breakdown Level Configuration

**User Story:** As a management admin, I want to define a breakdown structure of up to 3 ordered levels by selecting fields from the Lead Field Registry, so that I can create a hierarchical view of goal attainment.

#### Acceptance Criteria

1. WHEN the admin opens the Goal Breakdown section, THE Goal_Breakdown_Component SHALL display the current Breakdown_Structure as a horizontal chain of level selectors (dropdown fields connected by arrow indicators).
2. WHEN the admin clicks the "Add Level" button, THE Goal_Breakdown_Component SHALL append a new level selector dropdown to the Breakdown_Structure.
3. THE Goal_Breakdown_Component SHALL enforce a maximum of 10 Breakdown_Levels in the Breakdown_Structure.
4. WHILE the Breakdown_Structure contains 10 Breakdown_Levels, THE Goal_Breakdown_Component SHALL hide or disable the "Add Level" button.
5. WHEN the admin selects a field for a Breakdown_Level, THE Goal_Breakdown_Component SHALL populate the dropdown options from the Lead_Field_Registry active fields and available Analytical_Dimensions.
6. THE Goal_Breakdown_Component SHALL prevent the admin from selecting the same field for multiple Breakdown_Levels within the same Breakdown_Structure.
7. WHEN the admin clicks the remove button on a Breakdown_Level, THE Goal_Breakdown_Component SHALL remove that level and all levels below it from the Breakdown_Structure.
8. WHEN the admin changes the Breakdown_Structure, THE Goal_Breakdown_Component SHALL persist the updated level configuration to the Breakdown_Targets_JSONB column on the selected goal.

---

### Requirement 2: Hierarchical Tree View Rendering

**User Story:** As a management admin, I want to see the breakdown data in an expandable/collapsible tree view with indentation showing hierarchy depth, so that I can drill down into progressively more specific groupings.

#### Acceptance Criteria

1. WHEN the Breakdown_Structure has multiple levels, THE Goal_Breakdown_Component SHALL render the data as a Breakdown_Tree with expandable/collapsible rows instead of a flat table.
2. WHEN a Parent_Node row is collapsed, THE Goal_Breakdown_Component SHALL display a collapsed indicator (▶) and hide all descendant Tree_Nodes.
3. WHEN a Parent_Node row is expanded, THE Goal_Breakdown_Component SHALL display an expanded indicator (▼) and show the immediate child Tree_Nodes.
4. THE Goal_Breakdown_Component SHALL indent child Tree_Nodes visually to indicate hierarchy depth relative to their parent.
5. WHEN the Breakdown_Structure has only 1 level, THE Goal_Breakdown_Component SHALL render the data as a flat table (preserving current single-level behavior).
6. THE Goal_Breakdown_Component SHALL display each Tree_Node row with: name, target amount, won revenue, pipeline value, percentage of target, and a progress bar.
7. WHEN the tree is first loaded, THE Goal_Breakdown_Component SHALL render all top-level (level 1) Tree_Nodes in collapsed state by default.

---

### Requirement 3: Multi-Level Data Aggregation

**User Story:** As a management admin, I want the tree to aggregate lead data correctly across all levels, so that parent nodes show the sum of their children's values.

#### Acceptance Criteria

1. WHEN computing values for a Leaf_Node, THE Goal_Breakdown_Component SHALL aggregate won revenue and pipeline value from leads matching that specific combination of field values across all Breakdown_Levels in the path from root to leaf.
2. WHEN computing values for a Parent_Node, THE Goal_Breakdown_Component SHALL sum the won revenue and pipeline values of all its direct child Tree_Nodes.
3. THE Goal_Breakdown_Component SHALL ensure that the sum of all level-1 Tree_Node won revenue values equals the total won revenue displayed in the goal summary.
4. WHEN a lead's field value is null or unassigned for a given Breakdown_Level, THE Goal_Breakdown_Component SHALL classify that lead under an "Unassigned" Tree_Node at that level.
5. WHEN the Breakdown_Structure includes an Analytical_Dimension level, THE Goal_Breakdown_Component SHALL resolve lead values through the existing Segment_Mapping rules and assign unmatched leads to the dimension's configured fallback segment.

---

### Requirement 4: Multi-Level Target Editing

**User Story:** As a management admin, I want to set target amounts at every node in the tree (not just leaf nodes), so that I can define targets at the company level, the industry level, and the individual sales owner level.

#### Acceptance Criteria

1. WHEN the admin clicks "Edit Targets", THE Goal_Breakdown_Component SHALL switch to edit mode and make the target column editable for all Tree_Nodes at every level.
2. WHILE in edit mode, THE Goal_Breakdown_Component SHALL display a currency input field for each Tree_Node's target amount.
3. WHEN the admin modifies a Tree_Node's target, THE Goal_Breakdown_Component SHALL display a running sub-target total for each Parent_Node showing the sum of its children's targets.
4. WHEN the admin saves targets, THE Goal_Breakdown_Component SHALL persist the hierarchical target structure to the Breakdown_Targets_JSONB column using a nested object format that preserves the tree structure.
5. WHEN the admin saves targets, THE Goal_Breakdown_Component SHALL display a warning if the sum of level-1 Tree_Node targets does not equal the goal's total target amount.
6. IF the sum of a Parent_Node's children targets does not equal the Parent_Node's own target, THEN THE Goal_Breakdown_Component SHALL display a visual indicator (over/under amount) next to that Parent_Node.
7. WHEN the admin cancels edit mode, THE Goal_Breakdown_Component SHALL discard all unsaved target changes and restore the previously saved values.

---

### Requirement 5: Breakdown Target Persistence Format

**User Story:** As a system architect, I want the multi-level breakdown configuration and targets stored in a well-defined JSONB structure, so that the data model remains backward-compatible with the existing single-level breakdown.

#### Acceptance Criteria

1. WHEN the Breakdown_Structure is saved, THE Goal_Breakdown_Component SHALL store the ordered list of level field keys in a `levels` array within the Breakdown_Targets_JSONB (e.g., `["client_company_id", "line_industry", "pic_sales_id"]`).
2. WHEN hierarchical targets are saved, THE Goal_Breakdown_Component SHALL store them in a nested `targets` object within the Breakdown_Targets_JSONB, where each node's target is stored under a `_target` key and child nodes are nested objects keyed by their field value.
3. THE Goal_Breakdown_Component SHALL maintain backward compatibility: when the `levels` array is absent or has length 1, the component SHALL fall back to the existing single-level flat table behavior using the legacy `breakdown_field` and `by_{field}` keys.
4. WHEN the admin changes the Breakdown_Structure (adds, removes, or reorders levels), THE Goal_Breakdown_Component SHALL reset the `targets` object to avoid stale target data from a previous structure.

---

### Requirement 6: Value Resolution Across Levels

**User Story:** As a management admin, I want each level in the breakdown to correctly resolve its values from the appropriate source (master_options, client_companies, profiles, or leads), so that the tree shows meaningful labels at every level.

#### Acceptance Criteria

1. WHEN a Breakdown_Level uses a field with `valueSource` type "client_companies", THE Goal_Breakdown_Component SHALL display client company names as Tree_Node labels and use company IDs as keys.
2. WHEN a Breakdown_Level uses a field with `valueSource` type "profiles", THE Goal_Breakdown_Component SHALL display profile full names as Tree_Node labels and use profile UUIDs as keys.
3. WHEN a Breakdown_Level uses a field with `valueSource` type "master_options", THE Goal_Breakdown_Component SHALL display option labels as Tree_Node labels and use option values as keys.
4. WHEN a Breakdown_Level uses a field with `valueSource` type "client_company_field", THE Goal_Breakdown_Component SHALL display the raw field values as Tree_Node labels.
5. WHEN a Breakdown_Level uses a field with `valueSource` type "leads_distinct", THE Goal_Breakdown_Component SHALL display distinct lead field values as Tree_Node labels.
6. WHEN a Breakdown_Level uses an Analytical_Dimension (prefixed with "segment:"), THE Goal_Breakdown_Component SHALL display segment names as Tree_Node labels and resolve values through Segment_Mappings.
7. THE Goal_Breakdown_Component SHALL pre-populate all possible values from the authoritative source for each level, ensuring Tree_Nodes appear even when no leads match yet.

---

### Requirement 7: Tree Interaction and UX

**User Story:** As a management admin, I want the tree view to be simple and intuitive with clear visual hierarchy, so that I can quickly understand the breakdown without confusion.

#### Acceptance Criteria

1. THE Goal_Breakdown_Component SHALL display the Breakdown_Structure selector at the top of the section as a horizontal chain: `[Field ▼] → [Field ▼] → [Field ▼]  [+ Add Level]  [Edit Targets]`.
2. WHEN the admin hovers over a level selector in the Breakdown_Structure, THE Goal_Breakdown_Component SHALL show a remove button (×) to delete that level.
3. THE Goal_Breakdown_Component SHALL display a summary bar above the tree showing: total target, total won revenue, and total attainment percentage.
4. WHEN a Tree_Node is expanded, THE Goal_Breakdown_Component SHALL load child data for the next level filtered by the parent's value.
5. WHILE the Goal_Breakdown_Component is loading data for a level, THE Goal_Breakdown_Component SHALL display a loading indicator in the expanding area.
6. THE Goal_Breakdown_Component SHALL sort Tree_Nodes within each level by won revenue in descending order by default.
7. WHEN the Breakdown_Structure contains 0 levels, THE Goal_Breakdown_Component SHALL display a prompt encouraging the admin to add at least one breakdown level.

