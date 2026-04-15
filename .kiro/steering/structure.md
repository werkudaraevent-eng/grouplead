# Project Structure

## Canonical Reference
The authoritative system document is [docs/leadengine-system-overview.md]. This file provides a quick structural map.

```
src/
├── app/                            # Next.js App Router pages
│   ├── layout.tsx                  # Root layout (providers + MainLayout)
│   ├── page.tsx                    # Home — Analytics dashboard
│   ├── globals.css                 # Global styles + Tailwind
│   ├── actions/
│   │   ├── auth-actions.ts         # Auth server actions
│   │   ├── lead-actions.ts         # Lead CRUD server actions
│   │   └── user-actions.ts         # User provisioning server actions
│   ├── leads/
│   │   ├── page.tsx                # Pipeline view (LeadDashboard)
│   │   └── [leadId]/page.tsx       # Lead detail page
│   ├── companies/
│   │   ├── page.tsx                # Client companies list
│   │   └── [companyId]/page.tsx    # Client company detail
│   ├── contacts/
│   │   ├── page.tsx                # Contacts list
│   │   └── [contactId]/page.tsx    # Contact detail
│   ├── dashboard/tasks/page.tsx    # Legacy task board (not active scope)
│   ├── login/                      # Auth pages
│   └── settings/
│       ├── page.tsx                # Settings landing
│       ├── profile/page.tsx        # User profile
│       ├── users/page.tsx          # User management
│       ├── permissions/page.tsx    # RBAC permissions matrix
│       ├── master-options/page.tsx # Master option management
│       ├── pipeline/
│       │   ├── page.tsx            # Pipeline list
│       │   └── [pipelineId]/page.tsx # Pipeline detail/stages
│       └── companies/
│           ├── page.tsx            # Company settings list
│           ├── new/page.tsx        # New company setup
│           └── [slug]/members/page.tsx # Company member management
│
├── features/                       # Feature-driven domain modules
│   ├── leads/components/           # Lead UI (kanban, table, form, sheet, analytics)
│   ├── companies/components/       # Company UI (form, detail, import, timeline)
│   ├── contacts/components/        # Contact UI (form, detail, import, timeline)
│   ├── users/components/           # User UI (create, edit, permissions, targets)
│   └── tasks/components/           # Legacy task UI (not active scope)
│
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── layout/
│   │   ├── main-layout.tsx         # Shell: sidebar + content area
│   │   ├── sidebar.tsx             # Navigation sidebar
│   │   └── company-switcher.tsx    # Multi-company dropdown
│   ├── shared/
│   │   ├── data-table.tsx          # Generic TanStack data table
│   │   ├── entity-combobox.tsx     # Company/Contact pickers
│   │   ├── currency-input.tsx      # IDR currency input
│   │   └── multi-date-picker.tsx   # Multi-date picker
│   └── app-nav.tsx                 # Legacy top nav
│
├── contexts/
│   ├── company-context.tsx         # Active company provider
│   ├── permissions-context.tsx     # RBAC permissions provider
│   └── sidebar-theme-context.tsx   # Sidebar UI preferences
│
├── hooks/
│   └── use-master-options.ts       # Dynamic dropdown options hook
│
├── types/
│   ├── index.ts                    # Core types (Lead, Profile, Pipeline, etc.)
│   ├── company.ts                  # Company, CompanyMember, Role, Permission types
│   └── tasks.ts                    # Legacy LeadTask types
│
├── lib/
│   └── utils.ts                    # cn() helper
│
└── utils/
    ├── company.ts                  # getActiveCompany helper
    └── supabase/
        ├── client.ts               # Browser Supabase client
        ├── server.ts               # Server Supabase client (cookies)
        └── scoped-query.ts         # Company-scoped query helper
```

## Conventions
- Feature components: `src/features/<domain>/components/`
- Shared components: `src/components/shared/`
- shadcn/ui primitives: `src/components/ui/`
- Layout components: `src/components/layout/`
- Server Actions: `src/app/actions/`
- Types centralized in `src/types/`
- Server components for data-fetching pages
- Client components (`"use client"`) for interactive UI
- Import paths: `@/features/<domain>/components/<file>`, `@/components/shared/<file>`
- RLS is the security boundary — UI permission checks are convenience only
