# Implementation Plan: Sales Mission Application

## Overview

Build `apps/sales-mission` inside this monorepo with a separate deployment and Supabase project. Share UI utilities, auth claim helpers, and API contracts with LeadEngine. Keep Sales Mission business data isolated and use versioned LeadEngine APIs for users, client companies, and contacts.

## Architecture decisions

- Monorepo with separate `apps/leadengine` and `apps/sales-mission` applications.
- Separate deployment for each application.
- Shared Supabase project and Microsoft Entra identity/session.
- Separate Sales Mission business schema and RLS domain within shared database.
- Shared UI, auth utilities, and validated API contracts only.
- No direct database access across applications.
- Company/contact master data remains in LeadEngine.
- Mission result/reporting remains in Sales Mission.
- Dynamic mission types and form templates are admin-configurable.
- Required validation occurs before result submission; normal submitted results enter KPI immediately.
- `NEEDS_CLARIFICATION` is optional post-submission feedback, not mandatory approval.

## Dependency graph

```text
Identity + tenant contract
        ↓
Sales Mission schema + RLS
        ↓
LeadEngine API client + schemas
        ↓
Mission create/assign flow
        ↓
Calendar/list and assignment actions
        ↓
Result form + autosave
        ↓
Configurable templates
        ↓
Reporting and notifications
```

## Task list

### Phase 1: Foundation

- [ ] Task 1: Create `sales-mission` repository and application shell.
- [ ] Task 2: Define shared identity, tenant, role, and API contracts.
- [ ] Task 3: Create tenant-scoped Sales Mission schema and RLS.

### Checkpoint: Foundation

- [ ] Authentication works.
- [ ] Tenant switch works.
- [ ] Unauthorized tenant access returns 403/no data.
- [ ] Schema migrations and tests pass.

### Phase 2: Scheduling

- [ ] Task 4: Create mission with company live search and snapshots.
- [ ] Task 5: Add primary/supporting assignment workflow.
- [ ] Task 6: Add conflict detection and configurable travel buffer.
- [ ] Task 7: Add calendar and list views.

### Checkpoint: Scheduling

- [ ] Admin can create and assign mission.
- [ ] Primary acceptance is required.
- [ ] Supporting rejection is non-blocking.
- [ ] Conflicting approval is blocked.

### Phase 3: Results

- [ ] Task 8: Add repeatable contacts and supporting notes.
- [ ] Task 9: Add result form submission and required validation.
- [ ] Task 10: Add autosave, retry state, and attachments.
- [ ] Task 11: Add `NEEDS_CLARIFICATION` flow.

### Checkpoint: Results

- [ ] Sales can complete a mobile-first result form.
- [ ] Multiple contacts are preserved.
- [ ] Supporting notes remain separate.
- [ ] Submitted results enter reporting immediately.

### Phase 4: Configuration and reporting

- [ ] Task 12: Add mission types and versioned dynamic templates.
- [ ] Task 13: Add admin operational settings.
- [ ] Task 14: Add in-app notifications and delivery records.
- [ ] Task 15: Add Sales Mission KPI/reporting dashboard.

### Checkpoint: Complete

- [ ] Admin can add mission type and fields without code.
- [ ] Existing missions retain their template version.
- [ ] KPI/reporting matches submitted mission results.
- [ ] API, security, accessibility, and performance review complete.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LeadEngine API unavailable | Medium | Validate responses, cache read-only lookup data, make master writes explicit and retryable. |
| Tenant context mismatch | High | Server-side membership validation and tenant-scoped RLS. |
| Duplicate company/contact | High | External IDs, snapshots, review queues, no name-only auto-match. |
| Dynamic form drift | Medium | Version templates and archive used fields. |
| Schedule conflict race | High | Recheck conflict inside approval transaction. |
| Mobile connectivity loss | Medium | Server autosave, local pending state, retry; no full offline promise. |

## Open questions

- LeadEngine API authentication mechanism and final endpoint contract.
- Shared identity/session implementation across domains.
- Hosting and deployment platform for new repository.
- Attachment storage provider and limits.
- Final notification provider for email and WhatsApp.
