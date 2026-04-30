# Recharts Migration Design

**Date:** 2026-04-23
**Status:** Approved
**Trigger:** Lead Classification widget content truncation when switching to "Biz Purpose" category

## Problem

Dashboard widgets use inline CSS `<div>` elements for charts. Long category labels (e.g., business_purpose values) get truncated by `overflow: hidden` on `SectionCard`. No tooltips, no responsive sizing, no interactivity.

## Solution

Migrate all chart-rendering widgets from inline CSS to Recharts (v3.8.1, already installed).

## Migration Map

| # | Widget | File | Current | Recharts Target |
|---|--------|------|---------|-----------------|
| 1 | ClassificationWidget | classification-widget.tsx | Segmented bar + mini cards | PieChart (donut) |
| 2 | PipelineWidget | pipeline-widget.tsx | Horizontal progress bars | BarChart horizontal |
| 3 | LeadSourceWidget | lead-source-widget.tsx | Stacked bar + progress bars | BarChart horizontal |
| 4 | StreamWidget | stream-widget.tsx | Horizontal progress bars | BarChart horizontal |
| 5 | TopRevenueWidget | top-revenue-widget.tsx | Ranked horizontal bars | BarChart horizontal |
| 6 | SalesPerfWidget | sales-perf-widget.tsx | Overlapping actual/target bars | BarChart horizontal (grouped) |
| 7 | GoalCompanyBreakdownWidget | goal-widgets.tsx | Horizontal bars | BarChart horizontal |
| 8 | GoalSegmentBreakdownWidget | goal-widgets.tsx | Dot legend list | PieChart (donut) |
| 9 | GoalTrendWidget | goal-widgets.tsx | Vertical paired bars | BarChart vertical (grouped) |
| 10 | GoalAttainmentWidget | goal-widgets.tsx | Single progress bar | RadialBarChart |
| 11 | GoalForecastWidget | goal-widgets.tsx | KPI numbers | BarChart vertical (2 bars) |
| 12 | GoalVarianceWidget | goal-widgets.tsx | KPI + arrows | BarChart vertical (2 bars) |
| 13 | CustomWidgetRenderer (Bar) | custom-widget-renderer.tsx | Inline horizontal bars | BarChart horizontal |
| 14 | CustomWidgetRenderer (Pie) | custom-widget-renderer.tsx | CSS conic-gradient | PieChart (donut) |
| 15 | CustomWidgetRenderer (List) | custom-widget-renderer.tsx | Ranked text list | BarChart horizontal |

### Skipped (no chart, KPI cards only)
- SingleKPIWidget -- single number + badges, no chart geometry
- CustomWidgetRenderer (KPI) -- single number, no chart geometry

## Shared Components

### 1. DarkTooltip (already exists in shared.tsx)
Reuse and make generic for all chart types.

### 2. ResponsiveContainer pattern
Every chart wrapped in `<ResponsiveContainer width="100%" height="100%">` inside a flex container.

### 3. hasMounted guard
Client-side only rendering to avoid SSR hydration mismatch (pattern from RevenueChartWidget).

## Design Principles

1. **Same props interface** -- no changes to parent components' data flow
2. **Same visual identity** -- keep existing color schemes, just render with Recharts
3. **SectionCard stays** -- only replace the chart portion inside
4. **InsightCallout stays** -- keep all insight text
5. **Dropdown selectors stay** -- category toggle, stream toggle unchanged
6. **Empty states stay** -- same empty state handling

## Style Conventions

- Font sizes: match existing (9-12px range)
- Colors: use existing CHART_COLORS palette and widget-specific color maps
- Tooltip: dark theme (DarkTooltip pattern)
- No axis lines, minimal grid, clean look
- Animations: Recharts built-in transitions

## Implementation Order

1. Shared helpers first (generic tooltip, hasMounted hook)
2. ClassificationWidget (the triggering bug)
3. Horizontal bar widgets (Pipeline, LeadSource, Stream, TopRevenue, SalesPerf)
4. Goal widgets (6 widgets in one file)
5. CustomWidgetRenderer (3 sub-renderers)
6. Build verification
