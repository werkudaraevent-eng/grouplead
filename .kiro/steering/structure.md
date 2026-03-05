# Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (wraps MainLayout with sidebar)
│   ├── page.tsx                # Home — Lead Pipeline dashboard (server component)
│   ├── globals.css             # Global styles + Tailwind
│   ├── leads/page.tsx          # Pipeline view (same LeadDashboard, alternate route)
│   ├── companies/page.tsx      # Companies list (client component, derived from leads)
│   ├── contacts/page.tsx       # Contacts list (client component, derived from leads)
│   ├── dashboard/tasks/page.tsx # Department task board
│   └── settings/users/page.tsx # User/role management
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── layout/
│   │   ├── main-layout.tsx     # Shell: sidebar + mobile sheet + content area
│   │   └── sidebar.tsx         # Navigation sidebar with main + admin sections
│   ├── lead-dashboard.tsx      # Kanban/table toggle view for leads
│   ├── lead-kanban.tsx         # Kanban board with pipeline stage columns
│   ├── lead-columns.tsx        # TanStack Table column definitions for leads
│   ├── lead-sheet.tsx          # Lead detail side-sheet with tabbed edit form
│   ├── lead-detail-layout.tsx  # 3-column detail layout inside the sheet
│   ├── lead-form.tsx           # New lead form (currently under maintenance)
│   ├── data-table.tsx          # Generic TanStack data table wrapper
│   ├── task-board.tsx          # Department task list with status/dept filters
│   ├── task-card.tsx           # Individual task card with complete action
│   ├── workflow-actions.tsx    # Status transition buttons for leads
│   └── app-nav.tsx             # Top nav bar (legacy, replaced by sidebar)
│
├── hooks/
│   └── use-master-options.ts   # Fetches dynamic dropdown options from master_options table
│
├── types/
│   ├── index.ts                # Lead, MasterOption, LeadInsert, LeadUpdate types
│   └── tasks.ts                # LeadTask type, department/status/priority configs
│
├── lib/
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│
└── utils/
    └── supabase/
        ├── client.ts           # Browser Supabase client (createBrowserClient)
        └── server.ts           # Server Supabase client (createServerClient with cookies)

supabase/                       # Database SQL files
├── schema.sql                  # leads + master_options tables, RLS policies
├── lead_tasks.sql              # lead_tasks table, SLA sync triggers, seed data
├── profiles.sql                # profiles table, auth triggers, RLS, seed data
├── seed.sql                    # Master options seed data
└── seed_leads.sql              # Sample lead records
```

## Conventions
- Server components for pages that fetch data (e.g. `page.tsx` with `export const dynamic = 'force-dynamic'`)
- Client components (`"use client"`) for interactive UI with state, forms, and Supabase browser client calls
- Supabase queries happen either server-side in page components or client-side in `useEffect`/`useCallback` hooks
- No dedicated API routes — components query Supabase directly
- shadcn/ui components are added via the `shadcn` CLI and live in `src/components/ui/`
- Feature components are flat in `src/components/` (not nested by feature)
- Types are centralized in `src/types/`
