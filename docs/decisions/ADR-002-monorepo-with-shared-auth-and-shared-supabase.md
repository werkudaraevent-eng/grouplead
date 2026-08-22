# ADR-002: Monorepo with Shared Auth and One Supabase Project

## Status
Accepted. The Entra/Azure provider choice is superseded by ADR-003; the monorepo, one-Supabase-project, and shared-session decisions still stand.

## Date
2026-07-22

## Context

Sales Mission and LeadEngine need consistent UI/UX, faster development, and shared tooling. Separate repositories would duplicate authentication, design-system, and API contract work.

The applications still have different data ownership and deployment needs. Sales Mission business data must not couple directly to LeadEngine CRM tables.

## Decision

Use one monorepo with separate applications:

```text
apps/leadengine
apps/sales-mission
packages/ui
packages/auth
packages/api-contracts
```

Use one Supabase project for both applications:

```text
LeadEngine → shared Supabase project
Sales Mission → shared Supabase project
```

Configure Azure provider once in the shared Supabase project. Use one Supabase `auth.users` table and one identity/session system. Share provider-neutral helpers, UI components, and validated API contracts.

## Why one Supabase project

- LeadEngine and Sales Mission need the same login and user identity.
- One `auth.users` table removes duplicate profiles and identity mapping.
- One Supabase Auth callback and provider configuration reduce setup errors.
- Monorepo plus shared database tooling is faster for this current stage.
- RLS and table naming still keep Sales Mission data isolated.

One Supabase project increases database blast radius. Enforce table ownership, tenant scoping, RLS, and migration review.

## Authentication model

The same Supabase user session authenticates into both apps. Both apps use the same Supabase user ID.

Sharing one Supabase project gives one `auth.users` row, not one session. Supabase's SSR cookie is host-bound by default, so `crm.werkudara.com` and `mission.werkudara.com` would each hold a separate session. Both apps therefore set an explicit parent cookie domain through `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` (`authCookieOptions()` in `utils/supabase/cookie-options.ts`), applied to the browser, server, and proxy clients.

Local development leaves the value empty. Cookies ignore ports, so `localhost:3000` and `localhost:3001` already share a jar and behave as if SSO worked — which means a missing production value fails only in production. Treat the variable as required in every deployed environment, and keep it identical in both apps or they write two different cookies.

### Rollout note

Switching an environment from host-only to parent-domain cookies leaves the old host-only cookie in place. The browser then sends two cookies with the same name and the app may read the stale one. On first deploy of this change, expire the old cookies or have users sign out once.

Both apps use the same Supabase Auth provider and profile. Cross-app authorization still checks app access, tenant membership, role, and RLS. LeadEngine remains authority for CRM users and tenant membership.

Entra `tid + oid` can be retained for audit and future migrations. It is not required for basic app-to-app identity when both apps use the same Supabase project.

## Consequences

### Positive

- Shared UI and design tokens.
- Shared Entra claim parsing and OAuth scope constants.
- One repository and one change review.
- Separate deployments remain possible.
- One Supabase Auth configuration and one user identity remain intact.

### Negative

- Workspace tooling is more complex than one standalone app.
- Shared packages need stable interfaces and ownership rules.
- One Supabase project has a larger blast radius if RLS or migrations are wrong.

## Guardrails

- Sales Mission may use the shared Supabase project, but its tables remain domain-owned and tenant-scoped.
- Every Sales Mission business table is tenant-scoped.
- API responses are schema-validated.
- Client-provided tenant IDs never determine authorization.
- Both apps use the same Supabase URL and anon key; service-role use remains server-only.
- A shared session grants no authorization by itself. App access, tenant membership, role, and RLS are still checked per request.
- The shared cookie domain covers every subdomain under it. Do not host untrusted applications on a sibling subdomain.
- Shared packages contain no application-specific database queries.