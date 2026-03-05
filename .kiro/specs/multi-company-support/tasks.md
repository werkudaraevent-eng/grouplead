# Implementation Plan: Multi-Company Support

## Overview

Transform LeadEngine from a single-tenant application into a multi-tenant system with company-scoped data isolation via Postgres RLS, cookie-based active company context, a company switcher UI, and a granular role-based permissions system. Implementation follows a migration-first approach: database schema changes → server utilities → context providers → UI components → existing page updates.

## Tasks

- [x] 1. Database migration and schema setup
  - [x] 1.1 Create the multi-company migration SQL file
    - Create `supabase/migration_multi_company.sql` with the following ordered steps:
    - Create `companies` table with `id`, `name`, `slug` (unique), `is_holding`, `logo_url`, `created_at`, `updated_at`
    - Insert default Werkudara Group holding company record
    - Create `company_members` table with `id`, `company_id`, `user_id`, `user_type` (CHECK constraint for staff/leader/executive/admin/super_admin), unique on `(company_id, user_id)`
    - Create `role_permissions` table with `id`, `company_id`, `user_type`, `resource`, `action`, `is_allowed`, unique on `(company_id, user_type, resource, action)`
    - Add nullable `company_id` column to `leads`, `lead_tasks`, and `master_options` tables with FK to `companies`
    - Backfill all existing rows with the default company ID
    - Set `company_id` to `NOT NULL` on `leads` and `lead_tasks` (keep nullable on `master_options` for global options)
    - Create indexes: `idx_companies_slug`, `idx_company_members_user`, `idx_company_members_company`, `idx_role_permissions_lookup`, `idx_leads_company`, `idx_lead_tasks_company`, `idx_master_options_company`
    - _Requirements: Design — Data Models, Migration Strategy_

  - [x] 1.2 Create RLS helper functions and policies
    - In the same migration file (or a separate `supabase/rls_multi_company.sql`):
    - Create `fn_user_company_ids()` function returning `uuid[]` of user's company IDs
    - Create `fn_user_has_holding_access()` function returning boolean
    - Drop old permissive RLS policies on `leads`, `lead_tasks`, `master_options`
    - Create new company-scoped RLS policies for `leads` (SELECT/INSERT/UPDATE/DELETE)
    - Create new company-scoped RLS policies for `lead_tasks` (SELECT/INSERT/UPDATE/DELETE)
    - Create new RLS policies for `master_options` (SELECT/INSERT/UPDATE with NULL = global)
    - Enable RLS and create policies for `companies` (SELECT for members, manage for holding super_admin)
    - Enable RLS and create policies for `company_members` (SELECT for members, manage for admin/super_admin)
    - Enable RLS and create policies for `role_permissions` (SELECT for members, manage for admin/super_admin)
    - _Requirements: Design — RLS Policies_

  - [x] 1.3 Migrate existing profiles to company_members and seed default permissions
    - In the migration file, insert `company_members` rows for all existing profiles with user type mapping: `super_admin` → `super_admin`, `director` → `executive`, `bu_manager` → `leader`, `sales` → `staff`, `finance` → `staff`
    - Seed default `role_permissions` rows for the default company with sensible defaults per user type (e.g., staff can read leads, admin can CRUD all resources)
    - _Requirements: Design — Migration Strategy steps 7, 9_

- [x] 2. TypeScript types and server utilities
  - [x] 2.1 Create company-related TypeScript types
    - Create `src/types/company.ts` with interfaces: `Company`, `CompanyInsert`, `CompanyUpdate`, `UserType`, `CompanyMember`, `RolePermission`, `CompanyContext`, `ActiveCompanyState`
    - Update `src/types/index.ts` to re-export from `company.ts`
    - Add `company_id` field to `Lead` interface in `src/types/index.ts`
    - Add `company_id` field to `LeadTask` interface in `src/types/tasks.ts`
    - Add `company_id` field to `MasterOption` interface in `src/types/index.ts`
    - _Requirements: Design — TypeScript Types_

  - [x] 2.2 Create `getActiveCompany` server utility
    - Create `src/utils/company.ts`
    - Implement `getActiveCompany(cookieStore)` that reads the `active_company` cookie, validates the user is a member of that company via Supabase query, and returns `{ id, slug, name, isHolding }` or falls back to the user's first company
    - Handle the `"holding"` cookie value by checking `fn_user_has_holding_access`
    - _Requirements: Design — Server Utilities, getActiveCompany_

  - [x] 2.3 Create `scopedQuery` helper
    - Create `src/utils/supabase/scoped-query.ts`
    - Implement `scopedQuery(supabase, table, companyId)` that applies `.eq('company_id', companyId)` unless `companyId` is `null` (holding view)
    - Returns the query builder for chaining
    - _Requirements: Design — Server Utilities, scopedQuery_

- [x] 3. Checkpoint — Verify database migration and types
  - Ensure all SQL migration files are syntactically correct and types compile without errors. Ask the user if questions arise.

- [x] 4. React context providers
  - [x] 4.1 Create `CompanyProvider` context
    - Create `src/contexts/company-context.tsx` as a client component
    - Implement `CompanyProvider` that accepts `initialCompany` and `companies` as server-side props
    - Provide `activeCompany`, `companies`, `isHoldingView`, and `switchCompany(slug)` via context
    - `switchCompany` sets the `active_company` cookie via `document.cookie` and calls `router.refresh()`
    - Export `useCompany()` hook for consuming the context
    - _Requirements: Design — CompanyProvider_

  - [x] 4.2 Create `PermissionsProvider` context
    - Create `src/contexts/permissions-context.tsx` as a client component
    - Nest inside `CompanyProvider` (reads `activeCompany` from company context)
    - Fetch `role_permissions` for the user's `user_type` in the active company from Supabase
    - Provide `can(resource, action)` function, `permissions` array, and `loading` state
    - Cache permissions in state; re-fetch when `activeCompany` changes
    - Export `usePermissions()` hook for consuming the context
    - _Requirements: Design — PermissionsProvider_

  - [ ]* 4.3 Write unit tests for CompanyProvider and PermissionsProvider
    - Test `switchCompany` sets cookie and triggers refresh
    - Test `can()` returns correct boolean based on cached permissions
    - Test re-fetch on company change
    - _Requirements: Design — CompanyProvider, PermissionsProvider_

- [x] 5. Company switcher and permission gate components
  - [x] 5.1 Create `CompanySwitcher` component
    - Create `src/components/layout/company-switcher.tsx` as a client component
    - Render a dropdown (using shadcn `Select` or `DropdownMenu`) showing the user's companies
    - Include a "Holding View" option for users with holding access
    - Show the active company name and logo
    - On selection, call `switchCompany(slug)` from `useCompany()` context
    - _Requirements: Design — CompanySwitcher_

  - [x] 5.2 Create `PermissionGate` component
    - Create `src/components/permission-gate.tsx` as a client component
    - Accept `resource` and `action` props
    - Use `usePermissions()` to call `can(resource, action)`
    - Conditionally render `children` if allowed, optional `fallback` prop if denied
    - _Requirements: Design — PermissionGate_

- [x] 6. Wire providers and switcher into existing layout
  - [x] 6.1 Update `layout.tsx` to pass server-side company context
    - In `src/app/layout.tsx`, read the `active_company` cookie server-side using `getActiveCompany()`
    - Fetch the user's company list from Supabase
    - Pass `initialCompany` and `companies` as props to `MainLayout`
    - _Requirements: Design — Updated Components, layout.tsx_

  - [x] 6.2 Update `MainLayout` to wrap children with providers
    - In `src/components/layout/main-layout.tsx`, accept `initialCompany` and `companies` props
    - Wrap children with `<CompanyProvider>` and `<PermissionsProvider>`
    - _Requirements: Design — Updated Components, MainLayout_

  - [x] 6.3 Add `CompanySwitcher` to `Sidebar`
    - In `src/components/layout/sidebar.tsx`, import and render `<CompanySwitcher />` below the header logo area
    - Add "Company Management" link to admin nav section pointing to `/settings/companies`
    - _Requirements: Design — Updated Components, Sidebar_

- [x] 7. Checkpoint — Verify context providers and company switcher
  - Ensure the app renders with the company context, switcher is visible in sidebar, and cookie-based switching works. Ask the user if questions arise.

- [x] 8. Update existing pages and hooks to scope by company
  - [x] 8.1 Update home page (`src/app/page.tsx`) to scope leads by active company
    - Read active company from cookie via `getActiveCompany()`
    - Use `scopedQuery` to filter leads by `company_id` (or omit filter for holding view)
    - _Requirements: Design — Updated Components, page.tsx (home)_

  - [x] 8.2 Update `use-master-options.ts` to accept and filter by `companyId`
    - Add optional `companyId` parameter to `useMasterOptions`
    - When `companyId` is provided, filter by `company_id` equals `companyId` OR `company_id` is null (global options)
    - When `companyId` is not provided, return all accessible options (RLS handles scoping)
    - _Requirements: Design — Updated Components, use-master-options.ts_

  - [x] 8.3 Update leads pipeline page and tasks page to scope by company
    - Update `src/app/leads/page.tsx` to read active company and scope the leads query
    - Update `src/app/dashboard/tasks/page.tsx` to read active company and scope the lead_tasks query
    - _Requirements: Design — Updated Components_

  - [ ]* 8.4 Write unit tests for scoped queries
    - Test `scopedQuery` applies company filter correctly
    - Test `scopedQuery` omits filter when companyId is null (holding view)
    - Test `getActiveCompany` fallback behavior
    - _Requirements: Design — Server Utilities_

- [x] 9. Company management settings pages
  - [x] 9.1 Create company list page at `/settings/companies`
    - Create `src/app/settings/companies/page.tsx` as a client component
    - Fetch and display all companies the user has access to in a data table
    - Include "Add Company" button (gated by `PermissionGate` for `companies.create`)
    - _Requirements: Design — CompanyManagementPage_

  - [x] 9.2 Create `CompanyForm` dialog component
    - Create `src/components/company-form.tsx` as a client component
    - Use React Hook Form + Zod for validation
    - Fields: `name` (required), `slug` (required, auto-generated from name), `is_holding` (checkbox), `logo_url` (optional)
    - Support both create and edit modes
    - On submit, insert/update via Supabase client
    - _Requirements: Design — CompanyForm_

  - [x] 9.3 Create company members page at `/settings/companies/[slug]/members`
    - Create `src/app/settings/companies/[slug]/members/page.tsx` as a client component
    - Fetch and display `company_members` with joined profile data (name, email, avatar)
    - Include "Add Member" functionality (select existing profile, assign user_type)
    - Include "Remove Member" and "Change User Type" actions
    - Gate management actions with `PermissionGate` for `members.update` / `members.delete`
    - _Requirements: Design — CompanyMembersPage_

  - [ ]* 9.4 Write unit tests for CompanyForm validation
    - Test slug auto-generation from name
    - Test required field validation
    - Test is_holding checkbox behavior
    - _Requirements: Design — CompanyForm_

- [x] 10. Permissions matrix settings page
  - [x] 10.1 Create permissions matrix page at `/settings/companies/[slug]/permissions`
    - Create `src/app/settings/companies/[slug]/permissions/page.tsx` as a client component
    - Fetch all `role_permissions` for the company
    - Render a matrix table: rows = resources (leads, lead_tasks, master_options, companies, members), columns = user types (staff, leader, executive, admin, super_admin)
    - Each cell contains toggles for actions (create, read, update, delete)
    - On toggle, upsert the `role_permissions` row via Supabase client
    - Gate the entire page with `PermissionGate` for admin/super_admin access
    - _Requirements: Design — PermissionsMatrixPage_

  - [ ]* 10.2 Write unit tests for permissions matrix toggle logic
    - Test toggle creates new permission row when none exists
    - Test toggle updates existing permission row
    - Test default-deny behavior when no row exists
    - _Requirements: Design — PermissionsMatrixPage, Permission defaults to deny_

- [x] 11. Checkpoint — Verify settings pages and permissions
  - Ensure company CRUD, member management, and permissions matrix all function correctly. Ask the user if questions arise.

- [x] 12. Integration and final wiring
  - [x] 12.1 Apply `PermissionGate` to existing action buttons across the app
    - Wrap lead create/edit/delete actions in `lead-dashboard.tsx` and `lead-sheet.tsx` with `<PermissionGate resource="leads" action="create|update|delete">`
    - Wrap task actions in `task-board.tsx` and `task-card.tsx` with `<PermissionGate resource="lead_tasks" action="...">`
    - Wrap user management actions in `settings/users/page.tsx` with appropriate gates
    - Hide admin nav items in `sidebar.tsx` based on permissions
    - _Requirements: Design — PermissionGate, Updated Components_

  - [x] 12.2 Update lead and task creation flows to include `company_id`
    - In `lead-form.tsx` (or wherever leads are created), automatically set `company_id` from the active company context
    - In task creation flows, automatically set `company_id` from the active company context
    - Ensure `company_id` is included in all insert operations
    - _Requirements: Design — Schema Changes, leads and lead_tasks company_id NOT NULL_

  - [ ]* 12.3 Write integration tests for multi-tenant data isolation
    - Test that switching companies changes the visible leads
    - Test that holding view shows leads from all companies
    - Test that creating a lead assigns the active company's `company_id`
    - Test that RLS prevents cross-tenant data access
    - _Requirements: Design — RLS Policies, Key Design Decisions_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific sections from the design document for traceability
- Checkpoints ensure incremental validation at key integration points
- The migration (task 1) must be run against the Supabase database before testing any subsequent tasks
- RLS is the safety net for tenant isolation — application-level filters are for performance
