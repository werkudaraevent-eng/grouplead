# Implementation Plan: Multi-Level Goal Breakdown

## Overview

Upgrade the Goal Breakdown component from a single-level flat table to a multi-level hierarchical tree view supporting up to 10 breakdown levels. Implementation follows a bottom-up approach: pure utility functions first, then component rewrite, then integration testing. The existing `breakdown_targets` JSONB column is reused with a new nested format while preserving backward compatibility with the legacy single-level structure.

## Tasks

- [x] 1. Create breakdown utility functions
  - [x] 1.1 Create `src/features/goals/lib/breakdown-utils.ts` with TypeScript interfaces
    - Define `BreakdownLevel`, `TreeNodeData`, `MultiLevelBreakdownTargets`, `NestedTargets` interfaces
    - Define `LeadRow` type alias for the lead query shape used by the tree builder
    - _Requirements: 5.1, 5.2_

  - [x] 1.2 Implement `isFieldAvailable` and `resolveLeadValue` utility functions
    - `isFieldAvailable(fieldKey, currentLevels)` returns false if fieldKey already exists in the level chain
    - `resolveLeadValue(lead, level, segmentResolver)` extracts key+label from a lead for a given level, handling all valueSource types (client_companies, profiles, master_options, client_company_field, leads_distinct, segment)
    - Null/empty field values resolve to key `"unassigned"` and label `"Unassigned"`
    - _Requirements: 1.6, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 1.3 Write property tests for `isFieldAvailable` (Property 1: Field uniqueness)
    - **Property 1: Field uniqueness in level chain**
    - Use `fast-check` to generate random subsets of LEAD_FIELD_REGISTRY keys and verify duplicates are rejected
    - **Validates: Requirements 1.6**

  - [ ]* 1.4 Write property tests for `resolveLeadValue` (Property 6: Null → Unassigned, Property 7: Segment resolution)
    - **Property 6: Null field values classified as Unassigned**
    - **Property 7: Segment resolution with fallback**
    - Generate random leads with null/empty fields and random segment dimensions with mappings
    - **Validates: Requirements 3.4, 3.5**

  - [x] 1.5 Implement `buildBreakdownTree` and `computeChildren` functions
    - `buildBreakdownTree(leads, levels, valueMaps, segmentResolver, savedTargets)` builds the full top-level tree nodes for level 0
    - `computeChildren(parentNode, allLeads, levels, currentLevelIndex, valueMaps, segmentResolver, savedTargets)` lazily computes children for a parent node at the next level
    - Pre-populate all possible values from valueMaps so nodes appear even with 0 matching leads
    - Sort nodes by wonRevenue descending within each level
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 6.7, 7.6_

  - [ ]* 1.6 Write property tests for tree building (Properties 3, 4, 5, 10, 11)
    - **Property 3: Leaf node aggregation correctness**
    - **Property 4: Parent-child aggregation invariant**
    - **Property 5: Revenue conservation**
    - **Property 10: Pre-population completeness**
    - **Property 11: Sort order invariant**
    - Generate random leads with random field values and random 1–10 level configs
    - **Validates: Requirements 3.1, 3.2, 3.3, 6.7, 7.6**

  - [x] 1.7 Implement `serializeTargets` and `deserializeTargets` functions
    - `serializeTargets(nodes, levels)` converts tree target amounts to the `NestedTargets` JSONB format with `_target` keys
    - `deserializeTargets(targets, path)` reads a target value for a specific node path from the nested structure
    - _Requirements: 4.4, 5.1, 5.2_

  - [ ]* 1.8 Write property test for serialization round-trip (Property 8)
    - **Property 8: Target serialization round-trip**
    - Generate random nested target trees up to 10 levels deep, serialize then deserialize, verify equality
    - **Validates: Requirements 4.4, 5.1, 5.2**

  - [x] 1.9 Implement `parseLegacyBreakdown` for backward compatibility
    - When `levels` array is absent or length ≤ 1, parse legacy `breakdown_field` + `by_{field}` keys into a single-level structure
    - _Requirements: 5.3_

  - [ ]* 1.10 Write property test for backward compatibility (Property 9)
    - **Property 9: Backward compatibility parsing**
    - Generate random legacy JSONB structures and verify correct single-level parsing
    - **Validates: Requirements 5.3**

- [x] 2. Checkpoint — Verify utility functions
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement LevelSelector component
  - [x] 3.1 Create the `LevelSelector` sub-component within `goal-breakdown.tsx`
    - Render horizontal chain of field dropdowns connected by arrow indicators (`→`)
    - Each dropdown populated from Lead Field Registry active fields + Analytical Dimensions
    - "Add Level" button appended at the end, hidden/disabled when 10 levels reached
    - Remove button (×) shown on hover for each level selector
    - Removing a level removes it and all levels below it
    - Exclude already-selected fields from each dropdown's options
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2_

  - [ ]* 3.2 Write property test for level removal truncation (Property 2)
    - **Property 2: Level removal truncation**
    - Generate random arrays of 1–10 field keys + random removal index, verify truncation
    - **Validates: Requirements 1.7**

- [ ] 4. Rewrite GoalBreakdown component with tree view
  - [x] 4.1 Refactor `GoalBreakdown` to use multi-level state and LevelSelector
    - Replace single `breakdownField` state with `levels: BreakdownLevel[]` array
    - Integrate LevelSelector for level configuration
    - Persist level changes to `breakdown_targets.levels` via `updateGoalAction`
    - Reset targets when breakdown structure changes
    - Add summary bar above tree: total target, total won revenue, total attainment %
    - Show "add at least one breakdown level" prompt when 0 levels configured
    - _Requirements: 1.8, 5.4, 7.3, 7.7_

  - [x] 4.2 Implement recursive `TreeNode` component
    - Render expand/collapse toggle (▶/▼) for parent nodes
    - Indent child nodes visually based on depth
    - Display: name, target, won revenue, pipeline value, % of target, progress bar
    - Lazy-load children on expand using `computeChildren`
    - Show loading indicator while computing children
    - Collapsed by default on first load
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 7.4, 7.5_

  - [x] 4.3 Implement single-level flat table fallback
    - When `levels` has length ≤ 1, render the existing flat table layout
    - Parse legacy `breakdown_targets` format using `parseLegacyBreakdown`
    - _Requirements: 2.5, 5.3_

  - [x] 4.4 Implement data fetching with single lead query and client-side grouping
    - Fetch all leads with the comprehensive select string covering all 15 registry fields + joins
    - For each level, call `fetchFieldValues()` to build value→label maps
    - For segment levels, load segment_mappings and build segment resolver
    - Group leads into tree using `buildBreakdownTree`
    - Handle "Unassigned" nodes for null field values
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 5. Checkpoint — Verify tree rendering
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement multi-level target editing
  - [x] 6.1 Add edit mode to the tree view
    - "Edit Targets" button switches to edit mode, showing CurrencyInput for every tree node at every level
    - Display running sub-target total for each parent node (sum of children's targets)
    - Show over/under indicator next to parent nodes when children targets don't match parent target
    - Cancel discards unsaved changes and restores previous values
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

  - [x] 6.2 Implement target save with nested JSONB persistence
    - On save, serialize tree targets using `serializeTargets` into the `NestedTargets` format
    - Persist to `breakdown_targets` column via `updateGoalAction` with `levels` array + `targets` object
    - Show warning if sum of level-0 node targets ≠ goal's total target amount
    - _Requirements: 4.4, 4.5, 5.1, 5.2_

  - [ ]* 6.3 Write unit tests for target editing flow
    - Test edit mode toggle, cancel restore, save persistence shape
    - Test over/under indicator calculation
    - Test mismatch warning display
    - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.7_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Maximum 10 breakdown levels (per requirements), not 3 as mentioned in some design sections
- The design mentions "max 3 levels" in several places — use 10 as the authoritative limit per requirements
- No new database tables or migrations needed — reuses existing `breakdown_targets` JSONB column
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
