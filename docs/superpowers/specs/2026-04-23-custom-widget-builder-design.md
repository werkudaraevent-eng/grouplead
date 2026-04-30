# Custom Widget Builder (Level 1) — Design Spec

> Approved 2026-04-23. Scope: personal custom widgets per user, no sharing.

## Goal

Allow any user to create personal dashboard widgets by choosing a metric, aggregation, group-by dimension, and visualization type. Widgets are stored in Supabase, rendered dynamically alongside the 19 built-in widgets, and participate in the existing grid layout + hide/show system.

## Data Model

### Table: `custom_widgets`

```sql
CREATE TABLE custom_widgets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES companies(id),
  title         text NOT NULL,
  widget_type   text NOT NULL CHECK (widget_type IN ('kpi','bar','pie','list')),
  metric_field  text NOT NULL,  -- '_count' | 'actual_value' | 'estimated_value' | 'pax_count'
  aggregation   text NOT NULL CHECK (aggregation IN ('count','sum','avg')),
  group_by      text,           -- null for KPI single-number; else dimension key
  config        jsonb NOT NULL DEFAULT '{}',  -- { limit, color, sort }
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE custom_widgets ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own widgets
CREATE POLICY "custom_widgets_owner" ON custom_widgets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Widget ID Convention

Custom widgets use ID format `custom-{uuid}`. The grid layout system stores these alongside built-in IDs like `kpi-total-leads` in `layout_data` and `hidden_widgets`.

### Metric Fields

| `metric_field` | Label | Aggregation applies to |
|---|---|---|
| `_count` | Count of Leads | Always count, ignores `aggregation` |
| `actual_value` | Won Revenue (Actual) | sum / avg |
| `estimated_value` | Estimated Value | sum / avg |
| `pax_count` | Pax Count | sum / avg |

### Group-By Dimensions

Sourced from `getDimensionRegistry()` at runtime. Includes:
- Entity: `company_id` (Subsidiary), `pic_sales_id` (Sales Owner), `client_company_id` (Client Company)
- Lead attributes: `category`, `lead_source`, `grade_lead`, `main_stream`, `business_purpose`, `sector`, `line_industry`, `area`, `nationality`, `event_format`, etc.
- Custom master_options types discovered at runtime

When `group_by` is null, the widget renders as a single KPI number.

## UI Flow

### Entry Point

Inside the Widget Gallery Modal (already built), a "+ Create Custom Widget" button appears below the list of removed built-in widgets.

### Configurator Modal

Single-screen modal with form on the left, live preview on the right.

**Form fields:**
1. **Title** — text input, auto-generates default like "Revenue by Source"
2. **Chart Type** — 4 icon buttons: KPI Card, Bar Chart, Pie/Donut, Ranked List
3. **Metric** — dropdown: Count Leads, Sum Revenue, Sum Est. Value, Avg Deal Size, Sum Pax
4. **Group By** — dropdown populated from dimension registry. Disabled when chart type is KPI and metric is count.
5. **Limit** — number input (default 10), only shown for bar/pie/list types

**Actions:** "Add to Dashboard" (saves to Supabase + adds to grid), "Cancel"

### Edit / Delete

- In edit mode, custom widgets show a pencil icon (edit config) and trash icon (delete permanently) alongside the X (remove from dashboard) and drag handle.
- Edit opens the same configurator modal pre-filled with current config.
- Delete removes from `custom_widgets` table and from grid layout.

## Aggregation Engine

```ts
// src/features/leads/lib/aggregate-leads.ts

interface AggregateConfig {
  metricField: '_count' | 'actual_value' | 'estimated_value' | 'pax_count'
  aggregation: 'count' | 'sum' | 'avg'
  groupBy: string | null
  limit?: number  // default 10
}

interface AggregateResult {
  total: number
  groups: { key: string; label: string; value: number }[]
}

function aggregateLeads(leads: Lead[], config: AggregateConfig): AggregateResult
```

- When `groupBy` is null: returns `{ total, groups: [] }`
- When `groupBy` is set: groups leads by that field, computes metric per group, sorts descending, applies limit
- Label resolution: for FK fields (`pic_sales_id`, `client_company_id`, `company_id`), uses joined relation names. For string fields, uses the value directly.

## Renderer

```ts
// src/features/leads/components/dashboard-widgets/custom-widget-renderer.tsx

interface CustomWidgetRendererProps {
  widget: CustomWidget       // from DB
  data: AggregateResult      // pre-computed
}
```

Renders based on `widget.widget_type`:
- `kpi` — large number with title, uses `formatCur` for currency fields
- `bar` — horizontal bars with labels and values (reuse `SectionCard` pattern)
- `pie` — Recharts `PieChart` with `CHART_COLORS` from shared.tsx
- `list` — numbered ranked list with proportional bars

All renderers use `SectionCard` wrapper and design tokens from `shared.tsx`.

## Integration with Grid

### Dynamic Widget IDs

`WIDGET_IDS` remains the compile-time constant for built-in widgets. Custom widget IDs are merged at runtime:

```ts
const allWidgetIds = [...WIDGET_IDS, ...customWidgets.map(w => `custom-${w.id}` as string)]
```

### Data Flow

1. Server component (`page.tsx`) fetches `custom_widgets` for the current user
2. Passes to `AnalyticsDashboard` as new prop `customWidgets`
3. `AnalyticsDashboard` computes `aggregateLeads()` for each custom widget using the same `leads` array (already filtered by period)
4. Renders `<CustomWidgetRenderer>` for each, appended after built-in widgets inside `<DashboardGrid>`

### Layout Persistence

- New custom widgets get default position: `{ x: 0, y: maxY, w: 4, h: 5 }`
- Existing layout system handles persistence — custom widget IDs are just strings in `layout_data`
- `isLayoutValid` check is relaxed: only validates built-in IDs exist; custom IDs are additive

### Delete Flow

1. User clicks trash icon on custom widget in edit mode
2. Confirmation prompt
3. DELETE from `custom_widgets` table
4. Remove from `layout_data` and `hidden_widgets`
5. Save layout

## Files to Create/Modify

| Action | File | Purpose |
|---|---|---|
| Create | `supabase/migrations/20260423100000_create_custom_widgets.sql` | Table + RLS |
| Create | `src/features/leads/lib/aggregate-leads.ts` | Generic aggregation engine |
| Create | `src/features/leads/lib/__tests__/aggregate-leads.test.ts` | Unit tests |
| Create | `src/features/leads/components/dashboard-widgets/custom-widget-renderer.tsx` | Render custom widgets |
| Create | `src/features/leads/components/dashboard-widgets/widget-configurator-modal.tsx` | Create/edit form + preview |
| Modify | `src/app/page.tsx` | Fetch custom_widgets for user |
| Modify | `src/features/leads/components/analytics-dashboard.tsx` | Accept customWidgets prop, render them |
| Modify | `src/features/leads/components/dashboard-grid.tsx` | Support dynamic widget IDs, edit/delete buttons for custom widgets |
| Modify | `src/features/leads/lib/dashboard-layout.ts` | Relax isLayoutValid, handle custom IDs |
| Modify | `src/app/actions/` | Server action for CRUD custom_widgets (or client-side via Supabase) |

## Out of Scope (Level 2+)

- Filter conditions on custom widgets
- Date range picker per widget
- Multi-metric widgets
- Calculated fields / formulas
- Drill-down on click
- Sharing widgets between users
- Custom widget templates/presets
