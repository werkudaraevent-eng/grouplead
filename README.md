# LeadEngine

Internal CRM and operations system for Werkudara Group, built with Next.js and Supabase.

Current product focus:

- lead tracking
- company database management
- contact database management

## Canonical Documentation

Start here:

- [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md)

That file is the current baseline system document for:

- implemented routes
- domain model
- auth, tenancy, and RLS
- write/read boundaries
- current audit/activity reality
- legacy document status

## Development

Run the app locally:

```bash
npm run dev
```

Other common commands:

```bash
npm run build
npm run start
npm run lint
```

## Environment

Required in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Documentation Rule

If `README.md` or any file in `reference/` or `.kiro/steering/` conflicts with implemented code or migrations, treat the code and [`docs/leadengine-system-overview.md`](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md) as the higher-priority source.
