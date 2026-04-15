# Requirements: Settings Interconnection & UX Redesign

## Introduction

This document specifies the requirements for redesigning the settings architecture in LeadEngine to solve five fundamental problems: (1) goal breakdown is limited to only 2 hardcoded options (Company and Sales Owner), (2) segment/grouping management is trapped inside Goal Settings instead of being globally reusable, (3) segment value assignment requires manual typing instead of selecting from existing data, (4) settings modules (Companies, Users, Master Options, Pipelines, Goals) operate in isolation instead of referencing each other, and (5) there is no central concept of "which lead fields are available for analysis." The feature introduces a Lead Field Registry as the single source of truth for analyzable fields, promotes segments to a global settings concept, and rewires goal breakdown, segment mapping, and dashboard widgets to use interconnected data from existing tables.

## Glossary

- **Lead_Field_Registry**: A centralized configuration that enumerates all lead fields available for breakdown, segmentation, and analytical use across the system. Each entry defines the field key, display label, value source (master_options, leads table, or profiles/companies), and whether the field is active for analysis.
- **Analyzable_Field**: A lead field registered in the Lead_Field_Registry that can be used as a breakdown dimension in goals, a source field for segments, or a grouping axis in dashboard widgets.
- **Value_Source**: The origin from which an Analyzable_Field's possible values are fetched — either `master_options` (for fields backed by dropdown configuration), `leads_distinct` (for free-text fields where values come from actual lead data), `profiles` (for user-based fields like pic_sales_id), or `client_companies` (for company-based fields like client_company_id).
- **Segment_Definition**: A global grouping rule that maps multiple values of a source Analyzable_Field into a named higher-order category (e.g., line_industry values "Banking", "Finance" → segment "BFSI"). Stored in the existing `analytical_dimensions` + `segment_mappings` tables but promoted to global settings scope.
- **Breakdown_Dimension**: A selected Analyzable_Field (or Segment_Definition) used to decompose a goal target into sub-targets. Replaces the current hardcoded "By Company" / "By Sales Owner" toggle.
- **Field_Value_Selector**: A UI component that presents actual values from the database as multi-select options (checkboxes or tags) instead of requiring free-text input. The values are fetched from the appropriate Value_Source.
- **Settings_Module**: One of the top-level settings areas: Company Management, User Management, Master Options, Pipeline Settings, or Goal Settings.
- **Cross_Reference**: A data relationship where one Settings_Module reads from another's data (e.g., Goal breakdown "By Company" reads from `client_companies`, "By Category" reads from `master_options`).
- **Goal_Breakdown**: The component in Goal Settings that decomposes a goal's target and attainment data by a selected Breakdown_Dimension.
- **Master_Options**: The existing `master_options` table that stores dynamic dropdown values for lead classification fields (category, lead_source, main_stream, etc.).
- **Dashboard_Widget**: A visual component on the analytics dashboard that can use Analyzable_Fields for grouping and breakdown.

---

## Requirements

### Requirement 1: Lead Field Registry

**User Story:** As a system administrator, I want a central registry of all lead fields available for analysis, so that goal breakdown, segment mapping, and dashboard widgets all draw from the same authoritative list of analyzable fields.

#### Acceptance Criteria

1. THE Lead_Field_Registry SHALL enumerate all lead classification fields available for analysis, including at minimum: category, lead_source, main_stream, grade_lead, stream_type, business_purpose, tipe, nationality, sector, line_industry, area, referral_source, event_format, pic_sales_id (as "Sales Owner"), and client_company_id (as "Client Company").
2. WHEN a field is registered in the Lead_Field_Registry, THE Lead_Field_Registry SHALL store the field key, a human-readable display label, the Value_Source type (master_options, leads_distinct, profiles, or client_companies), and an is_active flag.
3. WHEN a field's Value_Source is "master_options", THE Lead_Field_Registry SHALL store the corresponding option_type key (e.g., "category" for the category field) so that values can be fetched from the master_options table.
4. WHEN a field's Value_Source is "leads_distinct", THE Lead_Field_Registry SHALL indicate that values are fetched by querying SELECT DISTINCT on the corresponding column from the leads table.
5. WHEN a field's Value_Source is "profiles", THE Lead_Field_Registry SHALL indicate that values are fetched from the profiles table (active users with sales roles).
6. WHEN a field's Value_Source is "client_companies", THE Lead_Field_Registry SHALL indicate that values are fetched from the client_companies table.
7. THE Lead_Field_Registry SHALL be queryable by the Goal Breakdown selector, the Segment source field selector, and the Dashboard widget breakdown selectors.
8. WHEN an admin deactivates a field in the Lead_Field_Registry, THE Lead_Field_Registry SHALL exclude the field from all selector dropdowns while preserving existing configurations that reference the field.

---

### Requirement 2: Dynamic Goal Breakdown Field Selection

**User Story:** As a management admin, I want to break down goals by any lead classification field from the Lead Field Registry, so that I am not limited to only "By Company" and "By Sales Owner."

#### Acceptance Criteria

1. WHEN an admin opens the Goal Breakdown dimension selector, THE Goal_Breakdown SHALL display all active Analyzable_Fields from the Lead_Field_Registry as selectable options.
2. WHEN an admin selects an Analyzable_Field as the Breakdown_Dimension, THE Goal_Breakdown SHALL group leads by the distinct values of that field and display attainment and pipeline data per group.
3. WHEN the selected Breakdown_Dimension is "category" (Value_Source: master_options), THE Goal_Breakdown SHALL group leads by their category field value and label each group using the master_options label.
4. WHEN the selected Breakdown_Dimension is "line_industry" (Value_Source: leads_distinct), THE Goal_Breakdown SHALL group leads by their line_industry field value using distinct values from actual lead data.
5. WHEN the selected Breakdown_Dimension is "pic_sales_id" (Value_Source: profiles), THE Goal_Breakdown SHALL group leads by sales owner and display the profile's full_name as the group label.
6. WHEN the selected Breakdown_Dimension is "client_company_id" (Value_Source: client_companies), THE Goal_Breakdown SHALL group leads by client company and display the company name as the group label.
7. WHEN an admin selects a Segment_Definition as the Breakdown_Dimension, THE Goal_Breakdown SHALL group leads by their resolved segment assignment (using the segment mapping rules) instead of raw field values.
8. THE Goal_Breakdown SHALL persist the selected Breakdown_Dimension per goal so that the selection is retained across page reloads.

---

### Requirement 3: Global Segment Management

**User Story:** As a management admin, I want segment definitions to be managed at the global settings level (not inside Goal Settings), so that segments are reusable across goals, dashboard widgets, and future analytics features.

#### Acceptance Criteria

1. WHEN an admin navigates to the Settings landing page, THE Settings_Page SHALL display a dedicated "Segments & Dimensions" settings module alongside the existing modules (Master Options, Users, Pipeline, Companies, Goals).
2. WHEN an admin opens the Segments & Dimensions settings, THE Segment_Settings SHALL display all existing Analytical_Dimensions and their Segment_Mappings for the active company.
3. WHEN an admin creates a new Segment_Definition, THE Segment_Settings SHALL store it in the existing `analytical_dimensions` and `segment_mappings` tables with the active company's company_id.
4. WHEN an admin edits or deletes a Segment_Definition from the global settings, THE Segment_Settings SHALL update the existing `analytical_dimensions` and `segment_mappings` records.
5. THE Segment_Settings SHALL allow creating multiple Analytical_Dimensions (e.g., "Segment by Line Industry", "Segment by Category"), each with a different source Analyzable_Field from the Lead_Field_Registry.
6. WHEN a Segment_Definition exists in global settings, THE Goal_Settings SHALL reference the segment for breakdown purposes without duplicating the segment configuration.
7. WHEN a Segment_Definition exists in global settings, THE Dashboard_Widget breakdown selectors SHALL include the segment as an available grouping option.
8. THE Goal_Settings advanced accordion SHALL remove the embedded "Segments" section and instead display a link to the global Segments & Dimensions settings page.

---

### Requirement 4: Multi-Select Values from Existing Data

**User Story:** As a management admin, I want to select segment values and breakdown values from actual database data using multi-select UI, so that I do not have to manually type values that already exist in the system.

#### Acceptance Criteria

1. WHEN an admin creates or edits a Segment_Mapping and the source field's Value_Source is "master_options", THE Field_Value_Selector SHALL fetch values from the master_options table filtered by the corresponding option_type and present them as multi-select checkboxes or searchable tags.
2. WHEN an admin creates or edits a Segment_Mapping and the source field's Value_Source is "leads_distinct", THE Field_Value_Selector SHALL fetch distinct non-null values from the leads table for the corresponding column and present them as multi-select checkboxes or searchable tags.
3. WHEN the Field_Value_Selector loads values, THE Field_Value_Selector SHALL display a loading indicator while fetching and handle empty results with an informative message.
4. WHEN the Field_Value_Selector displays values, THE Field_Value_Selector SHALL support search/filter functionality to help admins find specific values in large lists.
5. WHEN an admin has selected values in the Field_Value_Selector, THE Field_Value_Selector SHALL display selected values as removable tags above or within the selector.
6. IF the leads table contains no data for a given field, THEN THE Field_Value_Selector SHALL display a message indicating no values are available and allow the admin to type custom values as a fallback.
7. THE Field_Value_Selector SHALL replace the current TagInput component (free-text typing) in the Segment_Mapping form with the data-driven multi-select component.

---

### Requirement 5: Settings Module Cross-References

**User Story:** As a system architect, I want settings modules to reference each other's data through defined Cross_References, so that goal breakdown, segment mapping, and pipeline configuration use live data from the authoritative source tables.

#### Acceptance Criteria

1. WHEN the Goal_Breakdown groups leads "By Client Company", THE Goal_Breakdown SHALL read company names and IDs from the `client_companies` table (not from a hardcoded list or duplicated data).
2. WHEN the Goal_Breakdown groups leads "By Sales Owner", THE Goal_Breakdown SHALL read user names and IDs from the `profiles` table filtered to active users who are sales-role members.
3. WHEN the Goal_Breakdown groups leads by a master_options-backed field (e.g., "By Category"), THE Goal_Breakdown SHALL read the available values from the `master_options` table where option_type matches the field.
4. WHEN the Goal_Breakdown groups leads by a leads_distinct-backed field (e.g., "By Line Industry"), THE Goal_Breakdown SHALL read distinct values from the `leads` table for that column.
5. WHEN the Segment source field selector displays available fields, THE Segment_Settings SHALL read the field list from the Lead_Field_Registry.
6. WHEN the Goal_Settings references pipeline stages for forecast weight configuration, THE Goal_Settings SHALL read stages from the `pipeline_stages` table joined with `pipelines`.
7. WHEN the Goal_Settings references companies for goal scoping, THE Goal_Settings SHALL read from the `companies` table (internal tenant companies) via the existing company context.
8. THE Settings_Page SHALL visually indicate relationships between modules (e.g., Goal Settings card shows "Uses: Master Options, Pipeline, Companies" as a subtitle or tag).

---

### Requirement 6: Segment Source Field from Lead Field Registry

**User Story:** As a management admin, I want the segment source field selector to show all analyzable lead fields from the Lead Field Registry, so that I can create segments based on any classification field — not just the 3 hardcoded options.

#### Acceptance Criteria

1. WHEN an admin creates or edits an Analytical_Dimension, THE Dimension_Form SHALL populate the source field dropdown from all active Analyzable_Fields in the Lead_Field_Registry that have Value_Source of "master_options" or "leads_distinct".
2. WHEN an admin selects a source field for a dimension, THE Dimension_Form SHALL display the field's human-readable label from the Lead_Field_Registry.
3. THE Dimension_Form SHALL replace the current hardcoded SOURCE_FIELD_OPTIONS array (line_industry, category, lead_source) with the dynamic list from the Lead_Field_Registry.
4. WHEN a new field is added to the Lead_Field_Registry with Value_Source "master_options" or "leads_distinct", THE Dimension_Form SHALL automatically include the field in the source field dropdown without code changes.

---

### Requirement 7: Dashboard Widget Breakdown Integration

**User Story:** As a management user, I want dashboard analytics widgets to use the Lead Field Registry for breakdown options, so that I can analyze leads by any registered field — not just the currently hardcoded category, grade_lead, main_stream, stream_type, and business_purpose toggles.

#### Acceptance Criteria

1. WHEN a dashboard widget supports breakdown/grouping (e.g., Classification widget, Stream widget), THE Dashboard_Widget SHALL read available breakdown fields from the Lead_Field_Registry.
2. WHEN a user selects a breakdown field in a dashboard widget, THE Dashboard_Widget SHALL group lead data by the selected field's values.
3. WHEN a Segment_Definition is available, THE Dashboard_Widget SHALL include the segment as an available breakdown option alongside raw field values.
4. THE Dashboard_Widget SHALL retain backward compatibility with the existing catToggle (category/grade_lead) and streamToggle (main_stream/stream_type/business_purpose) behavior as default selections.

---

### Requirement 8: Lead Field Registry Administration

**User Story:** As a system administrator, I want to manage the Lead Field Registry through a settings UI, so that I can activate or deactivate fields for analysis and configure their value sources.

#### Acceptance Criteria

1. WHEN an admin navigates to the Lead Field Registry settings, THE Registry_Settings SHALL display all registered fields with their display label, field key, Value_Source, and is_active status.
2. WHEN an admin toggles a field's is_active status, THE Registry_Settings SHALL update the field and all dependent selectors (goal breakdown, segment source, dashboard widgets) SHALL reflect the change on next load.
3. WHEN an admin adds a custom field to the Lead_Field_Registry, THE Registry_Settings SHALL allow specifying the field key, display label, and Value_Source.
4. IF a field is referenced by an existing Segment_Definition or Goal Breakdown configuration, THEN THE Registry_Settings SHALL warn the admin before deactivation and preserve the existing configuration.
5. THE Registry_Settings SHALL prevent deletion of system-default fields (the 15 core lead classification fields) but allow deactivation.
6. THE Registry_Settings SHALL restrict access based on the master_options module permission (can_update).

---

### Requirement 9: Settings Landing Page Redesign

**User Story:** As an admin, I want the Settings landing page to clearly show how settings modules relate to each other, so that I understand the data flow between Companies, Users, Master Options, Pipelines, Segments, and Goals.

#### Acceptance Criteria

1. WHEN an admin navigates to the Settings landing page, THE Settings_Page SHALL display all settings modules including the new "Segments & Dimensions" and "Lead Field Registry" modules.
2. THE Settings_Page SHALL organize modules in a logical order that reflects data dependencies: Lead Field Registry → Master Options → Segments & Dimensions → Pipeline & Stages → Company Management → User Management → Goal Settings.
3. WHEN displaying the Goal Settings card, THE Settings_Page SHALL show dependency indicators (e.g., "References: Master Options, Pipeline, Companies, Segments") to communicate the interconnection.
4. THE Settings_Page SHALL provide a brief description for each module that explains its role in the overall settings architecture.

