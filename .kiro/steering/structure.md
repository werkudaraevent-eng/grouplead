# Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (wraps MainLayout with sidebar)
│   ├── page.tsx                # Home — Analytics dashboard (server component)
│   ├── globals.css             # Global styles + Tailwind
│   ├── actions/
│   │   ├── lead-actions.ts     # Server Actions for lead CRUD
│   │   └── user-actions.ts     # Server Action for user provisioning (Admin API)
│   ├── leads/page.tsx          # Pipeline view (LeadDashboard)
│   ├── companies/page.tsx      # Companies list (client component)
│   ├── contacts/page.tsx       # Contacts list (client component)
│   ├── dashboard/tasks/page.tsx # Department task board
│   ├── login/                  # Auth pages
│   └── settings/
│       ├── users/page.tsx      # User/role management
│       ├── pipeline/page.tsx   # Pipeline stage settings
│       └── companies/          # Multi-company settings
│
├── features/                   # Feature-driven domain modules
│   ├── leads/components/
│   │   ├── analytics-dashboard.tsx  # Charts & KPI cards
│   │   ├── lead-columns.tsx         # TanStack Table column definitions
│   │   ├── lead-dashboard.tsx       # Kanban/table toggle view
│   │   ├── lead-detail-layout.tsx   # 3-column detail layout inside sheet
│   │   ├── lead-form.tsx            # New lead creation form
│   │   ├── lead-kanban.tsx          # Kanban board with pipeline columns
│   │   ├── lead-sheet.tsx           # Lead detail side-sheet with tabbed edit
│   │   └── edit-lead-modal.tsx      # Edit lead dialog
│   ├── users/components/
│   │   ├── create-user-modal.tsx    # Direct user provisioning modal
│   │   ├── edit-user-modal.tsx      # Org structure edit modal
│   │   ├── permission-gate.tsx      # RBAC wrapper component
│   │   ├── profile-combobox.tsx     # User/profile picker combobox
│   │   └── target-management-modal.tsx # Sales quota management
│   ├── tasks/components/
│   │   ├── task-board.tsx           # Department task list with filters
│   │   ├── task-card.tsx            # Individual task card
│   │   └── workflow-actions.tsx     # Status transition buttons
│   └── companies/components/
│       └── company-form.tsx         # Company creation/edit form
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── layout/
│   │   ├── main-layout.tsx     # Shell: sidebar + mobile sheet + content area
│   │   ├── sidebar.tsx         # Navigation sidebar with main + admin sections
│   │   └── company-switcher.tsx # Multi-company dropdown
│   ├── shared/
│   │   ├── data-table.tsx      # Generic TanStack data table wrapper
│   │   └── entity-combobox.tsx # Company/Contact combobox pickers
│   └── app-nav.tsx             # Top nav bar (legacy, replaced by sidebar)
│
├── contexts/
│   ├── company-context.tsx     # Active company provider
│   └── permissions-context.tsx # RBAC permissions provider
│
├── hooks/
│   └── use-master-options.ts   # Fetches dynamic dropdown options
│
├── types/
│   ├── index.ts                # Lead, Profile, PipelineStage, MasterOption types
│   ├── company.ts              # Company, CompanyMember types
│   └── tasks.ts                # LeadTask type, department/status/priority configs
│
├── lib/
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│
└── utils/
    ├── company.ts              # getActiveCompany helper
    └── supabase/
        ├── client.ts           # Browser Supabase client (createBrowserClient)
        ├── server.ts           # Server Supabase client (createServerClient with cookies)
        └── scoped-query.ts     # Company-scoped query helper
```

## Conventions
- Feature components live in `src/features/<domain>/components/` (domain-driven)
- Shared/generic components live in `src/components/shared/`
- shadcn/ui primitives live in `src/components/ui/`
- Layout components live in `src/components/layout/`
- Server Actions live in `src/app/actions/`
- Server components for pages that fetch data (e.g. `page.tsx` with `export const dynamic = 'force-dynamic'`)
- Client components (`"use client"`) for interactive UI with state, forms, and Supabase browser client calls
- Types are centralized in `src/types/`
- Import paths use `@/features/<domain>/components/<file>` for domain components
- Import paths use `@/components/shared/<file>` for shared components
