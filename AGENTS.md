# AGENTS.md

## Communication Style

Terse like caveman lite. Technical substance exact. Only fluff die.
Drop: filler (just/really/basically), pleasantries, hedging.
Keep grammar intact. Professional but no fluff.
Code/commits/PRs: normal. Off: "stop caveman" / "normal mode".

## Architectural Rules

- **Field resolution**: Never show "Unspecified" without checking entity relations first. Use `resolveLeadField()` from `src/lib/resolve-lead-field.ts`. Resolution order: lead field → client_company field → null.
- **Currency formatting**: Use `useCurrency()` hook from `src/contexts/currency-context.tsx`. Never hardcode "Rp" or create local formatters. Chart axis labels use `fmtAxis` (always compact).
- **Server actions**: Use `ActionResult<T>` from `src/types/action-result.ts`. Use `createServiceClient()` from `src/utils/supabase/service.ts` for admin operations.

## Project

LeadEngine — internal CRM for Werkudara Group. Next.js 16 App Router + React 19 + Supabase + Tailwind v4 + shadcn/ui (new-york style).

## Commands

```bash
npm run dev          # local dev server (port 3000)
npm run build        # production build
npm run lint         # eslint (flat config, next core-web-vitals + typescript)
npm run typecheck    # tsc --noEmit (strict type checking)
npm test             # vitest run (all unit tests)
npx vitest run src/features/goals/lib/__tests__/rollup-engine.test.ts  # single test file
```

- **CI workflow** in `.github/workflows/ci.yml` runs type check, lint, unit tests, and production build on push/PR to main/develop.
- No pre-commit hooks. No deploy pipeline in the repo.
- Vitest uses `environment: 'node'` with `globals: true`. The `@/` alias resolves to `./src`.

## Architecture

### Source of truth priority

1. `docs/leadengine-system-overview.md` — canonical system doc
2. Latest migrations in `supabase/migrations/`
3. Implemented code in `src/`
4. TypeScript types in `src/types/`

Files in `reference/` are specs/proposals, **not** implemented features. If README or `reference/` conflicts with code, trust the code.

### Directory layout

```
src/app/            Route pages + layout (App Router)
src/app/actions/    Server Actions ("use server") — all write operations go here
src/features/       Feature modules (leads, contacts, companies, goals, settings, roles, tasks, users)
src/components/     Shared UI primitives + layout shell
src/components/ui/  shadcn/ui components (managed by `npx shadcn`)
src/types/          Domain type definitions
src/utils/supabase/ Browser client, server client, scoped-query helper
src/config/         Field registries (lead fields, dimension registry)
src/contexts/       React contexts (company, permissions, sidebar theme)
src/hooks/          Custom hooks (master options, cascade relations)
src/lib/            Utility functions (utils.ts has cn() for tailwind-merge)
supabase/migrations/ SQL migrations (no single canonical schema file)
```

### Key patterns

- **Server Components by default.** Client Components only when interactivity is needed.
- **Server Actions** in `src/app/actions/` handle all mutations. They use `createClient()` from `src/utils/supabase/server.ts` and call `revalidatePath()` after writes.
- **Company scoping**: `scopedQuery()` in `src/utils/supabase/scoped-query.ts` applies `company_id` filter. Holding companies see all data (RLS handles it). Use `getScopedCompanyId()` to determine the filter value.
- **RLS is the security boundary.** Database helper functions `fn_user_company_ids()` and `fn_user_has_holding_access()` drive row-level security.

### Critical domain distinction

`companies` ≠ `client_companies`:
- `companies` = internal tenant/business units (used for access scoping)
- `client_companies` = CRM customer organizations (attached to leads and contacts)

Confusing these will break queries and RLS.

## Environment

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing

- Tests live alongside feature code: `src/features/*/lib/__tests__/` and `src/features/*/lib/*.test.mts`
- Property-based tests use `fast-check` (see `*.property.test.ts` files in goals)
- Test files use both `.test.ts` and `.test.mts` extensions
- No integration tests requiring a running Supabase instance — all tests are pure unit/property tests

## Supabase / Database

- **No single schema file.** The schema is the cumulative result of ~90 migrations in `supabase/migrations/`. `schema.sql` is a legacy snapshot — do not treat it as current.
- Supabase local dev: `supabase start` (requires Docker). Config in `supabase/config.toml`, Postgres 17.
- New migrations: create timestamped `.sql` files in `supabase/migrations/`.
- Key migrations to understand the current model: `migration_multi_company.sql`, `rls_multi_company.sql`, `20260308055300_create_client_companies_and_contacts.sql`, `20260311054837_standardize_leads_schema.sql`.

## Style conventions

- UI components: shadcn/ui (new-york variant, RSC-enabled, Tailwind CSS variables)
- Add shadcn components via `npx shadcn add <component>`
- Path alias: `@/*` maps to `src/*`
- Forms: React Hook Form + Zod validation
- Tables: TanStack Table
- Rich text: Tiptap
- Icons: lucide-react
- Toasts: sonner

## Gotchas

- Several `scratch*.js`, `fix-stages*.js`, and `check-delete.ts` files in the root are one-off debug/migration scripts, not part of the app.
- `lead_tasks` and `/dashboard/tasks` are legacy artifacts — not part of the active product scope.
- Lead actions use a column whitelist (`LEADS_COLUMNS` set) and relational key blocklist to sanitize payloads before DB writes. New lead columns must be added to this whitelist in `src/app/actions/lead-actions.ts`.
- The `src/proxy.ts` file exists at the src root — not a standard Next.js pattern.
