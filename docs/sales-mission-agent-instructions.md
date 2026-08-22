# Sales Mission AI Development Instructions

## Role

You are development agent for **Sales Mission**, separate application for scheduling, assignment, visit results, and reporting.

Work from existing repository code first. Do not assume LeadEngine implementation, schema, routes, framework, or deployment details. Inspect repository structure, `package.json`, environment examples, database migrations, and existing auth flow before editing.

## Product boundary

Sales Mission is a separate application inside this monorepo:

```text
LeadEngine   → CRM master data, users, tenant membership, roles
Sales Mission → mission planning, scheduling, assignment, visit results, notes, attachments, reporting
```

Sales Mission must have:

- Separate app folder: `apps/sales-mission`.
- Separate deployment.
- Shared Supabase project and Auth identity with LeadEngine.
- Sales Mission business tables and RLS remain domain-scoped.
- Separate Sales Mission business tables.

Sales Mission must not read or write LeadEngine database directly.

LeadEngine remains source of truth for:

- Internal users.
- User active status and basic roles.
- Internal tenant/company membership.
- `client_companies`.
- `contacts`.
- CRM leads and pipeline data.

Sales Mission remains source of truth for:

- Missions.
- Mission assignments.
- Schedule and conflict checks.
- Initial contact records.
- Mission result submissions.
- Supporting notes.
- Contacts met during mission.
- Attachments.
- Mission reporting and KPI.
- Mission types, templates, and operational settings.

## Non-negotiable authentication architecture

LeadEngine and Sales Mission use **one shared Supabase project** and live in one monorepo.

Sign-in is **Supabase email + password only**. Microsoft/Entra sign-in was removed — see ADR-003.

```text
LeadEngine
  → shared Supabase project
  → email + password

Sales Mission
  → shared Supabase project
  → email + password

Both
  → same auth.users row per person
  → session cookie shared on the parent domain
```

Rules:

- One account per human. Accounts are never shared or handed down — mission attribution depends on `auth.users.id` being one real person.
- Each app keeps its own login page. A user may enter the platform from either app.
- No OAuth callback routes exist. Password recovery runs through `/reset-password`.
- `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` scopes the session cookie to the parent domain so one login covers both apps.

### Display name

`profiles.full_name` is the only source for a person's name. Never derive it from a login provider claim, and never fall back to email — an email address is an identifier, not a name. Fall back to email only for display when `full_name` is empty, and treat that as a data gap to fix.

### Cross-application identity

Both apps use the same Supabase project, so Supabase `user.id` is shared. Still validate app access and tenant membership server-side on every request.

Do not trust client-provided role, tenant ID, or access flags.

### Single active session

Both apps share the `le_active_session_id` cookie on the parent domain ("last login wins"). Any new login path must write that cookie **before** stamping `profiles.active_session_id`, or the sibling app will read a stale id and sign itself out.

## Authorization and access

A valid sign-in proves identity only. It does not grant Sales Mission access.

After Sales Mission login, server-side authorization must verify:

1. Authenticated session exists.
2. Sales Mission profile is active.
3. User is provisioned for Sales Mission.
4. User has valid tenant/company membership.
5. Requested tenant belongs to authenticated user.
6. User role permits requested action.

LeadEngine is authoritative for user and tenant access. Sales Mission must obtain this information through a versioned, authenticated LeadEngine API, not direct SQL.

Do not trust client-provided tenant IDs or access flags. Enforce authorization again in server actions, route handlers, API handlers, and database RLS.

Recommended future access contract:

```text
GET /api/v1/auth/me
GET /api/v1/tenant-memberships
GET /api/v1/users?role=sales&active=true
GET /api/v1/users/{userId}
```

The exact contract must be reviewed against LeadEngine implementation before coding. If endpoint or authentication details are missing, document them as an open question instead of inventing a production contract.

## Tenant and data isolation

Every Sales Mission business table must include tenant scope:

```text
company_id = internal tenant/business unit
```

Do not confuse:

```text
company_id        = internal tenant scope
client_company_id = external CRM customer organization
```

Every query, mutation, report, export, and RLS policy must scope by authorized `company_id`.

Tenant switch flow:

```text
Login
→ load authorized tenant memberships
→ select active tenant
→ validate membership server-side
→ scope every query by company_id
```

Invalid tenant access returns `403` or no data according to existing application convention. Never leak whether another tenant has a record.

## LeadEngine API boundary

Use versioned LeadEngine APIs for users, tenant memberships, client companies, and contacts.

Baseline contract:

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

Treat LeadEngine responses as untrusted external data:

- Validate response shape at the boundary with schemas.
- Handle timeouts and non-2xx responses.
- Use pagination.
- Do not expose upstream tokens or internal errors.
- Use idempotency keys for create operations.
- Preserve consistent error shape:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Safe human-readable message",
    "details": {}
  }
}
```

For company/contact integration, store external ID plus immutable snapshot. Do not name-match automatically. A name-only contact must never be auto-linked.

## MVP business rules

### Mission lifecycle

```text
DRAFT
→ SCHEDULED
→ ASSIGNED
→ ACCEPTED
→ IN_PROGRESS
→ COMPLETED

ASSIGNED → RESCHEDULE_REQUESTED → SCHEDULED/ASSIGNED
ASSIGNED → REJECTED
Any active state → CANCELLED where authorized
```

Rules:

- One primary sales is required.
- Supporting sales are optional and can be multiple.
- Primary sales acceptance is required.
- Supporting sales rejection does not block mission confirmation.
- Sales cannot directly change an accepted schedule.
- Sales requests reschedule with new time and reason.
- Admin approves or rejects reschedule.
- Admin can reassign, reschedule, or cancel.
- Recheck schedule conflicts inside the approval transaction.

### Conflict checks

Configurable settings:

- `conflict_check_enabled`, default `true`.
- `default_travel_buffer_minutes`, default `30`.
- `allow_same_location_back_to_back`, default `false`.
- Business hours and weekend rules when configured.

Check conflicts for primary and supporting sales. Include conflicting company, time, location, and assigned sales in safe UI feedback.

### Results

Primary sales owns final result. Supporting sales writes separate notes and observations.

Required result behavior:

- Required validation blocks incomplete submission.
- Valid submitted results enter KPI/reporting immediately.
- No mandatory generic approval gate.
- Admin may request specific clarification.
- Preserve prior submissions; corrections create a new version or explicit revision.
- Do not overwrite audit history.

Core result fields may include:

- Visit outcome.
- Repeatable contacts met.
- Meeting summary.
- Client needs and pain points.
- Product/service interest.
- Potential opportunity.
- Estimated value, when configured.
- Competitor information, when configured.
- Next action.
- Next action owner.
- Follow-up date.
- Attachments.

MVP does not include GPS, check-in/check-out, full offline mode, late submission metric, or on-time metric unless approved separately.

## Dynamic forms

Built-in mission types:

- `Meeting`.
- `Visit`.
- `Survey`.
- `Follow Up`.

Admin can create mission types and form templates without code.

Templates are versioned. Existing missions retain the template version used at creation. Publishing a new template affects new missions only unless an explicit migration is approved.

## Security rules

Always:

- Validate all HTTP, form, query, upload, webhook, and upstream inputs.
- Enforce authorization server-side.
- Use HTTPS in non-local environments.
- Keep secrets in environment variables or platform secret storage.
- Use secure, httpOnly, sameSite session cookies through approved auth libraries.
- Apply file type, file size, filename, and storage-path restrictions to uploads.
- Add audit events for authentication, authorization, assignment, approval, submission, clarification, and destructive actions.
- Return safe generic errors to clients.
- Rate-limit expensive search, upload, and create operations where supported.

Never:

- Commit secrets, tokens, client secrets, or service-role keys.
- Log access tokens, refresh tokens, raw OAuth payloads, or sensitive PII unnecessarily.
- Use client-side checks as security boundary.
- Query LeadEngine database directly.
- Use email as cross-system primary identity.
- Allow client-provided tenant ID to bypass membership checks.
- Disable RLS to make a feature work.
- Delete audit history or submitted result versions.
- Add dependencies without checking whether existing project dependencies already solve the need.

## Development workflow

Before editing:

1. Inspect repository structure and package scripts.
2. Read existing auth, middleware, Supabase client, migration, and RLS code.
3. Locate current source-of-truth documentation.
4. State assumptions and open questions.
5. Define acceptance criteria and tests.

Implementation:

1. Work in small vertical slices.
2. Write or update tests before changing behavior when practical.
3. Keep UI, server, database, and API boundary concerns separate.
4. Use existing project conventions.
5. Make one logical change per commit.
6. Do not perform unrelated cleanup.

Before commit:

```text
Run project typecheck.
Run project lint.
Run unit tests.
Run build when build script exists.
Run relevant integration/e2e tests.
Review staged diff for secrets and accidental files.
```

Do not claim a check passed without running it.

## Required response format for agent work

For each task, report:

```text
ASSUMPTIONS:
- ...

CHANGES:
- `path`: ...

TESTS:
- `command`: pass/fail

NOT TOUCHED:
- ...

OPEN QUESTIONS:
- ...

RISKS:
- ...
```

Keep changes reviewable. Ask before:

- Changing authentication provider or callback behavior.
- Adding or changing cross-application identity fields.
- Changing RLS policies.
- Adding external API permissions.
- Adding file upload behavior.
- Adding dependencies.
- Changing deployment, CORS, redirect URI, or secret configuration.
- Applying remote production migrations.

## First task for `apps/sales-mission`

Do not start mission UI immediately. First produce an app audit containing:

1. Framework and version.
2. Auth provider and current callback flow.
3. Sales Mission Supabase project configuration locations.
4. Existing migrations and RLS policies.
5. Existing route and server-action conventions.
6. Existing test and build commands.
7. Missing LeadEngine API contract and authentication mechanism.
8. Supabase Redirect URLs required for local, preview, and production (password recovery links are validated against this allow-list).
9. `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` value per environment, identical across both apps.
10. Foundation slice acceptance tests.

Then wait for approval before applying schema or authentication changes.

## Source documents

When available in the Sales Mission repository, treat these as product references:

- `docs/sales-mission-mvp-spec.md`.
- `docs/sales-mission-flows.md`.
- `docs/decisions/ADR-002-monorepo-with-shared-auth-and-shared-supabase.md` (current architecture).
- `docs/decisions/ADR-003-supabase-password-as-only-sign-in.md` (current auth model).
- `docs/decisions/ADR-001-sales-mission-separate-application.md` (superseded, historical).

If implementation and a draft spec conflict, report conflict. Do not silently change business rules.
