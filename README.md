# LeadEngine

Internal CRM and operations system for **Werkudara Group**, built with Next.js and Supabase.

Current product focus:

- Lead tracking (pipelines, stages, goals, dashboards)
- Company database management
- Contact database management

---

## Tech Stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Framework    | Next.js 16 (App Router) + React 19                                |
| Language     | TypeScript (strict)                                               |
| Database     | Supabase (Postgres 17) with Row-Level Security                    |
| Styling      | Tailwind CSS v4 + shadcn/ui (new-york variant)                    |
| Forms        | React Hook Form + Zod                                             |
| Tables       | TanStack Table                                                    |
| Charts       | Recharts                                                          |
| Rich text    | Tiptap                                                            |
| Icons        | lucide-react                                                      |
| Testing      | Vitest (unit) + Playwright (e2e)                                  |

---

## Prerequisites

- **Node.js 20+**
- **npm** (repo uses `package-lock.json`)
- A **Supabase** project (or the [Supabase CLI](https://supabase.com/docs/guides/local-development) + Docker for local development)

---

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the template and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   See [Environment Variables](#environment-variables) below for what each key does.

3. Run the dev server (port 3000):

   ```bash
   npm run dev
   ```

---

## Common Commands

```bash
npm run dev            # Local dev server (http://localhost:3000)
npm run build          # Production build
npm run start          # Serve the production build
npm run lint           # ESLint (flat config: next core-web-vitals + typescript)
npm run typecheck      # tsc --noEmit (strict type checking)
npm test               # Vitest — all unit tests
npm run test:e2e       # Playwright e2e tests
npm run test:e2e:ui    # Playwright in UI mode
npm run db:dump-schema # Regenerate docs/schema-current.sql (needs Supabase CLI)
```

Run a single unit test file:

```bash
npx vitest run src/features/goals/lib/__tests__/rollup-engine.test.ts
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and set:

| Variable                        | Required     | Purpose                                                        |
|---------------------------------|--------------|----------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes          | Supabase project URL (client + server).                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes          | Supabase anon key (browser client, RLS-enforced).              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only  | Admin key for server actions + `scripts/` (bypasses RLS). Never expose to the browser. |
| `GEONAMES_USERNAME`             | Optional     | Enables the Event City autocomplete via GeoNames.              |
| `GOOGLE_PLACES_API_KEY`         | Optional     | Alternative city provider for the same autocomplete.           |
| `OPENAI_API_KEY`                | Optional     | AI dashboard analysis features.                                |

E2E tests read `E2E_EMAIL` / `E2E_PASSWORD` (see `.env.test.example`).

---

## Project Structure

```
src/
  app/            Route pages + layout (App Router)
  app/actions/    Server Actions ("use server") — all write operations
  app/api/        Route handlers (e.g. city autocomplete)
  features/       Feature modules (leads, companies, contacts, goals, settings, roles, tasks, users)
  components/     Shared UI primitives + layout shell
  components/ui/  shadcn/ui components (managed via `npx shadcn`)
  config/         Field registries (lead fields, dimension registry)
  contexts/       React contexts (company, permissions, currency, sidebar theme)
  hooks/          Custom hooks (master options, cascade relations)
  lib/            Utilities (field resolution, phone/text normalization, duplicate detection)
  types/          Domain type definitions
  utils/supabase/ Browser client, server client, service client, scoped-query helper

supabase/migrations/  SQL migrations (cumulative — no single canonical schema file)
docs/                 Canonical + working documentation (see docs/README.md)
reference/            Design specs & proposals — NOT implemented features (see reference/README.md)
scripts/              One-off backfill / migration / verification scripts
e2e/                  Playwright end-to-end tests
```

Architectural conventions live in [`AGENTS.md`](AGENTS.md).

---

## Canonical Documentation

Start with [`docs/leadengine-system-overview.md`](docs/leadengine-system-overview.md) — the current baseline system document covering:

- Implemented routes
- Domain model
- Auth, tenancy, and RLS
- Write/read boundaries
- Audit/activity reality
- Legacy document status

An index of all docs lives in [`docs/README.md`](docs/README.md).

---

## Source-of-Truth Priority

When documents disagree, trust sources in this order:

1. Implemented code in `src/` and migrations in `supabase/migrations/`
2. [`docs/leadengine-system-overview.md`](docs/leadengine-system-overview.md)
3. Everything else (`README.md`, `reference/`, `.kiro/steering/`)

If `README.md`, any file in `reference/`, or `.kiro/steering/` conflicts with implemented code or migrations, the **code and the system overview win**.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch, commit, and PR conventions.
