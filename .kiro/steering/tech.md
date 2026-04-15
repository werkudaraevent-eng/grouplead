# Tech Stack & Build System

## Canonical Reference
The authoritative system document is [docs/leadengine-system-overview.md]. This file summarizes stack choices for quick reference.

## Framework
- **Next.js 16** (App Router) with React 19
- TypeScript (strict mode)
- Server Components by default; `"use client"` directive for interactive components

## Backend
- **Supabase** (hosted Postgres) for database, auth, real-time, and RLS-based access control
- `@supabase/ssr` for both server and client Supabase clients
- Server client: `src/utils/supabase/server.ts` (uses cookies)
- Browser client: `src/utils/supabase/client.ts`
- Company-scoped query helper: `src/utils/supabase/scoped-query.ts`
- Active company resolution: `src/utils/company.ts`
- SQL migrations in `supabase/migrations/`
- RLS is the authoritative security boundary — client-side checks are UI convenience only

## UI & Styling
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **shadcn/ui** (new-york style, RSC-enabled) — components in `src/components/ui/`
- **Radix UI** primitives via `radix-ui` package
- **Lucide React** for icons
- `cn()` utility from `clsx` + `tailwind-merge` in `src/lib/utils.ts`
- CSS variables for theming (`cssVariables: true` in shadcn config)

## Forms & Validation
- **React Hook Form** with `@hookform/resolvers`
- **Zod v4** for schema validation

## Data Display
- **TanStack React Table v8** for data tables

## State & Context
- `CompanyProvider` — active company context with cookie-based switching
- `PermissionsProvider` — RBAC permissions context, re-fetches on company change
- `SidebarThemeProvider` — sidebar UI preferences

## Path Aliases
- `@/*` maps to `./src/*`

## Common Commands
```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (flat config, core-web-vitals + typescript)
```

## Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
