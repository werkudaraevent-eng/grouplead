# Sales Mission Implementation Tasks

- [ ] Task 1: Create `apps/sales-mission` application shell inside monorepo
  - Acceptance: App boots independently from LeadEngine; environment and deployment docs exist.
  - Verify: `npm run build`; smoke test root route.
  - Dependencies: None.

- [ ] Task 2: Define identity, tenant, role, and LeadEngine API contracts
  - Acceptance: Typed schemas cover user lookup, tenant memberships, company/contact search, and create/review responses.
  - Verify: Contract tests reject invalid external payloads.
  - Dependencies: Task 1.

- [ ] Task 3: Create tenant-scoped Sales Mission schema and RLS
  - Acceptance: Core mission, assignment, result, snapshot, and history tables enforce tenant scope.
  - Verify: Migration tests prove cross-tenant reads/writes are blocked.
  - Dependencies: Task 2.

- [ ] Task 4: Create mission with company live search and snapshots
  - Acceptance: Company required; contact optional; existing and pending company flows preserve IDs and snapshots.
  - Verify: Unit/API tests cover existing company, new company, API failure, and idempotent retry.
  - Dependencies: Task 3.

- [ ] Task 5: Add primary/supporting assignment workflow
  - Acceptance: One primary and many supporting sales; primary acceptance required; supporting rejection non-blocking; reschedule request requires admin decision.
  - Verify: State transition tests cover accept, reject, reassign, request, approve, and reject reschedule.
  - Dependencies: Task 4.

- [ ] Task 6: Add conflict detection and configurable travel buffer
  - Acceptance: Admin setting defaults to 30 minutes; all assigned sales are checked; approval is blocked on conflict.
  - Verify: Boundary tests cover overlap, exact buffer boundary, same location option, and concurrent approval.
  - Dependencies: Task 5.

- [ ] Task 7: Add calendar and list views
  - Acceptance: Sales sees My Missions; Admin sees filtered tenant-scoped calendar/list; actions are permission-aware.
  - Verify: Component tests and browser smoke tests.
  - Dependencies: Task 5.

- [ ] Task 8: Add repeatable contacts and supporting notes
  - Acceptance: One mission supports many contacts; supporting notes preserve author and timestamp; name-only contacts are not auto-matched.
  - Verify: Data and permission tests.
  - Dependencies: Task 4.

- [ ] Task 9: Add result form submission and required validation
  - Acceptance: Dynamic required validation blocks invalid submit; primary submits main result; submitted result enters KPI.
  - Verify: Form tests cover validation, submit, resubmit, and KPI inclusion.
  - Dependencies: Tasks 5 and 8.

- [ ] Task 10: Add autosave, retry state, and attachments
  - Acceptance: Draft autosaves; failed requests show Pending sync and retry; final submit requires connection; uploads are permission-checked.
  - Verify: Browser/network-failure tests.
  - Dependencies: Task 9.

- [ ] Task 11: Add `NEEDS_CLARIFICATION` flow
  - Acceptance: Admin can request a specific clarification without deleting prior result; sales resubmits a new version.
  - Verify: Version/history tests.
  - Dependencies: Task 9.

- [ ] Task 12: Add mission types and versioned dynamic templates
  - Acceptance: Admin creates mission type/template/fields without code; existing missions retain captured template version.
  - Verify: Template versioning and archive tests.
  - Dependencies: Task 9.

- [ ] Task 13: Add admin operational settings
  - Acceptance: Buffer, conflict behavior, options, and notification settings are configurable and audited.
  - Verify: Settings permission and audit tests.
  - Dependencies: Tasks 6 and 12.

- [ ] Task 14: Add in-app notifications and delivery records
  - Acceptance: Assignment, response, reschedule, update, cancellation, submission, and clarification events create in-app notifications.
  - Verify: Event-to-recipient tests.
  - Dependencies: Tasks 5 and 11.

- [ ] Task 15: Add Sales Mission KPI/reporting dashboard
  - Acceptance: Dashboard reports completed missions, results, sales, companies, types, opportunities, next actions, contacts, and clarification flags.
  - Verify: Query fixture tests and tenant-isolation tests.
  - Dependencies: Tasks 9 and 11.
