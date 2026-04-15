> Proposal status: this requirement set is not yet fully implemented in the current repo.
> Use [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) to distinguish live behavior from planned behavior.

# Requirements: Activity History & Audit Log

## Requirement 1 — Centralized Activity Log

**User Story:** As a manager, I want a single page showing all activity across the platform (leads, companies, contacts, settings), so that I can track changes without navigating into each individual item.

### Acceptance Criteria

1. WHEN a user navigates to `/activity` THEN the system SHALL display a chronological feed of all activities the user has access to, sorted newest first
2. WHEN an activity is displayed THEN it SHALL show: timestamp, actor (user name + avatar), action verb (created, updated, deleted, moved, etc.), target entity (lead name, company name, etc.), module badge, and a summary of what changed
3. WHEN the user has holding-level access THEN the system SHALL show activities from all subsidiary companies
4. WHEN the user belongs to a single company THEN the system SHALL only show activities scoped to that company
5. WHEN the activity feed loads THEN it SHALL show the 50 most recent activities with infinite scroll pagination

---

## Requirement 2 — Activity Recording (Backend)

**User Story:** As a developer, I want an automatic audit log system that captures all create, update, delete, and status-change events across the platform, so that the activity history is comprehensive without manual instrumentation everywhere.

### Acceptance Criteria

1. WHEN a lead is created, updated, or deleted THEN the system SHALL insert a record into the `activity_logs` table with: `company_id`, `user_id`, `module` ("leads"), `action` ("created"/"updated"/"deleted"), `entity_id`, `entity_name`, `changes` (JSON diff), and `metadata` (JSON for extra context)
2. WHEN a lead moves between pipeline stages THEN the system SHALL record: action "stage_changed", with `changes` containing `{ from: "Qualified", to: "Proposal Sent" }`
3. WHEN a company or contact is created/updated/deleted THEN the system SHALL record the activity with module "companies" or "contacts"
4. WHEN a settings change occurs (pipeline stages, transition rules, permissions, form layout, user management) THEN the system SHALL record the activity with module "settings" and a descriptive `action`
5. WHEN a field value changes on an entity THEN the `changes` JSON SHALL contain an array of `{ field, old_value, new_value }` objects — only changed fields, not the entire record
6. WHEN a bulk action occurs (e.g., bulk stage move, bulk assignment) THEN the system SHALL record ONE activity per affected entity, with a shared `batch_id` to group them
7. WHEN recording an activity THEN the system SHALL capture the timestamp at database level (`DEFAULT now()`) to ensure consistency

---

## Requirement 3 — Module Filtering

**User Story:** As a manager, I want to filter the activity feed by module (Leads, Companies, Contacts, Settings), so that I can focus on specific areas of the platform.

### Acceptance Criteria

1. WHEN the filter bar is displayed THEN it SHALL offer these module filters: All, Leads, Companies, Contacts, Settings
2. WHEN "Leads" is selected THEN the system SHALL show only activities where `module = 'leads'`
3. WHEN "Settings" is selected THEN the system SHALL show activities from: pipeline config, user management, permissions, form layout, master options
4. WHEN multiple filters are selected (if multi-select is supported) THEN the system SHALL show activities matching ANY of the selected modules
5. WHEN a filter is applied THEN the URL query params SHALL update (e.g., `?module=leads`) so that the filtered view is shareable/bookmarkable

---

## Requirement 4 — Date Range Filtering

**User Story:** As a manager, I want to filter activities by date range, so that I can review changes within a specific time period.

### Acceptance Criteria

1. WHEN the date filter is available THEN it SHALL offer presets: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, This Quarter, Custom Range
2. WHEN "Custom Range" is selected THEN the system SHALL show a date range picker with start and end date inputs
3. WHEN a date range is applied THEN the system SHALL filter activities where `created_at` falls within the range (inclusive)
4. WHEN no date filter is set THEN the system SHALL default to "Last 30 Days"

---

## Requirement 5 — User Filtering

**User Story:** As a manager, I want to filter activities by user, so that I can review what a specific team member has been doing.

### Acceptance Criteria

1. WHEN the user filter is available THEN it SHALL show a searchable dropdown of all company members
2. WHEN a user is selected THEN the system SHALL show only activities where `user_id` matches the selected user
3. WHEN the active company is in holding view THEN the user dropdown SHALL include members from all subsidiaries, grouped by company

---

## Requirement 6 — Search

**User Story:** As a user, I want to search across activities by keyword, so that I can find specific changes quickly.

### Acceptance Criteria

1. WHEN a user types in the search field THEN the system SHALL filter activities where the search term matches: entity name, action description, actor name, or field names in the changes
2. WHEN search is combined with module/date/user filters THEN all filters SHALL apply simultaneously (AND logic)
3. WHEN the search term is cleared THEN the system SHALL return to the unfiltered (or previously filtered) view

---

## Requirement 7 — Activity Detail Expansion

**User Story:** As a user, I want to expand an activity item to see the full list of field changes (old value → new value), so that I can understand exactly what was modified.

### Acceptance Criteria

1. WHEN an activity item is collapsed (default) THEN it SHALL show: timestamp, actor, action summary, entity name, module badge
2. WHEN an activity item is expanded (on click) THEN it SHALL additionally show: full list of changed fields with old → new values, any notes or context metadata, and a "View Entity" link to navigate to the actual lead/company/contact
3. WHEN a field change contains long text (e.g., notes, descriptions) THEN the system SHALL truncate with "Show more" toggle
4. WHEN a stage change is expanded THEN it SHALL show a visual from → to with stage color dots

---

## Requirement 8 — User Activity Summary (Management View)

**User Story:** As a manager, I want a summary section showing activity counts per user over a time period, so that I can identify which team members are actively updating the system and which are not.

### Acceptance Criteria

1. WHEN the activity page renders THEN it SHALL include a collapsible "Team Activity Summary" section above the feed
2. WHEN the summary is displayed THEN it SHALL show: each team member's name/avatar, total activity count in the selected period, breakdown by action type (creates, updates, stage moves), and a mini sparkline or bar showing daily activity distribution
3. WHEN a user has zero activities in the period THEN they SHALL appear at the bottom with a muted "No activity" label
4. WHEN a manager clicks on a user row in the summary THEN it SHALL apply that user as a filter on the activity feed below

---

## Requirement 9 — Export

**User Story:** As a manager, I want to export the filtered activity log as CSV or Excel, so that I can share reports or do offline analysis.

### Acceptance Criteria

1. WHEN the export button is clicked THEN the system SHALL export all activities matching the current filters (not just the loaded page)
2. WHEN exporting THEN the file SHALL include columns: Date/Time, User, Module, Action, Entity Name, Changes Summary, Company
3. WHEN the export is large (>1000 rows) THEN the system SHALL show a progress indicator

---

## Requirement 10 — Activity Log Data Model

**User Story:** As a developer, I want a scalable database schema for the activity log that supports efficient querying with filters.

### Acceptance Criteria

1. WHEN the schema is created THEN it SHALL include an `activity_logs` table with:
   - `id` (uuid, PK)
   - `created_at` (timestamptz, DEFAULT now(), NOT NULL)
   - `company_id` (uuid, FK to companies, NOT NULL)
   - `user_id` (uuid, FK to profiles, NOT NULL)
   - `module` (text, NOT NULL) — values: 'leads', 'companies', 'contacts', 'settings'
   - `action` (text, NOT NULL) — values: 'created', 'updated', 'deleted', 'stage_changed', 'assigned', 'status_changed', 'permission_changed', 'stage_added', 'stage_removed', 'rule_created', 'rule_updated', 'member_added', 'member_removed', etc.
   - `entity_type` (text, NOT NULL) — values: 'lead', 'company', 'contact', 'pipeline', 'pipeline_stage', 'transition_rule', 'user', 'permission', 'form_layout'
   - `entity_id` (uuid, nullable) — FK to the target entity
   - `entity_name` (text) — human-readable name snapshot (in case entity is later deleted)
   - `changes` (jsonb, nullable) — array of `{ field, old_value, new_value }`
   - `metadata` (jsonb, nullable) — extra context (e.g., `{ batch_id, pipeline_name, stage_from, stage_to }`)
2. WHEN indexes are created THEN they SHALL include: `idx_activity_company_created` (company_id, created_at DESC), `idx_activity_user` (user_id), `idx_activity_module` (module), `idx_activity_entity` (entity_type, entity_id)
3. WHEN RLS is enabled THEN the policy SHALL allow SELECT for company members (scoped by company_id), INSERT for authenticated users (own company), and no UPDATE/DELETE (immutable audit log)
4. WHEN the table grows large THEN the system SHOULD implement a retention policy (e.g., archive activities older than 12 months to a separate table or storage)

---

## Requirement 11 — Database Trigger-Based Recording

**User Story:** As a developer, I want database triggers that automatically record activities on INSERT/UPDATE/DELETE of key tables, so that no application code path can skip audit logging.

### Acceptance Criteria

1. WHEN an INSERT trigger fires on `leads` THEN a function SHALL insert into `activity_logs` with action "created", entity_name from the new lead's project_name
2. WHEN an UPDATE trigger fires on `leads` THEN a function SHALL compare OLD and NEW rows, compute a JSON diff of changed columns, and insert into `activity_logs` with action "updated" and the changes array
3. WHEN an UPDATE changes the `pipeline_stage_id` on `leads` THEN the trigger SHALL record action "stage_changed" with metadata containing from/to stage names
4. WHEN a DELETE trigger fires on `leads` THEN a function SHALL insert into `activity_logs` with action "deleted" and entity_name snapshot
5. WHEN triggers are created THEN they SHALL cover: `leads`, `companies` (future), `contacts` (future), `pipeline_stages`, `transition_rules`, `company_members`, `role_permissions`
6. WHEN the trigger function computes a diff THEN it SHALL exclude system columns (`created_at`, `updated_at`, `id`) from the changes array
7. WHEN `auth.uid()` is available in trigger context THEN it SHALL be used as `user_id`; otherwise (e.g., migration scripts) the user_id SHALL be set to a system user UUID
