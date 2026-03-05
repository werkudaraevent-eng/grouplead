# Requirements: Multi-Company Support

## Requirement 1

**User Story:** As a system administrator, I want a dedicated companies table with a holding flag, so that I can model the Werkudara Group's corporate structure with subsidiary companies.

### Acceptance Criteria

1. WHEN a company is created THEN the system SHALL store it in a `companies` table with `id`, `name`, `slug`, `is_holding`, `logo_url`, `created_at`, and `updated_at` columns
2. WHEN `is_holding` is set to true THEN the system SHALL treat that company as the parent holding entity with cross-company visibility
3. WHEN a company slug is provided THEN the system SHALL enforce uniqueness across all companies

---

## Requirement 2

**User Story:** As a system administrator, I want to manage company memberships with user types, so that users can belong to one or more companies with specific roles.

### Acceptance Criteria

1. WHEN a user is added to a company THEN the system SHALL create a `company_members` record linking the user's profile to the company with a `user_type` field
2. WHEN assigning a user type THEN the system SHALL support the values: `staff`, `leader`, `executive`, `admin`, and `super_admin`
3. WHEN a user belongs to multiple companies THEN the system SHALL maintain separate membership records with potentially different user types per company
4. WHEN a user is removed from a company THEN the system SHALL delete the corresponding `company_members` record

---

## Requirement 3

**User Story:** As a developer, I want tenant-scoped data tables with `company_id` foreign keys, so that leads, tasks, and options are isolated per company.

### Acceptance Criteria

1. WHEN a lead is created THEN the system SHALL require a `company_id` foreign key referencing the `companies` table
2. WHEN a lead task is created THEN the system SHALL require a `company_id` foreign key referencing the `companies` table
3. WHEN a master option is created THEN the system SHALL require a `company_id` foreign key referencing the `companies` table (nullable for global options)
4. WHEN querying any tenant-scoped table THEN the system SHALL filter results by the active company context

---

## Requirement 4

**User Story:** As a security architect, I want RLS policies that enforce data isolation between companies while allowing holding-level access, so that users can only see data belonging to their company or all companies if they have holding access.

### Acceptance Criteria

1. WHEN a user queries leads THEN the RLS policy SHALL only return leads where `company_id` matches one of the user's company memberships
2. WHEN a user has holding-level access (member of the holding company) THEN the RLS policy SHALL return leads from all subsidiary companies
3. WHEN a user attempts to insert or update data THEN the RLS policy SHALL verify the user is a member of the target `company_id`
4. WHEN RLS policies are evaluated THEN the system SHALL use the authenticated user's ID from `auth.uid()` to determine company memberships

---

## Requirement 5

**User Story:** As a user, I want an active company context stored in a cookie, so that the application knows which company's data to display, with a special "holding" value for cross-company views.

### Acceptance Criteria

1. WHEN a user logs in THEN the system SHALL set an `active_company` cookie to the user's default company slug
2. WHEN the active company cookie is set to a company slug THEN the system SHALL scope all data queries to that company
3. WHEN the active company cookie is set to the special value `"holding"` THEN the system SHALL display aggregated data from all companies the user has access to
4. WHEN the active company cookie value is invalid or the user is not a member of that company THEN the system SHALL fall back to the user's first available company
5. WHEN the server reads the active company context THEN the system SHALL parse it from cookies using the Supabase SSR cookie utilities

---

## Requirement 6

**User Story:** As a user, I want a company switcher in the sidebar, so that I can quickly switch between companies and the holding view.

### Acceptance Criteria

1. WHEN the sidebar renders THEN the system SHALL display a company switcher dropdown showing the current active company
2. WHEN a user clicks the company switcher THEN the system SHALL show all companies the user is a member of, plus a "Holding View" option if the user is a holding company member
3. WHEN a user selects a different company THEN the system SHALL update the `active_company` cookie and refresh the current page data
4. WHEN the user has access to only one company THEN the system SHALL still display the company name but MAY hide the dropdown trigger

---

## Requirement 7

**User Story:** As an admin, I want a company management page at `/settings/companies`, so that I can create, edit, and view companies in the system.

### Acceptance Criteria

1. WHEN an admin navigates to `/settings/companies` THEN the system SHALL display a list of all companies with name, slug, member count, and holding status
2. WHEN an admin clicks "Create Company" THEN the system SHALL show a form with fields for name, slug (auto-generated from name), and `is_holding` toggle
3. WHEN an admin edits a company THEN the system SHALL allow updating the name, slug, logo URL, and holding status
4. WHEN a non-admin user navigates to `/settings/companies` THEN the system SHALL restrict access based on their user type (admin or super_admin only)

---

## Requirement 8

**User Story:** As a company admin, I want to manage company members, so that I can add, remove, and change user types for people in my company.

### Acceptance Criteria

1. WHEN an admin views a company's member list THEN the system SHALL display all members with their name, email, user type, and join date
2. WHEN an admin adds a member THEN the system SHALL allow selecting an existing user profile and assigning a user type
3. WHEN an admin changes a member's user type THEN the system SHALL update the `company_members` record and the change SHALL take effect immediately
4. WHEN an admin removes a member THEN the system SHALL delete the `company_members` record after confirmation

---

## Requirement 9

**User Story:** As a developer, I want a migration strategy for existing data, so that current leads, tasks, and options are assigned to a default company without data loss.

### Acceptance Criteria

1. WHEN the migration runs THEN the system SHALL create a default company record for the existing Werkudara Group data
2. WHEN the migration runs THEN the system SHALL add `company_id` columns to `leads`, `lead_tasks`, and `master_options` tables with the default company ID
3. WHEN the migration runs THEN the system SHALL assign all existing profiles as members of the default company with appropriate user types based on their current roles
4. WHEN the migration completes THEN the system SHALL enforce `NOT NULL` constraints on the new `company_id` columns (except `master_options` which allows nullable for global options)

---

## Requirement 10

**User Story:** As a developer, I want updated TypeScript types reflecting the multi-company schema, so that the frontend code is type-safe with the new data model.

### Acceptance Criteria

1. WHEN the types are updated THEN the system SHALL include a `Company` interface with all columns from the `companies` table
2. WHEN the types are updated THEN the system SHALL include a `CompanyMember` interface with user type and joined profile data
3. WHEN the types are updated THEN the system SHALL update the `Lead`, `LeadTask`, and `MasterOption` interfaces to include `company_id`
4. WHEN the types are updated THEN the system SHALL include a `CompanyContext` type representing the active company state (slug, id, is_holding)

---

## Requirement 11

**User Story:** As a developer, I want a query layer that automatically applies company scoping, so that all data fetches respect the active company context without manual filtering.

### Acceptance Criteria

1. WHEN a server component fetches data THEN the system SHALL read the active company from cookies and apply the company filter to Supabase queries
2. WHEN a client component fetches data THEN the system SHALL read the active company from the React context and apply the company filter
3. WHEN the active company is set to "holding" THEN the query layer SHALL omit the company filter to return cross-company data (relying on RLS for access control)
4. WHEN creating or updating records THEN the query layer SHALL automatically inject the active `company_id` into the payload

---

## Requirement 12

**User Story:** As a system administrator, I want a role-based permissions system with a `role_permissions` table and a matrix UI, so that I can define granular access control per user type per company.

### Acceptance Criteria

1. WHEN permissions are defined THEN the system SHALL store them in a `role_permissions` table with `company_id`, `user_type`, `resource`, `action`, and `is_allowed` columns
2. WHEN a user performs an action THEN the system SHALL check the `role_permissions` table for the user's `user_type` in the active company to determine if the action is allowed
3. WHEN an admin views the permissions page THEN the system SHALL display a matrix UI with user types as columns and resource/action pairs as rows
4. WHEN an admin toggles a permission THEN the system SHALL update the `role_permissions` record and the change SHALL take effect on the next request
5. WHEN no explicit permission exists for a user type/resource/action combination THEN the system SHALL default to denying access
