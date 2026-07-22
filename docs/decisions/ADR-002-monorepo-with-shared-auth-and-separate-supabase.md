# ADR-002: Monorepo with Shared Auth and One Supabase Project

## Status
Accepted

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

The same Supabase user session can authenticate into both apps when cookie/domain deployment strategy supports it. Both apps use the same Supabase user ID.

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
- Shared packages contain no application-specific database queries.