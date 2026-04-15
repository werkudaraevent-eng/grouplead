# Implementation Plan: Settings Interconnection & UX Redesign

## Overview

This plan implements the Lead Field Registry, global segments, dynamic goal breakdown, and settings interconnection in a bottom-up order: foundation config → DB table → shared components → page rewrites → integration. Each task builds on the previous, with checkpoints to validate incrementally.

## Tasks

- [x] 1. Create Lead Field Registry config and field value utilities
  - [x] 1.1 Create `src/config/lead-field-registry.ts` with `ValueSource` type, `LeadFieldEntry` interface, and `LEAD_FIELD_REGISTRY` constant containing all 15 core fields
    - Export types: `ValueSource`, `LeadFieldEntry`
    - Each entry: `key`, `label`, `valueSource`, `isSystemDefault`, `supportsSegmentation`
    - All master_options-backed fields use `{ type: 'master_options', optionType: '<key>' }`
    - `referral_source` uses `{ type: 'leads_distinct', column: 'referral_source' }`
    - `pic_sales_id` uses `{ type: 'profiles' }`, `client_company_id` uses `{ type: 'client_companies' }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Create `src/utils/field-values.ts` with `fetchFieldValues()` and `getActiveFields()` utilities
    - `fetchFieldValues(supabase, fieldKey, companyId)` switches on `valueSource.type` to query the correct table
    - For `master_options`: query `master_options` where `option_type` matches and `is_active = true`
    - For `leads_distinct`: query `SELECT DISTINCT column FROM leads WHERE column IS NOT NULL`
    - For `profiles`: query `profiles` joined with `company_members` for active sales-role users
    - For `client_companies`: query `client_companies` scoped to company
    - `getActiveFields(settings?)` merges static registry with per-company `lead_field_settings` overrides
    - Return `FieldValue[]` with `{ id, label, value }` shape
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.3 Add `LeadFieldSetting` type to `src/types/index.ts`
    - Interface with `id`, `created_at`, `updated_at`, `company_id`, `field_key`, `is_active`, `custom_label`, `custom_value_source`
    - _Requirements: 1.2, 8.1_

  - [ ]* 1.4 Write property tests for active field resolution (Property 1)
    - **Property 1: Active field resolution**
    - Use fast-check to generate arbitrary `lead_field_settings` override arrays
    - Verify `getActiveFields()` returns exactly fields where no override exists OR override has `is_active = true`
    - Verify `supportsSegmentation` is true only for `master_options` and `leads_distinct` sources
    - **Validates: Requirements 1.8, 6.1, 6.4, 8.2**

  - [ ]* 1.5 Write property test for field value search filtering (Property 5)
    - **Property 5: Field value search filtering**
    - Generate arbitrary value lists and search strings
    - Verify filtered results contain exactly values whose label includes the search string (case-insensitive)
    - Verify empty search returns all values
    - **Validates: Requirements 4.4**

  - [ ]* 1.6 Write unit tests for `fetchFieldValues()` and `getActiveFields()`
    - Test empty settings array, all fields deactivated, custom fields mixed with system fields
    - Test registry structure: verify all 15 fields present with correct shapes
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create `lead_field_settings` DB table and RLS policies
  - [x] 2.1 Create Supabase migration file `supabase/migrations/<timestamp>_lead_field_settings.sql`
    - Create `lead_field_settings` table with columns: `id` (UUID PK), `created_at`, `updated_at`, `company_id` (FK to companies), `field_key` (TEXT), `is_active` (BOOLEAN DEFAULT true), `custom_label` (TEXT nullable), `custom_value_source` (JSONB nullable)
    - Add UNIQUE constraint on `(company_id, field_key)`
    - Enable RLS with company-scoped SELECT and ALL policies using `fn_user_company_ids()`
    - _Requirements: 1.2, 1.8, 8.1, 8.2_

- [x] 3. Checkpoint — Validate foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create FieldValueSelector shared component
  - [x] 4.1 Create `src/components/shared/field-value-selector.tsx`
    - Accept props: `fieldKey`, `companyId`, `selectedValues`, `onChange`, `placeholder?`, `allowCustom?`
    - Call `fetchFieldValues()` on mount, show loading spinner while fetching
    - Render searchable multi-select popover with checkboxes (using shadcn Popover + Command)
    - Display selected values as removable tags
    - Support search/filter within the value list
    - Show "No values available" message when empty; fall back to free-text input if `allowCustom` is true
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.2 Write unit tests for FieldValueSelector
    - Test loading state, empty state, selected tags display, search interaction
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 5. Create Global Segments settings page
  - [x] 5.1 Create route `src/app/settings/segments/page.tsx`
    - Server component that renders the global SegmentSettings page
    - Wrap with PermissionGate for `master_options` read access
    - Include back-link to `/settings`
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Refactor `src/features/goals/components/settings/segment-settings.tsx` for global use
    - Replace hardcoded `SOURCE_FIELD_OPTIONS` with dynamic list from `getActiveFields()` filtered to `supportsSegmentation: true`
    - Replace `TagInput` component with `FieldValueSelector` for segment mapping value selection
    - Support multiple `analytical_dimensions` (not just the first one) — list all dimensions for the company
    - Allow creating new dimensions with any segmentable field from the registry
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.3 Write unit tests for refactored segment settings
    - Test dynamic source field population from registry
    - Test FieldValueSelector integration in segment mapping form
    - _Requirements: 6.1, 6.3_

- [x] 6. Rewrite Goal Breakdown with dynamic field selection
  - [x] 6.1 Rewrite `src/features/goals/components/settings/goal-breakdown.tsx`
    - Replace `BreakdownMode = "company" | "sales_owner"` with a dynamic field selector populated from `getActiveFields()`
    - Include segment-based breakdown options from `analytical_dimensions` table
    - Grouping logic switches on `valueSource.type` to determine how to group leads and resolve labels
    - For `master_options`: group by field value, label from master_options
    - For `leads_distinct`: group by raw distinct values
    - For `profiles`: group by `pic_sales_id`, label from `profiles.full_name`
    - For `client_companies`: group by `client_company_id`, label from company name
    - For segments: group by resolved segment name via existing classification logic
    - Store selected field key in `breakdown_targets` under `by_<field_key>` with a `breakdown_field` key for persistence
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.2 Write property test for breakdown grouping correctness (Property 3)
    - **Property 3: Breakdown grouping correctness**
    - Generate random leads with random field values using fast-check
    - Verify one group per distinct value, `wonRevenue` equals sum of `actual_value` for won leads, `pipelineValue` equals sum of `estimated_value` for non-won non-lost leads
    - **Validates: Requirements 2.2, 2.7, 7.2**

  - [ ]* 6.3 Write property test for breakdown dimension persistence round-trip (Property 4)
    - **Property 4: Breakdown dimension persistence round-trip**
    - Generate arbitrary field keys and sub-target maps
    - Verify saving and reading back returns the same field key and sub-targets
    - **Validates: Requirements 2.8**

- [x] 7. Checkpoint — Validate core features
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create Registry Settings UI
  - [x] 8.1 Create route `src/app/settings/registry/page.tsx`
    - Server component that renders the Lead Field Registry admin page
    - Wrap with PermissionGate for `master_options` `can_update` permission
    - Include back-link to `/settings`
    - _Requirements: 8.6_

  - [x] 8.2 Create `src/features/goals/components/settings/registry-settings.tsx` client component
    - Display all registered fields in a table: display label, field key, value source type, is_active toggle
    - Toggle `is_active` per field — upsert into `lead_field_settings` table
    - Allow adding custom fields: specify field key, display label, and value source
    - Warn before deactivating fields referenced by existing `analytical_dimensions.source_field` or `goals.breakdown_targets`
    - Prevent deletion of system-default fields (disable delete button, show tooltip)
    - Allow deactivation of system-default fields
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 8.3 Write property test for system field deletion prevention (Property 7)
    - **Property 7: System field deletion prevention**
    - For any field where `isSystemDefault` is true, verify deletion is rejected
    - Verify deactivation is allowed but field remains in registry
    - **Validates: Requirements 8.5**

  - [ ]* 8.4 Write property test for dependency detection before deactivation (Property 6)
    - **Property 6: Dependency detection before deactivation**
    - Generate field keys referenced by dimensions or breakdown configs
    - Verify deactivation attempt produces a warning listing dependent configurations
    - Verify existing configurations remain unchanged
    - **Validates: Requirements 8.4**

- [x] 9. Update Settings Landing Page
  - [x] 9.1 Update `src/app/settings/page.tsx`
    - Add "Lead Field Registry" module card with link to `/settings/registry`
    - Add "Segments & Dimensions" module card with link to `/settings/segments`
    - Reorder modules: Lead Field Registry → Lead Dropdown Options → Segments & Dimensions → Pipeline & Stages → Company Management → User Management → Roles & Permissions → Goal Settings
    - Add dependency indicators to Goal Settings card (e.g., "Uses: Master Options, Pipeline, Companies, Segments")
    - Add brief descriptions for new modules explaining their role
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Update Goal Settings page to remove embedded Segments
  - [x] 10.1 Modify `src/features/goals/components/settings/goal-settings-page.tsx`
    - Remove the "Segments" accordion item from the Advanced Settings section
    - Replace with a link/button pointing to `/settings/segments` (e.g., "Manage Segments in global settings")
    - Keep all other accordion items unchanged
    - _Requirements: 3.6, 3.8_

- [x] 11. Dashboard widget breakdown integration
  - [x] 11.1 Update `src/features/leads/components/analytics-dashboard.tsx` Classification and Stream widgets
    - Extend `catToggle` options to read available breakdown fields from `getActiveFields()` filtered to relevant fields
    - Extend `streamToggle` options similarly
    - Include segment-based breakdown options from `analytical_dimensions`
    - Retain backward compatibility: `category`/`grade_lead` as default catToggle, `main_stream`/`stream_type`/`business_purpose` as default streamToggle
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 11.2 Write unit tests for dashboard widget backward compatibility
    - Verify default catToggle and streamToggle selections work as before
    - Verify new registry-driven fields appear in toggle options
    - _Requirements: 7.4_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The Lead Field Registry is a TypeScript constant — no migration needed for the registry itself, only for the `lead_field_settings` override table
- Most work is UI rewiring — connecting existing data infrastructure to new selectors and components
