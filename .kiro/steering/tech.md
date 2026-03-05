# Tech Stack & Build System

## Framework
- **Next.js 16** (App Router) with React 19
- TypeScript (strict mode)
- Server Components by default; `"use client"` directive for interactive components

## Backend
- **Supabase** (hosted Postgres) for database, auth, and real-time
- `@supabase/ssr` for both server and client Supabase clients
- Server client: `src/utils/supabase/server.ts` (uses cookies)
- Browser client: `src/utils/supabase/client.ts`
- SQL migrations live in `supabase/` directory
- Database triggers auto-sync task completions to lead SLA columns

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
