# ADR-004: Schema Separation Instead of a Separate Database

## Status
Accepted

## Date
2026-08-22

## Context

The question of splitting Sales Mission off entirely came back after ADR-002: a separate GitHub repository, a separate Supabase project, and a versioned API between the two apps. ADR-001 had originally decided exactly that before ADR-002 reversed it.

The instinct behind it is sound — developing Sales Mission should not be able to damage the production CRM, and mixing a new domain into ~90 migrations of CRM tables in `public` is genuinely untidy.

What changed since ADR-002 argues against splitting, not for it:

- One login across both apps became a firm requirement, and was implemented (ADR-003, shared parent-domain cookie).
- Per-user access control across both apps became a requirement.

Both are identity features. Two Supabase projects mean two `auth.users` tables, so one would have to federate into the other — work Supabase is not designed for, replacing a solved problem with a fragile one.

The rest of the split costs are ongoing rather than one-off:

- Company and contact master data lives in LeadEngine. Every mission create and every live search becomes a cross-service call, and LeadEngine being down stops missions being created.
- KPI reporting needs sales names, company names, and tenant. Cross-database joins are impossible, so the data must be replicated or fetched N+1.
- RLS depends on `company_members` in the LeadEngine database. A second database has to replicate tenant membership and keep it in sync; a sync bug in an authorization path is a security hole.
- The API layer itself is unbuilt: nine endpoints plus auth, pagination, idempotency, retry, caching, error contracts, and contract tests, producing no user-visible value.

Database-per-service exists to scale teams and load. Neither pressure applies at this size.

## Decision

Keep one Supabase project and one repository. Give Sales Mission its own Postgres schema instead.

- `sales_mission` schema owns mission tables, their RLS policies, and their grants.
- `public` remains LeadEngine's, including the shared identity tables.
- Neither app reads or writes the other's namespace. LeadEngine CRM data is reached through the versioned API when that work happens.
- Clients query with an explicit `supabase.schema("sales_mission")`. The default schema stays `public` so identity lookups on the same client keep working.

Done while only three tables existed and no query referenced them, which made it a single migration and no code change. The same move after Mission CRUD would have meant rewriting every query.

## Alternatives considered

### Separate repository, separate Supabase, API between them

Rejected. Breaks the shared session and shared authorization that were just built, forces replication of tenant membership into an authorization path, and front-loads weeks of API work with no user-visible result. Revisit if a trigger below fires.

### Leave everything in `public`

Rejected. It works, but a new domain sharing a namespace with ~90 migrations of CRM tables invites collisions and accidental cross-domain queries, and nothing in the database objects to either.

### Separate repository, one Supabase

Rejected for now. A repo split is far cheaper to do later than a database split, and it buys nothing at this team size — shared types and single-PR cross-cutting changes are worth more.

## When to revisit

Split for real if any of these become true:

1. Sales Mission is sold outside Werkudara, so its tenancy and compliance model diverges.
2. A separate team owns it on its own release cadence and the shared repo becomes a bottleneck.
3. Load characteristics diverge far enough that the two need independent scaling.

If only one thing is ever separated, separate the repository — never the identity store. A split identity is the one part that cannot be undone without a painful user migration.

## Consequences

### Positive

- Real namespace isolation with separate grants, at the cost of one migration.
- Mission migrations no longer touch the CRM namespace.
- Identity, joins, RLS model, and shared session all keep working unchanged.

### Negative

- `sales_mission` must be added to Exposed schemas in the Supabase dashboard, or PostgREST refuses to serve it. This is manual and easy to forget in a new environment.
- Every mission query must name the schema explicitly; forgetting it silently targets `public`.
- Realtime on a non-public schema needs the tables added to the publication before it works.
- One database still means one blast radius. Migration review remains the control.
