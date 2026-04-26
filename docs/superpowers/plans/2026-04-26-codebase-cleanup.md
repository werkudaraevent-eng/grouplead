# Codebase Cleanup & Quality Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicated code, fix type safety issues, remove dead code, add env validation, and establish CI pipeline.

**Architecture:** Introduce a shared `ActionResult<T>` type, consolidate service client creation into one utility, properly type the GoalDataContext, add runtime env validation, set up GitHub Actions CI, and clean up legacy artifacts.

**Tech Stack:** TypeScript, Next.js 16, Supabase, Vitest, GitHub Actions

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/types/action-result.ts` | Unified `ActionResult<T>` generic type |
| Modify | `src/types/index.ts` | Re-export `ActionResult` |
| Modify | `src/utils/supabase/service.ts` | Add env validation, add `autoRefreshToken: false` |
| Modify | `src/utils/supabase/client.ts` | Add env validation |
| Modify | `src/utils/supabase/server.ts` | Add env validation |
| Modify | `src/app/actions/lead-actions.ts` | Use shared `ActionResult`, remove local type |
| Modify | `src/app/actions/goal-actions.ts` | Use shared `ActionResult`, use `createServiceClient`, remove `console.log` |
| Modify | `src/app/actions/user-actions.ts` | Use shared `ActionResult`, use `createServiceClient`, remove `getAdminClient` |
| Modify | `src/app/actions/auth-actions.ts` | Use shared `ActionResult`, use `createServiceClient`, remove `getAdminClient` |
| Modify | `src/features/goals/contexts/goal-data-context.tsx` | Replace `any` with proper types from `@/types/goals` |
| Delete | `src/features/settings/components/form-layout-builder.backup.tsx` | Dead backup file |
| Create | `.github/workflows/ci.yml` | CI pipeline (type check + lint + test) |

---

### Task 1: Create unified `ActionResult<T>` type

**Files:**
- Create: `src/types/action-result.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create the shared ActionResult type**

```ts
// src/types/action-result.ts

/**
 * Unified result type for all Server Actions.
 * 
 * @template T - Shape of the `data` payload on success (default: void / no data).
 * 
 * Usage:
 *   ActionResult              → { success, error? }
 *   ActionResult<{ id: number }> → { success, error?, data? }
 */
export type ActionResult<T = void> = T extends void
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T }
```

- [ ] **Step 2: Re-export from types barrel**

In `src/types/index.ts`, add at the top (after existing re-exports):

```ts
export type { ActionResult } from './action-result'
```

- [ ] **Step 3: Verify no compile errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "action-result"`
Expected: No errors related to the new file.

- [ ] **Step 4: Commit**

```bash
git add src/types/action-result.ts src/types/index.ts
git commit -m "feat: add unified ActionResult<T> type for server actions"
```

---

### Task 2: Consolidate service client — upgrade `createServiceClient`

**Files:**
- Modify: `src/utils/supabase/service.ts`

- [ ] **Step 1: Update service.ts with env validation and autoRefreshToken**

Replace the entire file content with:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS — use only in trusted server actions.
 *
 * Consolidates the former `getAdminClient()` functions that were
 * duplicated in user-actions.ts and auth-actions.ts.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars'
    )
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/supabase/service.ts
git commit -m "fix: add env validation and autoRefreshToken to createServiceClient"
```

---

### Task 3: Add env validation to browser and server Supabase clients

**Files:**
- Modify: `src/utils/supabase/client.ts`
- Modify: `src/utils/supabase/server.ts`

- [ ] **Step 1: Update client.ts with env validation**

Replace the entire file content with:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
        )
    }
    return createBrowserClient(url, anonKey)
}
```

- [ ] **Step 2: Update server.ts with env validation**

Replace the entire file content with:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
        )
    }

    const cookieStore = await cookies()

    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet: { name: string, value: string, options: CookieOptions }[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/supabase/client.ts src/utils/supabase/server.ts
git commit -m "fix: add env validation to browser and server Supabase clients"
```

---

### Task 4: Migrate `lead-actions.ts` to shared `ActionResult`

**Files:**
- Modify: `src/app/actions/lead-actions.ts`

- [ ] **Step 1: Replace local ActionResult with import**

At the top of the file, replace line 9:

```ts
export type ActionResult = { success: boolean; error?: string; data?: { id: number } }
```

with:

```ts
import type { ActionResult } from '@/types'
```

- [ ] **Step 2: Update function return types**

Update the return type annotations:
- `createLeadAction` → `Promise<ActionResult<{ id: number }>>`
- `updateLeadAction` → `Promise<ActionResult>`
- `updatePipelineStageAction` → `Promise<ActionResult>`
- `deleteLeadAction` → `Promise<ActionResult>`

No changes needed to the function bodies — the return shapes already match.

- [ ] **Step 3: Verify no compile errors**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "lead-actions"`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/lead-actions.ts
git commit -m "refactor: use shared ActionResult<T> in lead-actions"
```

---

### Task 5: Migrate `goal-actions.ts` — shared type + remove console.log

**Files:**
- Modify: `src/app/actions/goal-actions.ts`

- [ ] **Step 1: Replace local ActionResult with import**

Remove line 31:

```ts
type ActionResult = { success: boolean; error?: string; data?: Record<string, unknown> }
```

Add import at the top (after existing imports):

```ts
import type { ActionResult } from '@/types'
```

- [ ] **Step 2: Update function return types that return data**

Functions that return `data`:
- `createGoalV2Action` → `Promise<ActionResult<{ id: string; slug: string }>>`
- `upsertGoalSegmentAction` → `Promise<ActionResult<{ id: string }>>`
- `upsertGoalUserTargetAction` → `Promise<ActionResult<{ id: string }>>`
- `createSavedViewAction` → `Promise<ActionResult<{ id: string }>>`
- `createGoalNodeAction` → `Promise<ActionResult<{ id: string }>>`

Functions that return no data (keep as `Promise<ActionResult>`):
- `updateGoalV2Action`, `deleteGoalV2Action`, `updateGoalSegmentAction`, `deleteGoalSegmentAction`, `deleteGoalUserTargetAction`, `updateGoalSettingsV2Action`, `updateSavedViewAction`, `deleteSavedViewAction`, `updateGoalNodeAction`, `deleteGoalNodeAction`, `reorderGoalNodesAction`, `deleteGoalLevelAction`, `autoInsertGoalHierarchyAction`

- [ ] **Step 3: Remove console.log debug statements**

Remove lines 157 and 163:

```ts
// DELETE this line:
console.log('[updateGoalV2Action] Updating goal', goalId, 'with keys:', Object.keys(updatePayload), 'breakdown_config length:', Array.isArray(updatePayload.breakdown_config) ? (updatePayload.breakdown_config as any[]).length : 'N/A');

// DELETE this line:
console.log('[updateGoalV2Action] Result: error=', error?.message || 'none');
```

- [ ] **Step 4: Add auth check to updateSavedViewAction and deleteSavedViewAction**

In `updateSavedViewAction` (around line 418), add after `const supabase = await createClient()`:

```ts
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
```

In `deleteSavedViewAction` (around line 435), add after `const supabase = await createClient()`:

```ts
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/goal-actions.ts
git commit -m "refactor: use shared ActionResult, remove debug logs, add auth checks in goal-actions"
```

---

### Task 6: Migrate `user-actions.ts` — shared type + use `createServiceClient`

**Files:**
- Modify: `src/app/actions/user-actions.ts`

- [ ] **Step 1: Replace imports and remove getAdminClient**

Replace the top of the file (lines 1-17):

```ts
"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export type ActionResult = { success: boolean; error?: string; userId?: string }

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL env vars")
    }
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}
```

with:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/utils/supabase/service"
import type { ActionResult } from "@/types"
```

- [ ] **Step 2: Update function return types**

- `provisionUserAction` → `Promise<ActionResult<{ userId: string }>>`
- `deactivateUserAction` → `Promise<ActionResult>`

- [ ] **Step 3: Replace `getAdminClient()` calls with `createServiceClient()`**

In `provisionUserAction` (line 33): replace `const supabase = getAdminClient()` with `const supabase = createServiceClient()`

In `deactivateUserAction` (line 89): replace `const supabase = getAdminClient()` with `const supabase = createServiceClient()`

- [ ] **Step 4: Update return statement in provisionUserAction**

Change line 76 from:

```ts
return { success: true, userId: authData.user.id }
```

to:

```ts
return { success: true, data: { userId: authData.user.id } }
```

- [ ] **Step 5: Check for consumers of `ActionResult` from user-actions**

The grep showed no external imports of `ActionResult` from `user-actions.ts`. The `userId` field was only used in the return value. Any caller accessing `.userId` must now use `.data?.userId`. Search for callers:

Run: `rg "provisionUserAction" --include "*.{ts,tsx}" -l` to find callers and update them if they access `.userId`.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/user-actions.ts
git commit -m "refactor: use shared ActionResult and createServiceClient in user-actions"
```

---

### Task 7: Migrate `auth-actions.ts` — shared type + use `createServiceClient`

**Files:**
- Modify: `src/app/actions/auth-actions.ts`

- [ ] **Step 1: Replace entire file content**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/utils/supabase/service"
import type { ActionResult } from "@/types"

/**
 * Admin-only: Force-reset a user's password by UUID.
 * Uses the Service Role Key to bypass RLS and auth restrictions.
 */
export async function adminResetUserPassword(
    userId: string,
    newPassword: string
): Promise<ActionResult> {
    try {
        if (!newPassword || newPassword.length < 8) {
            return { success: false, error: "Password must be at least 8 characters" }
        }

        const supabase = createServiceClient()

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        })

        if (error) {
            return { success: false, error: error.message }
        }

        revalidatePath("/settings/users")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/auth-actions.ts
git commit -m "refactor: use shared ActionResult and createServiceClient in auth-actions"
```

---

### Task 8: Fix `GoalDataContext` — replace `any` with proper types

**Files:**
- Modify: `src/features/goals/contexts/goal-data-context.tsx`

- [ ] **Step 1: Replace entire file content**

```tsx
"use client"

import { createContext, useContext } from "react"
import type { GoalV2, GoalNodeTree, GoalUserTarget, GoalSettingsV2, Lead } from "@/types"

export interface GoalDataContextValue {
  activeGoal: GoalV2 | null
  goalNodes: GoalNodeTree[]
  userTargets: GoalUserTarget[]
  goalSettings: GoalSettingsV2 | null
  leads: Lead[]
}

const GoalDataContext = createContext<GoalDataContextValue | null>(null)

export function GoalDataProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: GoalDataContextValue
}) {
  return (
    <GoalDataContext.Provider value={value}>
      {children}
    </GoalDataContext.Provider>
  )
}

export function useGoalDataContext() {
  const ctx = useContext(GoalDataContext)
  if (!ctx) {
    throw new Error("useGoalDataContext must be used within a GoalDataProvider")
  }
  return ctx
}
```

Note: `useGoalDataContext` is currently not called by any consumer (only `GoalDataProvider` is imported). Adding the throw is safe and makes it consistent with other context hooks.

- [ ] **Step 2: Verify the provider usage compiles**

The provider is used in `src/features/leads/components/analytics-dashboard.tsx`. The `goalProviderValue` object passed to it must conform to the new typed interface. Check that the value shape matches.

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "goal-data-context|analytics-dashboard"`

If there are type errors in `analytics-dashboard.tsx`, they indicate the provider value doesn't match the expected types — fix the value construction there.

- [ ] **Step 3: Commit**

```bash
git add src/features/goals/contexts/goal-data-context.tsx
git commit -m "fix: replace any types with proper GoalV2/GoalNodeTree/Lead types in GoalDataContext"
```

---

### Task 9: Delete backup file

**Files:**
- Delete: `src/features/settings/components/form-layout-builder.backup.tsx`

- [ ] **Step 1: Delete the backup file**

```bash
git rm src/features/settings/components/form-layout-builder.backup.tsx
```

- [ ] **Step 2: Verify no imports reference it**

Run: `rg "form-layout-builder.backup" --include "*.{ts,tsx}"`
Expected: No results.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove dead backup file form-layout-builder.backup.tsx"
```

---

### Task 10: Create CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    name: Type Check, Lint & Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npx vitest run
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for type check, lint, and tests"
```

---

### Task 11: Clean up legacy tasks module references

**Files:**
- Modify: `src/components/app-nav.tsx` (remove Tasks link)
- Modify: `src/components/layout/sidebar.tsx` (already commented out — no change needed)

Note: `WorkflowActions` from `src/features/tasks/components/workflow-actions.tsx` is still actively imported by `lead-sheet.tsx` and `lead-detail-layout.tsx`. The tasks **page** and **board** are legacy, but `WorkflowActions` is still in use. We will:
1. Remove the Tasks nav link from `app-nav.tsx`
2. Delete the tasks page route (`src/app/dashboard/tasks/page.tsx`)
3. Delete `task-board.tsx` and `task-card.tsx` (unused)
4. Keep `workflow-actions.tsx` (still imported by lead components)

- [ ] **Step 1: Read app-nav.tsx to find the Tasks link**

Read `src/components/app-nav.tsx` to identify the exact line to remove.

- [ ] **Step 2: Remove Tasks link from app-nav.tsx**

Remove the line:
```ts
{ href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
```

Also remove the `ClipboardList` import from lucide-react if it's no longer used.

- [ ] **Step 3: Delete legacy task files**

```bash
git rm src/app/dashboard/tasks/page.tsx
git rm src/features/tasks/components/task-board.tsx
git rm src/features/tasks/components/task-card.tsx
```

- [ ] **Step 4: Verify no broken imports**

Run: `rg "task-board|task-card|dashboard/tasks" --include "*.{ts,tsx}"`
Expected: Only the commented-out line in `sidebar.tsx` (if any).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy tasks page and unused task components"
```

---

### Task 12: Run full verification

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No new errors introduced by our changes. Pre-existing errors are acceptable (the project has `ignoreBuildErrors: true`).

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Final commit if any fixes were needed**

If verification revealed issues, fix them and commit with an appropriate message.
