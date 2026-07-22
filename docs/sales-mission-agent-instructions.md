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

Both applications use the **same Microsoft Entra App Registration** and shared Supabase Auth configuration.

```text
LeadEngine
  → shared Supabase project
  → Azure provider

Sales Mission
  → shared Supabase project
  → same Azure provider

Both
  → same Microsoft Entra App Registration
```

Configure Azure provider once in the shared Supabase project. Add its callback URL to the Entra App Registration:

```text
https://<SHARED_PROJECT_REF>.supabase.co/auth/v1/callback
```

Each app also needs its own application callback, for example:

```text
https://crm.werkudara.com/auth/callback
https://mission.werkudara.com/auth/callback
```

Use OAuth scopes:

```text
openid profile email
```

Entra optional claims currently target:

```text
given_name
family_name
```

`name` may not exist in optional claims. Do not depend on it.

Never use email as `full_name`. Resolve display name in this order:

1. `full_name`.
2. `name`.
3. `given_name + family_name`.
4. Safe neutral fallback such as `New User`.

If provider metadata differs from this assumption, inspect real Supabase `auth.users` metadata and identity data before changing code.

### Cross-application identity

Both apps use the same Supabase project, so Supabase `user.id` is shared. Still validate app access and tenant membership server-side.

Use a verified Entra identity key, preferably:

```text
tenant_id + object_id (oid)
```

Also retain:

- Shared Supabase user ID.
- Email as non-authoritative profile attribute.
- Display name as non-authoritative profile attribute.
- Issuer/provider information when available.

Verify claim availability from the actual Supabase provider metadata before adding schema constraints. Do not trust client-provided `oid`, `tid`, role, tenant ID, or access flags.

## Authorization and access

Microsoft login proves identity only. It does not grant Sales Mission access.

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
8. Entra redirect URIs required for local, preview, and production.
9. Proposed cross-app identity mapping using verified Entra claims.
10. Foundation slice acceptance tests.

Then wait for approval before applying schema or authentication changes.

## Source documents

When available in the Sales Mission repository, treat these as product references:

- `docs/sales-mission-mvp-spec.md`.
- `docs/sales-mission-flows.md`.
- `docs/decisions/ADR-001-sales-mission-separate-application.md`.

If implementation and a draft spec conflict, report conflict. Do not silently change business rules.
