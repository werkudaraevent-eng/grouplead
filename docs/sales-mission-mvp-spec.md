# Sales Mission MVP Specification

**Status:** Draft for management review  
**Date:** 2026-07-21  
**Owner:** Werkudara Group

## 1. Objective

Build Sales Mission as a separate application and deployment from LeadEngine. Sales/Admin can schedule confirmed client visits, assign one primary sales plus optional supporting sales, and capture structured visit results. Reporting stays in Sales Mission. LeadEngine remains master for internal users, tenant access, client companies, and contacts.

## 2. Product boundary

### Sales Mission owns

- Mission planning and scheduling
- Initial contact information
- Primary/supporting sales assignment
- Assignment response workflow
- Mission result form submissions
- Supporting notes
- Multiple contacts met during one mission
- Attachments
- Mission reporting and KPI
- Mission-specific settings and configurable form templates

### LeadEngine owns

- Authentication identity
- User status and basic roles
- Tenant/company membership
- `client_companies`
- `contacts`
- CRM leads, pipeline, and opportunities

Sales Mission does not write directly to LeadEngine database. It uses versioned APIs.

## 3. Deployment architecture

```text
crm.werkudara.com       LeadEngine
mission.werkudara.com   Sales Mission

Shared identity and tenant context
Sales Mission -> LeadEngine API for users, companies, and contacts
```

- One monorepo, separate applications (`apps/leadengine`, `apps/sales-mission`). See ADR-002.
- Separate deployment.
- One shared Supabase project. Sales Mission owns the `sales_mission` Postgres schema, with its own tenant-scoped tables, RLS, and grants. LeadEngine keeps `public`.
- `sales_mission` must be listed under Settings → API → Exposed schemas in the Supabase dashboard, or PostgREST will not serve those tables.
- Shared authentication identity and session.
- Auth session cookie is scoped to the parent domain (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`) so one login covers both subdomains.
- Tenant switch available in Sales Mission.
- Every Sales Mission business query is tenant-scoped.
- `company_id` means internal tenant; `client_company_id` means visited customer company.

## 4. Users and permissions

### Admin LeadEngine

- Manage users.
- Activate/deactivate users.
- Manage basic roles.
- Grant/revoke Sales Mission app access.
- Manage tenant membership.

### Admin Sales Mission

- Manage mission types.
- Manage form templates and dynamic fields.
- Manage mission workflow settings.
- Manage travel buffer and conflict rules.
- Manage operational notification settings.
- Manage mission data within accessible tenants.

### Sales

- View assigned missions.
- Accept or reject primary/supporting assignment.
- Request reschedule for assigned mission.
- Add supporting notes.
- Add contacts met.
- Fill and submit primary result when primary sales.
- View own mission calendar and list.

## 5. Mission creation flow

1. Sales or Admin contacts client by phone, email, WhatsApp, or another configured channel.
2. Client confirms visit.
3. Sales/Admin creates mission.
4. Required company is selected through LeadEngine live search.
5. Contact is optional and can be added later.
6. Initial contact details are recorded.
7. Admin/Sales sets date, time, location, mission type, and objective.
8. One primary sales is assigned.
9. Zero or more supporting sales are assigned.
10. System checks conflicts for every assigned sales using configured travel buffer.
11. Primary sales accepts. Supporting sales may accept or reject without blocking confirmation.
12. Mission becomes confirmed and appears in assigned sales schedules.

## 6. Mission lifecycle

```text
DRAFT
  -> SCHEDULED
  -> ASSIGNED
  -> ACCEPTED       (primary sales accepted)
  -> IN_PROGRESS
  -> COMPLETED
  -> CANCELLED

ASSIGNED -> RESCHEDULE_REQUESTED -> SCHEDULED/ASSIGNED
ASSIGNED -> REJECTED              (assignment response only)
```

Rules:

- Primary sales must accept before mission becomes `CONFIRMED`/`ACCEPTED`.
- Supporting sales may remain pending or reject without blocking mission.
- Sales cannot change an accepted schedule directly.
- Sales submits a new time and reason through `Request Reschedule`.
- Admin approves or rejects reschedule request.
- Admin can reassign sales or change schedule directly.
- Assignment rejection is not result rejection.

## 7. Scheduling and conflict rules

Admin-configurable settings:

- `conflict_check_enabled` — default true.
- `default_travel_buffer_minutes` — default 30.
- `allow_same_location_back_to_back` — default false.
- Optional business hours and weekend rules.

Conflict check applies to primary and supporting sales. Approval is blocked when another mission overlaps after buffer calculation. The UI shows conflicting company, time, location, and assigned sales.

Mission already accepted does not change automatically when settings change. New approval decisions use current settings.

## 8. Company and contact integration

### Existing company/contact

- Sales Mission performs live search through LeadEngine API.
- User selects an existing record.
- Sales Mission stores external ID plus immutable snapshot name/details.
- Search and selection do not update LeadEngine.

### New company

- Sales/Admin can input company from Sales Mission.
- LeadEngine creates a `PENDING_REVIEW` record or returns an existing match candidate.
- Mission can continue while company review is pending.
- Admin CRM later chooses `MATCH_EXISTING`, `APPROVE_NEW`, or `REJECT_DUPLICATE`.
- Mapping automatically updates all pending mission relations to master company ID.
- Pending record is retained as alias/history, not hard-deleted.

### Contacts

- Company is required; contact is optional at scheduling time.
- One mission supports multiple contacts.
- Contact can be added during initial contact, scheduling, or field visit.
- Existing contact uses LeadEngine ID plus snapshot.
- New contact goes through LeadEngine review flow.
- Name-only contact is stored as mission snapshot and never auto-matched by name alone.
- Admin CRM chooses `MATCH_EXISTING` or `CREATE_NEW`.

Snapshot fields include:

```text
lead_engine_company_id
company_name_snapshot
lead_engine_contact_id
contact_name_snapshot
job_title_snapshot
email_snapshot
phone_snapshot
link_status
```

Sales Mission does not create LeadEngine timeline/activity records for mission results.

## 9. Initial contact data

Initial contact section is configurable, with stable system metadata:

- Contact channel: phone, email, WhatsApp, other.
- Contact date.
- Contacted by.
- Contact person.
- Conversation summary.
- Client need.
- Visit objective.
- Confirmation status.
- Special notes.

## 10. Mission result

Primary sales owns the final result. Supporting sales writes separate notes.

### Supporting sales can

- Add supporting note.
- Add contacts met.
- Add observation.
- Upload attachment.

### Primary sales can

- See supporting notes.
- Add or edit main result.
- Compile final information.
- Submit result.

Core result data:

- Visit outcome.
- Contacts met, repeatable group.
- Meeting summary.
- Client needs and pain points.
- Product/service interest.
- Potential opportunity.
- Estimated value, if configured.
- Competitor information, if configured.
- Next action.
- Next action owner.
- Follow-up date.
- Attachments.

No GPS, check-in, check-out, full offline mode, late submission metric, or on-time metric in MVP.

## 11. Configurable mission types and forms

Built-in mission types:

- `Meeting`
- `Visit`
- `Survey`
- `Follow Up`

Admin can create additional mission types and templates without code.

### Developer-locked core fields

- Tenant/company context.
- Client company relation.
- Contact relation.
- Schedule.
- Assignment.
- Mission status.
- Result submission identity.
- Reporting identifiers.

### Admin-configurable fields

- Label.
- Field type.
- Required/optional.
- Section.
- Help text.
- Placeholder.
- Options.
- Display order.
- Conditional visibility.
- Active/archive status.
- Reporting key.

Supported field types:

```text
TEXT, LONG_TEXT, NUMBER, CURRENCY, DATE, DATETIME,
SELECT, MULTI_SELECT, RADIO, CHECKBOX, BOOLEAN, FILE,
CONTACT_PICKER, COMPANY_PICKER, REPEATABLE_GROUP
```

Rules:

- Required validation runs before submit.
- Template version is captured when mission is created.
- Existing mission form does not change when admin publishes a new template.
- Admin can explicitly change template only while mission is `DRAFT`.
- Used fields are archived, not deleted.
- Core fields cannot be deleted or have their type changed.
- Template and field changes are audited.

## 12. Result and reporting behavior

Required validation blocks incomplete submission. No mandatory admin approval is needed for normal results.

```text
DRAFT -> validation passes -> SUBMITTED -> KPI/reporting
DRAFT -> validation fails  -> DRAFT
SUBMITTED -> admin finds specific issue -> NEEDS_CLARIFICATION
NEEDS_CLARIFICATION -> sales updates -> SUBMITTED
```

`NEEDS_CLARIFICATION` is for a concrete question about submitted information, not a generic completeness check.

Initial KPI:

- Completed missions.
- Results submitted.
- Results by sales.
- Results by client company.
- Results by mission type.
- Potential opportunities.
- Open next actions.
- Contacts discovered.
- Results needing clarification.

## 13. UI surfaces

### Sales

- My Missions list.
- My Missions calendar.
- Mission detail.
- Accept / Request Reschedule / Reject assignment.
- Supporting notes.
- Mobile-first result form.
- Save Draft / Submit Result.
- Autosave status: `Saved`, `Saving`, `Pending sync`.

### Admin

- All Missions list.
- All Missions calendar.
- Filters: tenant, sales, company, mission type, status, date.
- Create/edit mission.
- Conflict resolution.
- Reschedule request queue.
- Company/contact review links.
- Mission type and form template builder.
- Operational settings.
- Reporting dashboard.

## 14. Autosave and connectivity

- Draft autosaves to server.
- Failed requests are retained locally for retry.
- UI shows sync state.
- Final submit requires active connection.
- MVP does not promise full offline operation.

## 15. Notifications

Default channel: in-app.

Optional admin-configured channels: email and WhatsApp provider.

Initial events:

```text
MISSION_ASSIGNED
ASSIGNMENT_ACCEPTED
ASSIGNMENT_REJECTED
RESCHEDULE_REQUESTED
RESCHEDULE_APPROVED
RESCHEDULE_REJECTED
MISSION_UPDATED
MISSION_CANCELLED
RESULT_SUBMITTED
NEEDS_CLARIFICATION
```

Notification delivery records keep recipient, event, channel, read/sent time, and delivery status. WhatsApp requires an approved provider/template and audit trail.

## 16. Conceptual data model

Every table below lives in the `sales_mission` schema, so the redundant `mission_` prefix is dropped. Built so far: `missions`, `assignments`, `status_history`.

```text
sales_mission.missions
sales_mission.assignments
sales_mission.initial_contacts
sales_mission.contacts
sales_mission.supporting_notes
sales_mission.results
sales_mission.result_submissions
sales_mission.attachments
sales_mission.status_history
sales_mission.form_types
sales_mission.form_templates
sales_mission.form_template_versions
sales_mission.form_fields
sales_mission.settings
sales_mission.notifications
sales_mission.company_link_reviews
sales_mission.contact_link_reviews
```

All tables carrying business data include tenant scope. Submission versions are append-only; corrections create a new version or an explicit revision, never overwrite audit history.

Query them with `supabase.schema("sales_mission").from("missions")`. Do not change the client's default schema: the same client also reads `public` identity tables (`profiles`, `company_members`, `role_permissions`), and switching the default would break those.

## 17. LeadEngine API contract baseline

API version: `/api/v1`.

```text
GET  /api/v1/users?role=sales&active=true
GET  /api/v1/users/{userId}
GET  /api/v1/client-companies?search=&page=&pageSize=
GET  /api/v1/client-companies/{companyId}
POST /api/v1/client-companies
GET  /api/v1/contacts?companyId=&search=&page=&pageSize=
GET  /api/v1/contacts/{contactId}
POST /api/v1/contacts
GET  /api/v1/tenant-memberships
```

Requirements:

- Tenant context is validated server-side.
- List endpoints paginate.
- External response payloads are schema-validated.
- Errors use one structure: `{ error: { code, message, details? } }`.
- Create operations support idempotency keys.
- Breaking changes use a new API version.

## 18. Acceptance criteria

- Sales and Admin can create a mission with required company and optional contact.
- One primary and multiple supporting sales can be assigned.
- Primary acceptance is required; supporting rejection does not block mission.
- Schedule conflicts are detected using admin-configured buffer.
- Sales can request reschedule; only Admin can approve it.
- Sales can add multiple contacts during a mission.
- Existing and new company/contact flows preserve IDs and snapshots.
- Name-only contacts are never auto-matched.
- Admin can create mission types and form templates without code.
- Template versions remain stable for existing missions.
- Required validation blocks incomplete result submission.
- Submitted result enters KPI without mandatory approval.
- Admin can request specific clarification without deleting prior submission.
- Tenant switching scopes all mission data correctly.
- Sales can use list and calendar views.
- Mobile result form supports server autosave and retry state.
- No direct database access crosses app boundaries.

## 19. Out of scope for MVP

- Booking Room integration.
- LeadEngine timeline/activity creation.
- GPS and geofencing.
- Check-in/check-out.
- Full offline mode.
- Late/on-time submission metrics.
- Mandatory admin approval for every result.
- Opportunity creation before company review is complete.

## 20. Implementation boundary

Build Sales Mission in this monorepo under `apps/sales-mission`, with its own deployment. It shares the Supabase project, Auth provider, and session with LeadEngine, and owns its `sales_mission_*` tables, migrations, and RLS policies.

Boundary rules that survive the shared database:

- Sales Mission never reads or writes LeadEngine CRM tables (`client_companies`, `contacts`, leads, pipeline) directly. It goes through the versioned LeadEngine API.
- LeadEngine never reads or writes `sales_mission_*` tables.
- Shared identity/tenant tables (`profiles`, `companies`, `company_members`, `role_permissions`) stay owned by LeadEngine. Sales Mission reads them under RLS and never writes them. `profiles.full_name` is the single source for a person's name and is never overwritten from a login provider (ADR-003).

ADR-001 recorded the original separate-repository/separate-database decision. ADR-002 supersedes it.
