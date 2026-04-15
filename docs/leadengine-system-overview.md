# LeadEngine System Overview

> Last verified against the repository state on 2026-04-14.
> Canonical intent: describe the system that is actually implemented in this repo today.
> If this document conflicts with code, server actions, or SQL migrations, the code and schema win until this file is updated.

## Purpose And Scope

LeadEngine is an internal business application for Werkudara Group. It is not a generic marketing website and it is no longer just a single-table lead tracker. The current system is a multi-company, permission-aware CRM app built on Next.js and Supabase.

The active product focus is:

- lead tracking
- company database management
- contact database management
- supporting configuration for permissions, pipelines, and form behavior
- management-facing analytics and reporting from lead/company/contact data

Department-based workflow/task management is no longer part of the intended active product scope, even though some legacy implementation artifacts still exist in the repo.

This document describes:
- the routes that exist today
- the current domain model and table landscape
- the active auth, company-scoping, and RLS model
- the major read and write boundaries in the app
- the current state of audit and activity tracking

This document does not describe:
- planned features that are not yet implemented
- visual redesign goals that only exist in `reference/`
- legacy schema snapshots that have already been superseded by later migrations

## Product Surface

### Live Route Map

The implemented route surface in [`src/app`](D:\Website\Group Lead 2026\src\app) is:

- `/`
  - dashboard landing page with current analytics widgets
- `/login`
  - authentication entry
- `/leads`
  - pipeline and lead management
- `/leads/[leadId]`
  - lead detail page
- `/companies`
  - client company list
- `/companies/[companyId]`
  - client company detail page
- `/contacts`
  - contact list
- `/contacts/[contactId]`
  - contact detail page
- `/dashboard/tasks`
  - legacy residual route exists in the codebase, but it is not part of the active product focus
- `/settings`
  - settings landing page
- `/settings/profile`
  - user profile/preferences
- `/settings/users`
  - user management
- `/settings/permissions`
  - role and permission management
- `/settings/master-options`
  - master option management
- `/settings/pipeline`
  - pipeline list/settings
- `/settings/pipeline/[pipelineId]`
  - pipeline detail/settings
- `/settings/companies`
  - company settings list
- `/settings/companies/new`
  - new company setup
- `/settings/companies/[slug]/members`
  - company member management

### Notable Missing Route

The repo does not currently implement:

- `/activity`

Any documentation that describes `/activity` as a live page should be treated as proposal/spec material, not current system behavior.

### Current Dashboard Reality

The current dashboard surface exists on `/` and renders analytics widgets from lead data. It already functions as a management-facing read surface, but it is not yet the full goal-governance and reporting system now being designed.

Current dashboard limitations that matter for future planning:

- no goal settings CMS
- no canonical goal period model
- no snapshot-based management reporting model
- no configurable period attribution engine
- no unified attainment vs forecast governance

## System Shape

### Application Layering

The repo follows a mostly feature-driven structure:

- [`src/app`](D:\Website\Group Lead 2026\src\app)
  - route composition layer and page entry points
- [`src/features`](D:\Website\Group Lead 2026\src\features)
  - feature UI, domain-specific components, and some feature logic
- [`src/components`](D:\Website\Group Lead 2026\src\components)
  - shared UI primitives and layout shell
- [`src/app/actions`](D:\Website\Group Lead 2026\src\app\actions)
  - server actions for mutations and cache invalidation
- [`src/utils/supabase`](D:\Website\Group Lead 2026\src\utils\supabase)
  - Supabase browser/server clients and scoped-query helpers
- [`supabase/migrations`](D:\Website\Group Lead 2026\supabase\migrations)
  - schema evolution and security model

### Tech Stack

Current implementation is built with:

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase SSR + browser clients
- Tailwind CSS v4
- shadcn/Radix UI primitives
- React Hook Form + Zod
- TanStack Table

## Domain Model

### Core Business Domains

The current app is organized around these primary domains:

1. `companies`
   - internal tenant companies/business units
   - supports holding-company behavior

2. `company_members`
   - maps users to companies and user types

3. `profiles`
   - user profile and org data layered on top of Supabase auth users

4. `leads`
   - sales/event opportunities
   - now standardized beyond the original 60-column snapshot

5. `client_companies`
   - CRM client organizations
   - distinct from tenant `companies`

6. `contacts`
   - CRM contacts linked to `client_companies`

7. `pipelines`, `pipeline_stages`, `transition_rules`
   - configurable pipeline behavior and stage movement rules

8. `master_options`
   - dynamic option values for many form/classification fields

9. `form_schemas`
   - dynamic form field configuration and layout metadata

10. `roles`, `role_permissions`, `app_modules`
   - role and permission model for company-scoped access control

11. `lead_tasks`
   - legacy workflow/tasking domain still present in schema and code, but no longer part of the intended active product scope

12. activity/audit tables
   - currently fragmented across multiple tables instead of a single canonical activity log

### Important Domain Distinction

The system uses both `companies` and `client_companies`, and they are not the same thing:

- `companies`
  - internal tenant/business unit records
  - used for access scoping and holding-company logic

- `client_companies`
  - customer/client organizations in the CRM
  - used as business entities attached to leads and contacts

Any documentation that collapses these into one concept is inaccurate.

### Types As Current Source Hints

The current TypeScript domain shape is centralized mainly in:

- [`src/types/index.ts`](D:\Website\Group Lead 2026\src\types\index.ts)
- [`src/types/company.ts`](D:\Website\Group Lead 2026\src\types\company.ts)
- [`src/types/tasks.ts`](D:\Website\Group Lead 2026\src\types\tasks.ts)
  - legacy residual typing for the old task/workflow slice

Important current role/user-type vocabulary includes:

- `staff`
- `leader`
- `executive`
- `admin`
- `super_admin`

Older role names like `director`, `bu_manager`, `sales`, and `finance` still appear in older docs and some migration history, but they are not the only valid current vocabulary and should not be treated as the canonical app-level model.

## Schema Reality

### How To Read The Schema In This Repo

There is no single SQL file in the repo that perfectly represents the live schema.

Practical source-of-truth order should be:

1. latest relevant migrations in [`supabase/migrations`](D:\Website\Group Lead 2026\supabase\migrations)
2. app usage in [`src/app/actions`](D:\Website\Group Lead 2026\src\app\actions) and feature pages
3. current TypeScript types in [`src/types`](D:\Website\Group Lead 2026\src\types)

[`supabase/migrations/schema.sql`](D:\Website\Group Lead 2026\supabase\migrations\schema.sql) is a legacy snapshot and should not be treated as the canonical live schema.

### Key Schema Evolution Signals

Important migrations that define the current shape include:

- [`migration_multi_company.sql`](D:\Website\Group Lead 2026\supabase\migrations\migration_multi_company.sql)
  - adds `companies`, `company_members`, `company_id` scoping, and early role permissions
- [`rls_multi_company.sql`](D:\Website\Group Lead 2026\supabase\migrations\rls_multi_company.sql)
  - introduces helper functions and company-scoped RLS model
- [`20260308055300_create_client_companies_and_contacts.sql`](D:\Website\Group Lead 2026\supabase\migrations\20260308055300_create_client_companies_and_contacts.sql)
  - introduces CRM company/contact split
- [`20260311054837_standardize_leads_schema.sql`](D:\Website\Group Lead 2026\supabase\migrations\20260311054837_standardize_leads_schema.sql)
  - removes many older lead fields and standardizes the lead model
- [`20260305081216_create_pipeline_stages.sql`](D:\Website\Group Lead 2026\supabase\migrations\20260305081216_create_pipeline_stages.sql)
  - early pipeline stage model
- later pipeline, form schema, dynamic role, and activity migrations

### Table Inventory Summary

This is the current high-level table landscape implied by migrations, types, and actions:

- identity and tenancy
  - `profiles`
  - `companies`
  - `company_members`

- permissions and roles
  - `role_permissions`
  - `roles`
  - `app_modules`

- CRM core
  - `leads`
  - `client_companies`
  - `contacts`

- pipeline configuration
  - `pipelines`
  - `pipeline_stages`
  - `transition_rules`
  - closure restriction-related data

- settings/configuration
  - `master_options`
  - `form_schemas`
  - layout/config-related tables

- operational/tasking
  - `lead_tasks` as a legacy residual table family rather than an active product focus

- audit/activity
  - `lead_activities`
  - `lead_stage_history`
  - `company_activities`
  - contact/company note-related records and triggers

## Auth, Tenancy, And RLS

### Auth Model

Authentication is handled by Supabase. The app uses:

- browser client in [`src/utils/supabase/client.ts`](D:\Website\Group Lead 2026\src\utils\supabase\client.ts)
- server client in [`src/utils/supabase/server.ts`](D:\Website\Group Lead 2026\src\utils\supabase\server.ts)

Server actions use the server client for authenticated data mutations and cache invalidation.

### Company Scoping Model

The implemented tenancy model is company-scoped, with a holding-company exception.

Key helper functions from [`rls_multi_company.sql`](D:\Website\Group Lead 2026\supabase\migrations\rls_multi_company.sql):

- `fn_user_company_ids()`
  - returns the set of company IDs the current user belongs to
- `fn_user_has_holding_access()`
  - returns whether the current user belongs to a holding company

### Security Principle

The database is the authority for access control.

This means:

- RLS is the real security boundary
- client-side permission checks are convenience/UI behavior only
- company context in React is advisory, not authoritative
- any feature that depends only on UI gating is not secure enough by itself

### Current RLS Reality

The repo includes both:

- older permissive policy history
- newer company-scoped RLS policies

For modern behavior, the multi-company RLS files should be treated as more authoritative than older permissive snapshots.

## Read Paths

### Major Read Boundaries

The app currently reads data through a mix of:

- server-rendered route pages
- client-side Supabase queries
- scoped query helpers

High-value active read areas include:

- dashboard analytics
- pipeline board and lead detail
- company list/detail
- contact list/detail
- settings pages for users, permissions, pipelines, companies, and master options

Legacy residual read surface:

- `/dashboard/tasks`

### Query Discipline

For maintainers and agents, the intended rule should be:

- company/holding visibility must be enforced at the SQL/RLS layer
- client queries may exist, but only where RLS makes them safe
- route/UI filtering is not a substitute for authorization

## Write Paths

### Current Write Boundary

The app uses server actions as the main write boundary for privileged mutations.

Important action files:

- [`src/app/actions/auth-actions.ts`](D:\Website\Group Lead 2026\src\app\actions\auth-actions.ts)
- [`src/app/actions/lead-actions.ts`](D:\Website\Group Lead 2026\src\app\actions\lead-actions.ts)
- [`src/app/actions/user-actions.ts`](D:\Website\Group Lead 2026\src\app\actions\user-actions.ts)

### Lead Mutation Notes

[`lead-actions.ts`](D:\Website\Group Lead 2026\src\app\actions\lead-actions.ts) is currently one of the most important write paths. It handles:

- lead create/update/delete
- pipeline stage updates
- lead import flows
- payload sanitation and whitelist enforcement
- cache revalidation

It also demonstrates an important current system trait: some audit/activity writes are still performed during action flows instead of being fully centralized behind one canonical audit model.

The same file also carries legacy knowledge from older workflow/task-oriented iterations of the product, so future cleanup should avoid reintroducing department-task assumptions into active scope.

### Service-Role Caution

Admin operations involving Auth provisioning may legitimately require elevated behavior, but service-role usage should remain tightly constrained to auth admin tasks, not general business writes.

## Current Audit And Activity Reality

### What Exists Today

The repo does not yet have one canonical `activity_logs` implementation that covers the full system.

Current activity/audit behavior is fragmented:

- `lead_activities`
- `lead_stage_history`
- `company_activities`
- note-related company/contact activity behavior
- stage-transition audit helpers in feature code

Examples:

- [`src/app/actions/lead-actions.ts`](D:\Website\Group Lead 2026\src\app\actions\lead-actions.ts)
- [`20260409000000_create_company_activities.sql`](D:\Website\Group Lead 2026\supabase\migrations\20260409000000_create_company_activities.sql)
- [`20260410000000_company_triggers.sql`](D:\Website\Group Lead 2026\supabase\migrations\20260410000000_company_triggers.sql)

### What Does Not Exist Yet

As of this repo state, the following should be treated as not implemented:

- centralized `/activity` page
- canonical `activity_logs` table covering all modules
- one unified audit feed for leads, companies, contacts, settings, and permissions

Existing activity-log requirement docs in `reference/` are therefore product specs, not system truth.

## Settings And Configuration Dependencies

The settings area is not superficial. It is part of the operating system of the app.

Current settings/configuration dependencies include:

- company and member management
- role/permission management
- pipeline configuration
- master options
- form schema/layout configuration
- user profile/UI preferences

Any system-level documentation that omits settings as a core domain is incomplete.

### Out Of Active Scope

The following may still exist in code or migrations, but should not be treated as active product scope:

- department-based lead workflow management
- Trello-style departmental task operations
- task-board driven SLA workflow as a product direction

## Known Drift And Gaps

### Documentation Drift

Current major documentation drift includes:

1. `README.md`
   - still the default Next.js starter text

2. `.kiro/steering/product.md`
   - stale product summary
   - still describes the system as if companies/contacts are derived from leads, RLS is permissive, and department task workflows are active scope

3. `.kiro/steering/structure.md`
   - incomplete route and feature map

4. `.kiro/steering/tech.md`
   - partly right on stack, but incomplete as a system description

5. `reference/activity-log-spec.md` and `reference/requirements-activity-log.md`
   - describe a feature not yet implemented

6. chart/dashboard/form/pipeline spec files in `reference/`
   - useful as design history, but not authoritative system documentation

### Implementation Gaps Worth Tracking

These are not documentation issues only; they are system realities to keep in mind:

- no single canonical system document existed before this file
- audit/activity is fragmented across multiple mechanisms
- some legacy migrations still reflect older permissive or transitional states
- test coverage exists but is still thin compared with system complexity

## Legacy Docs Index

Treat these as historical, proposal, or partial-reference material rather than canonical truth:

| Path | Status | Notes |
| --- | --- | --- |
| [`README.md`](D:\Website\Group Lead 2026\README.md) | stale | default starter text |
| [`.kiro/steering/product.md`](D:\Website\Group Lead 2026\.kiro\steering\product.md) | stale | pre-current multi-company/system reality |
| [`.kiro/steering/structure.md`](D:\Website\Group Lead 2026\.kiro\steering\structure.md) | stale/partial | misses current routes and modules |
| [`.kiro/steering/tech.md`](D:\Website\Group Lead 2026\.kiro\steering\tech.md) | partial | stack summary only |
| [`reference/requirements-activity-log.md`](D:\Website\Group Lead 2026\reference\requirements-activity-log.md) | proposal/spec | not live implementation |
| [`reference/activity-log-spec.md`](D:\Website\Group Lead 2026\reference\activity-log-spec.md) | proposal/spec | not live implementation |
| `reference/dashboard-redesign-spec.md` | historical design brief | not canonical system truth |
| `reference/chart-redesign-spec.md` | historical design brief | not canonical system truth |
| `reference/form-layout-redesign-spec.md` | historical design brief | not canonical system truth |
| `reference/pipeline-settings-spec.md` | partial/historical | useful context, not system truth |

## Maintenance Policy

This file should be maintained with the following rules:

1. if a PR changes routes, domain types, server actions, SQL migrations, or RLS semantics, this document must be reviewed in the same PR
2. code, migrations, and active route behavior outrank prose docs
3. `reference/` is allowed to contain future-state specs, but those files must not be treated as implemented system truth
4. if a feature exists only in prose and not in:
   - `src/app`
   - `src/types`
   - `src/app/actions`
   - `src/utils/supabase`
   - `supabase/migrations`
   it must be labeled proposal, not current state
5. when drift is discovered, update this file first, then decide whether older docs should be rewritten, archived, or explicitly marked legacy

## Working Rule For Agents And Engineers

When onboarding or planning work in this repo, use this document first, then validate details in:

- routes under [`src/app`](D:\Website\Group Lead 2026\src\app)
- types under [`src/types`](D:\Website\Group Lead 2026\src\types)
- write paths under [`src/app/actions`](D:\Website\Group Lead 2026\src\app\actions)
- Supabase helpers under [`src/utils/supabase`](D:\Website\Group Lead 2026\src\utils\supabase)
- latest relevant migrations under [`supabase/migrations`](D:\Website\Group Lead 2026\supabase\migrations)

This file is now the baseline system overview until replaced by a newer canonical document.
