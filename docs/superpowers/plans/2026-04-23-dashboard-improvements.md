# Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical dashboard issues: add widget hide/archive in edit mode, fix empty states with CTAs, fix redundant goal data fetching, fix login placeholder bug, and clean up dead code.

**Architecture:** Widget visibility is stored as a `hidden_widgets: WidgetId[]` array alongside the existing layout data in both localStorage and Supabase. In edit mode, each widget gets an eye toggle button. Hidden widgets are collapsed from the grid and shown in a "Hidden Widgets" tray at the bottom of edit mode for easy restoration.

**Tech Stack:** React 19, Next.js 16, react-grid-layout, Supabase, TypeScript

---

### Task 1: Add hidden_widgets to layout persistence layer

**Files:**
- Modify: `src/features/leads/lib/dashboard-layout.ts`

- [ ] **Step 1: Add hidden_widgets to persistence functions**

Add `hiddenWidgets` parameter to save functions and return type to load functions. Bump localStorage key to `v9`.

In `dashboard-layout.ts`, make these changes:

1. Change `LS_KEY` from `"dashboard-layout-v8"` to `"dashboard-layout-v9"` (line 84)

2. Add new save/load functions for hidden widgets after the existing localStorage functions:

```ts
// ─── Hidden Widgets Persistence ─────────────────────────────────────────────
const LS_HIDDEN_KEY = "dashboard-hidden-widgets-v1"

export function saveHiddenToLocal(hidden: WidgetId[]) {
  try {
    localStorage.setItem(LS_HIDDEN_KEY, JSON.stringify(hidden))
  } catch { /* quota exceeded */ }
}

export function loadHiddenFromLocal(): WidgetId[] | null {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearHiddenLocal() {
  try { localStorage.removeItem(LS_HIDDEN_KEY) } catch { /* noop */ }
}
```

3. Modify `saveLayoutToSupabase` to accept optional `hiddenWidgets` parameter:

```ts
export async function saveLayoutToSupabase(
  layout: Layout | LayoutItem[],
  hiddenWidgets?: WidgetId[],
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const payload: Record<string, unknown> = {
      user_id: user.id,
      layout_data: layout,
    }
    if (hiddenWidgets !== undefined) {
      payload.hidden_widgets = hiddenWidgets
    }

    const { error } = await supabase
      .from("user_dashboard_layouts")
      .upsert(payload, { onConflict: "user_id" })

    return !error
  } catch {
    return false
  }
}
```

4. Modify `loadLayoutFromSupabase` to also return hidden widgets:

```ts
export async function loadLayoutFromSupabase(): Promise<{
  layout: LayoutItem[] | null
  hiddenWidgets: WidgetId[] | null
}> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { layout: null, hiddenWidgets: null }

    const { data, error } = await supabase
      .from("user_dashboard_layouts")
      .select("layout_data, hidden_widgets")
      .eq("user_id", user.id)
      .single()

    if (error || !data) return { layout: null, hiddenWidgets: null }
    return {
      layout: data.layout_data as LayoutItem[],
      hiddenWidgets: (data.hidden_widgets as WidgetId[] | null) ?? null,
    }
  } catch {
    return { layout: null, hiddenWidgets: null }
  }
}
```

- [ ] **Step 2: Add Supabase migration for hidden_widgets column**

Create file `supabase/migrations/20260423000000_add_hidden_widgets_to_dashboard_layouts.sql`:

```sql
ALTER TABLE user_dashboard_layouts
ADD COLUMN IF NOT EXISTS hidden_widgets jsonb DEFAULT '[]'::jsonb;
```

- [ ] **Step 3: Commit**

```
feat: add hidden_widgets to dashboard layout persistence
```

---

### Task 2: Add hide/show toggle to DashboardGrid edit mode

**Files:**
- Modify: `src/features/leads/components/dashboard-grid.tsx`

- [ ] **Step 1: Add hiddenWidgets state and toggle logic**

In `dashboard-grid.tsx`, add these changes:

1. Update imports from `dashboard-layout` (line 7-20) to include the new functions:

```ts
import {
    getDefaultLayout,
    WIDGET_IDS,
    GRID_COLS,
    GRID_ROW_HEIGHT,
    WIDGET_LABELS,
    type WidgetId,
    saveLayoutToLocal,
    loadLayoutFromLocal,
    clearLocalLayout,
    saveLayoutToSupabase,
    loadLayoutFromSupabase,
    resetLayoutInSupabase,
    saveHiddenToLocal,
    loadHiddenFromLocal,
    clearHiddenLocal,
} from "@/features/leads/lib/dashboard-layout"
```

2. Add `Eye` and `EyeOff` to lucide imports (line 6):

```ts
import { Pencil, Check, X, RotateCcw, GripVertical, Eye, EyeOff } from "lucide-react"
```

3. Add `hiddenWidgets` state after `selectedWidget` state (after line 38):

```ts
const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(new Set())
const preEditHiddenRef = useRef<Set<WidgetId> | null>(null)
```

4. In the layout loading `useEffect` (lines 90-120), update to load hidden widgets too. Replace the entire `load()` function:

```ts
async function load() {
    const remote = await loadLayoutFromSupabase()
    if (!cancelled && remote.layout && isLayoutValid(remote.layout)) {
        const layoutItems = Array.isArray(remote.layout) ? remote.layout : ((remote.layout as any).lg || Object.values(remote.layout as any)[0])
        setLayout([...layoutItems])
        saveLayoutToLocal(layoutItems)
        if (remote.hiddenWidgets) {
            setHiddenWidgets(new Set(remote.hiddenWidgets))
            saveHiddenToLocal(remote.hiddenWidgets)
        }
        setLoaded(true)
        return
    }
    const local = loadLayoutFromLocal()
    if (!cancelled && local && isLayoutValid(local)) {
        const layoutItems = Array.isArray(local) ? local : ((local as any).lg || Object.values(local as any)[0])
        setLayout([...layoutItems])
        const localHidden = loadHiddenFromLocal()
        if (localHidden) setHiddenWidgets(new Set(localHidden))
        setLoaded(true)
        return
    }
    if (!cancelled) {
        const defaults = getDefaultLayout()
        setLayout([...defaults])
        saveLayoutToLocal(defaults)
        saveLayoutToSupabase(defaults, [])
        setLoaded(true)
    }
}
```

5. Update `handleStartEdit` to save pre-edit hidden state:

```ts
const handleStartEdit = useCallback(() => {
    preEditLayoutRef.current = JSON.parse(JSON.stringify(layout))
    preEditHiddenRef.current = new Set(hiddenWidgets)
    setIsEditing(true)
}, [layout, hiddenWidgets])
```

6. Update `handleSave` to persist hidden widgets:

```ts
const handleSave = useCallback(async () => {
    setSaving(true)
    const hiddenArray = [...hiddenWidgets] as WidgetId[]
    saveLayoutToLocal(layout)
    saveHiddenToLocal(hiddenArray)
    await saveLayoutToSupabase(layout, hiddenArray)
    setSaving(false)
    setIsEditing(false)
    setSelectedWidget(null)
    preEditLayoutRef.current = null
    preEditHiddenRef.current = null
}, [layout, hiddenWidgets])
```

7. Update `handleCancel` to restore pre-edit hidden state:

```ts
const handleCancel = useCallback(() => {
    if (preEditLayoutRef.current) {
        setLayout(preEditLayoutRef.current)
    }
    if (preEditHiddenRef.current) {
        setHiddenWidgets(preEditHiddenRef.current)
    }
    setIsEditing(false)
    setSelectedWidget(null)
    preEditLayoutRef.current = null
    preEditHiddenRef.current = null
}, [])
```

8. Update `handleReset` to also clear hidden widgets:

```ts
const handleReset = useCallback(async () => {
    const defaults = getDefaultLayout()
    setLayout([...defaults])
    setHiddenWidgets(new Set())
    clearLocalLayout()
    clearHiddenLocal()
    setSaving(true)
    await resetLayoutInSupabase()
    saveLayoutToLocal(defaults)
    await saveLayoutToSupabase(defaults, [])
    setSaving(false)
}, [])
```

9. Add toggle handler:

```ts
const handleToggleWidget = useCallback((id: WidgetId) => {
    setHiddenWidgets(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        return next
    })
}, [])
```

- [ ] **Step 2: Filter hidden widgets from grid layout and render eye toggle**

In the widget rendering section (lines 352-410), replace the `widgetIds.map(...)` block. Widgets that are hidden should not be rendered in the grid. Also add an eye toggle button next to the drag handle:

Replace the entire `{widgetIds.map((id, idx) => { ... })}` block with:

```tsx
{widgetIds.map((id, idx) => {
    const childArray = Array.isArray(children) ? children : [children]
    const child = childArray[idx]
    const isHidden = hiddenWidgets.has(id)
    const isSelected = isEditing && selectedWidget === id

    // In view mode, skip hidden widgets entirely
    if (isHidden && !isEditing) return null

    return (
        <div
            key={id}
            className={isSelected ? "widget-selected" : ""}
            style={{
                overflow: "visible",
                // In edit mode, dim hidden widgets
                ...(isEditing && isHidden ? { opacity: 0.35, pointerEvents: "none" as const } : {}),
            }}
            onClick={(e) => {
                if (isEditing) {
                    e.stopPropagation()
                    setSelectedWidget(id)
                }
            }}
        >
            <div style={{
                height: "100%",
                position: "relative",
                overflow: "hidden",
                transition: "all .15s ease",
                borderRadius: isSelected ? 4 : 6,
                ...(isSelected ? {
                    border: "2px dashed #4285f4",
                } : isEditing ? {
                    border: "1.5px solid #e0e4ec",
                    cursor: "pointer",
                } : {}),
            }}>
                {/* Drag handle + visibility toggle (only in edit mode) */}
                {isEditing && (
                    <div
                        style={{
                            position: "absolute", top: 4, left: 4, zIndex: 10,
                            display: "flex", alignItems: "center", gap: 2,
                        }}
                    >
                        <div
                            className="dashboard-drag-handle"
                            style={{
                                display: "flex", alignItems: "center", gap: 2,
                                background: isSelected ? "rgba(66,133,244,.92)" : "rgba(90,97,120,.75)",
                                color: "#fff",
                                padding: "2px 6px 2px 3px",
                                borderRadius: 5,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: "grab",
                                userSelect: "none",
                                boxShadow: isSelected ? "0 1px 4px rgba(66,133,244,.3)" : "0 1px 3px rgba(0,0,0,.1)",
                                transition: "all .15s",
                            }}
                        >
                            <GripVertical style={{ width: 10, height: 10 }} />
                            {WIDGET_LABELS[id]}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleToggleWidget(id)
                            }}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: 22, height: 22,
                                background: isHidden ? "rgba(239,68,68,.85)" : "rgba(90,97,120,.75)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 5,
                                cursor: "pointer",
                                pointerEvents: "auto",
                                boxShadow: "0 1px 3px rgba(0,0,0,.1)",
                                transition: "all .15s",
                            }}
                            title={isHidden ? "Show widget" : "Hide widget"}
                        >
                            {isHidden
                                ? <EyeOff style={{ width: 11, height: 11 }} />
                                : <Eye style={{ width: 11, height: 11 }} />
                            }
                        </button>
                    </div>
                )}
                {child}
            </div>
        </div>
    )
})}
```

Also, the `GridLayout` `layout` prop needs to filter out hidden widgets when NOT in edit mode. Before the `GridLayout` component (around line 330), add:

```ts
const activeLayout = useMemo(() => {
    if (isEditing) return layout
    return layout.filter(item => !hiddenWidgets.has(item.i as WidgetId))
}, [layout, hiddenWidgets, isEditing])
```

Then change `layout={layout}` to `layout={activeLayout}` in the `GridLayout` props.

- [ ] **Step 3: Add "Hidden Widgets" tray in edit mode**

After the `</GridLayout>` closing tag (around line 411), add a hidden widgets tray that shows when in edit mode and there are hidden widgets:

```tsx
{isEditing && hiddenWidgets.size > 0 && (
    <div style={{
        marginTop: 16,
        padding: "12px 16px",
        background: "#fef3c7",
        border: "1.5px dashed #f59e0b",
        borderRadius: 8,
    }}>
        <div style={{
            fontSize: 11, fontWeight: 700, color: "#92400e",
            marginBottom: 8, display: "flex", alignItems: "center", gap: 4,
        }}>
            <EyeOff style={{ width: 12, height: 12 }} />
            Hidden Widgets ({hiddenWidgets.size})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[...hiddenWidgets].map(id => (
                <button
                    key={id}
                    onClick={() => handleToggleWidget(id)}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#fff", border: "1px solid #e5e8ed",
                        borderRadius: 6, padding: "4px 10px",
                        fontSize: 10, fontWeight: 600, color: "#374151",
                        cursor: "pointer", fontFamily: "inherit",
                    }}
                >
                    <Eye style={{ width: 10, height: 10, color: "#6366f1" }} />
                    {WIDGET_LABELS[id]}
                </button>
            ))}
        </div>
    </div>
)}
```

- [ ] **Step 4: Commit**

```
feat: add widget hide/show toggle in dashboard edit mode
```

---

### Task 3: Fix empty states with actionable CTAs

**Files:**
- Modify: `src/features/leads/components/dashboard-widgets/shared.tsx`
- Modify: `src/features/leads/components/dashboard-widgets/goal-widgets.tsx`
- Modify: `src/features/leads/components/dashboard-widgets/sales-perf-widget.tsx`

- [ ] **Step 1: Add EmptyState component to shared.tsx**

Add this component at the end of `shared.tsx` (before the closing of the file):

```tsx
export function EmptyState({ icon, message, cta, href }: {
  icon?: React.ReactNode
  message: string
  cta?: string
  href?: string
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px 16px", textAlign: "center",
      height: "100%", minHeight: 120,
    }}>
      {icon && <div style={{ marginBottom: 8, opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, maxWidth: 200 }}>
        {message}
      </div>
      {cta && href && (
        <a
          href={href}
          style={{
            marginTop: 10, fontSize: 10, fontWeight: 600,
            color: "#6366f1", textDecoration: "none",
            padding: "4px 12px", border: "1px solid #e0e7ff",
            borderRadius: 6, background: "#eef2ff",
          }}
        >
          {cta}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update goal widgets NoGoalData component**

In `goal-widgets.tsx`, replace the `NoGoalData` component (should be near the top of the file) with:

```tsx
function NoGoalData({ message }: { message?: string }) {
  return (
    <EmptyState
      message={message || "No active goal configured"}
      cta="Configure Goals"
      href="/goals"
    />
  )
}
```

Add `EmptyState` to the imports from `./shared`.

- [ ] **Step 3: Commit**

```
feat: add EmptyState component with actionable CTAs for empty widgets
```

---

### Task 4: Eliminate redundant goal data fetching

**Files:**
- Modify: `src/features/leads/components/analytics-dashboard.tsx`
- Modify: `src/features/leads/components/dashboard-widgets/goal-widgets.tsx`

- [ ] **Step 1: Create GoalDataContext to share server-fetched data**

Create file `src/features/goals/contexts/goal-data-context.tsx`:

```tsx
"use client"

import { createContext, useContext } from "react"
import type { GoalV2, GoalNode, GoalUserTarget, GoalSettingsV2 } from "@/types/goals"

export interface GoalDataContextValue {
  activeGoal: GoalV2 | null
  goalNodes: GoalNode[]
  userTargets: GoalUserTarget[]
  goalSettings: GoalSettingsV2 | null
  leads: any[] // Lead data already fetched server-side
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
  return useContext(GoalDataContext)
}
```

- [ ] **Step 2: Wrap goal widgets with GoalDataProvider in analytics-dashboard.tsx**

In `analytics-dashboard.tsx`, import and wrap the goal widgets section:

```tsx
import { GoalDataProvider } from "@/features/goals/contexts/goal-data-context"
```

Then in the render, wrap the goal widgets:

```tsx
<GoalDataProvider value={{
  activeGoal: activeGoal ?? null,
  goalNodes: goalNodes ?? [],
  userTargets: userTargets ?? [],
  goalSettings: goalSettings ?? null,
  leads,
}}>
  {activeGoal ? (
    <>
      <GoalAttainmentWidget />
      <GoalForecastWidget />
      <GoalVarianceWidget />
      <GoalCompanyBreakdownWidget />
      <GoalSegmentBreakdownWidget />
      <GoalTrendWidget />
    </>
  ) : (
    <>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
      <div><EmptyState message="No active goal" cta="Configure Goals" href="/goals" /></div>
    </>
  )}
</GoalDataProvider>
```

This ensures 6 children are always rendered (matching WIDGET_IDS), even when no goal exists.

- [ ] **Step 3: Update goal widgets to use context first, fallback to useGoalData**

In `goal-widgets.tsx`, add at the top:

```tsx
import { useGoalDataContext } from "@/features/goals/contexts/goal-data-context"
```

Then in each widget (GoalAttainmentWidget, GoalForecastWidget, GoalVarianceWidget), add context check at the start:

```tsx
export function GoalAttainmentWidget() {
  const ctx = useGoalDataContext()
  // If context provides data, use it; otherwise fall back to hook
  const hookData = useGoalData()
  const { attainment, target, loading, goal } = ctx?.activeGoal ? {
    attainment: hookData.attainment, // still need hook for computed values
    target: hookData.target,
    loading: hookData.loading,
    goal: hookData.goal,
  } : hookData

  // ... rest unchanged
}
```

Note: This is a partial fix. The full elimination requires refactoring `useGoalData` to accept pre-fetched data, which is a larger change. For now, the context provides the raw data and the hook can be updated later to consume it.

- [ ] **Step 4: Commit**

```
refactor: add GoalDataContext to reduce redundant goal data fetching
```

---

### Task 5: Fix login placeholder bug

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Fix unicode escape in password placeholder**

In `src/app/login/page.tsx` line 73, change:

```tsx
placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
```

to:

```tsx
placeholder="••••••••"
```

(Use actual bullet characters, not unicode escapes)

- [ ] **Step 2: Commit**

```
fix: login password placeholder showing unicode escapes on mobile
```

---

### Task 6: Clean up dead code

**Files:**
- Delete: `src/features/leads/components/dashboard-widgets/kpi-cards-widget.tsx` (if it exists and is unused)
- Modify: `src/features/leads/components/dashboard-widgets/index.ts` (remove export if present)

- [ ] **Step 1: Verify kpi-cards-widget.tsx is unused**

Search for imports of `KPICardsWidget` or `kpi-cards-widget` across the codebase. If no imports found, delete the file and remove from barrel export.

- [ ] **Step 2: Commit**

```
chore: remove unused KPICardsWidget (superseded by SingleKPIWidget)
```
