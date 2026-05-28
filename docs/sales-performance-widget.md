# Sales Performance Widget — Behavior, Data Sources, and Gotchas

> Living reference for the Sales Performance widget on the main dashboard.
> Updated 2026-05-25.

The widget lives at `src/features/leads/components/dashboard-widgets/sales-perf-widget.tsx`
and consumes data shaped by the `salesData` memo in
`src/features/leads/components/analytics-dashboard.tsx`.

It is the most accountability-sensitive widget on the dashboard, and it
cuts across three different ways targets can be stored in LeadEngine. If
you are touching it, read this whole document first.

---

## 1. What the widget shows

For every sales rep in the active company scope:

- **Tracked reps** (have a target for the active period): name, achievement
  percent, actual revenue, prorated target. Sorted by % ascending so
  under-performers and idle reps land at the top.
- **Untracked reps** (have leads but no configured target): name + actual
  revenue, in a separate "No Target Set" group.
- **Hidden:** reps with neither target nor actual in this period (zero
  signal — drops to keep the widget actionable).

The "Team Avg" badge is `Σ actual / Σ prorated target` over tracked reps
only. Insight callout priority: idle reps → low performers → reps without
targets → all-on-track celebration.

---

## 2. The three places a sales target can live

LeadEngine has accreted three target-storage mechanisms. The widget has to
handle all of them — failing to do so was the cause of three separate bugs.

| # | Storage                                          | Granularity              | Who writes it                                                                            |
|---|--------------------------------------------------|--------------------------|------------------------------------------------------------------------------------------|
| 1 | `goal_user_targets` row                          | Per user, explicit dates | Goal Settings → Targets per User editor                                                  |
| 2 | `goal_nodes` with `reference_field=pic_sales_id` | Per user, optional monthly buckets | Goal hierarchy editor (manual add) and `autoInsertGoalHierarchyAction` (bulk add) |
| 3 | `goals_v2.breakdown_config` JSON, `dimension=sales_owner` | Names + pct/value, optionally nested under a parent dimension (e.g. industry × sales_owner) | Goal matrix board (`breakdown_config` editor)                                            |

> **Implication:** a rep can have a target via *any* of these — or several
> simultaneously. The widget seeds reps from all three before applying
> filters, otherwise reps disappear silently.

### Source priority and aggregation

`salesData` in `analytics-dashboard.tsx` applies them in this order. Once a
rep has `hasRealTarget = true`, later sources are skipped for that rep:

1. `goal_user_targets` — prorated against each row's own
   `period_start`/`period_end`.
2. `goal_nodes` (`pic_sales_id` / `sales_owner`) — prefer `monthly_targets`
   bucket sums (prorated by day overlap), else flat `target_amount`
   prorated against the goal's period.
3. `breakdown_config sales_owner` — sum every node's contribution across
   `nodes` (shared) AND every entry in `perParentNodes` (per-parent), then
   prorate.

For (3), names are resolved to user ids via the `salesProfiles` prop. If
no profile matches, the rep is keyed by `name:${name}` so they still
appear in the widget. Display name falls back from profile `full_name` →
node name → "Unknown".

---

## 3. Why a rep can be missing — the failure modes we have hit

### 3.1 Rep has a target but zero leads in this period

**Symptom:** rep with target in goal settings disappears when the dashboard
filter excludes their actuals.

**Cause:** the old `salesData` only knew about reps that appeared in
`periodLeads`. A rep with target but no won deals never got seeded.

**Fix (current):** `ensureRep()` is called for every user id in
`userTargets`, every `pic_sales_id` node, and every name in
`breakdown_config sales_owner`. We also fetch their `full_name` from
`profiles` server-side via the `salesProfiles` prop so the row can render.

### 3.2 Period filter vs annual targets

**Symptom:** "Team Avg" is always ~25% in Q-views or ~8% in monthly views,
regardless of actual performance.

**Cause:** actual was period-filtered, target was annual. Wrong unit
comparison.

**Fix (current):** every target is prorated to `dashboardRange` via
`prorateTarget` / `prorateMonthlyTargets` helpers in
`src/features/leads/lib/dashboard-period.ts`. `all_time` short-circuits
proration. Tests live at
`src/features/leads/lib/__tests__/dashboard-period-proration.test.ts`.

### 3.3 `reference_field` mismatch on `goal_nodes`

**Symptom:** reps configured via the bulk-add path (Goal Settings → "Auto
fill all sales reps") never appear, even though their rows clearly exist
in `goal_nodes`.

**Cause:** `autoInsertGoalHierarchyAction` in
`src/app/actions/goal-actions.ts` was storing
`reference_field = dimensionType` (so `"sales_owner"`), but every other
part of the system filters on `reference_field = "pic_sales_id"`. Same
issue affects `subsidiary` (should be `company_id`) and `client_company`
(should be `client_company_id`).

**Fix (current):**

- The action now maps entity dimensions through `ENTITY_FIELD_MAP` before
  inserting. New rows are correct.
- Migration `20260525024200_fix_goal_nodes_reference_field.sql` repairs
  existing rows in place. It is idempotent and safe to re-run.
- Dashboard + `src/app/page.tsx` are tolerant of the legacy form
  (`reference_field === "sales_owner" || dimension_type === "sales_owner"`)
  in case any orphan slipped through.

### 3.4 Targets stored only in `breakdown_config`

**Symptom:** Werkudara Group's holding-view dashboard had 0 `goal_nodes`
and 0 `goal_user_targets`, but Goal Settings clearly defined 7 reps. Only
6 showed up — Mya Mar'atus Sholikhah was hidden because she had no leads
in April.

**Cause:** the old breakdown_config branch only touched reps that were
already in the `reps` map (i.e. had at least one lead). It used name
matching against rep records that might not exist.

**Fix (current):** breakdown_config aggregation now produces a
`name → totalTarget` map first, then seeds reps explicitly via
`ensureRep` with name-resolved profile ids. Per-parent buckets are summed
correctly (e.g. Irvani's 100% slice in "Mining, Metals, Downstream &
Energy" = 20.8B even when she has 0% in other industries).

---

## 4. Data fetched by `src/app/page.tsx`

The dashboard page is a Server Component. It fetches in parallel:

- `goals_v2` (latest active for active company)
- `goal_nodes` (filtered to that goal)
- `goal_user_targets` (filtered to that goal)
- `goal_settings_v2`
- `custom_widgets`
- `profiles` for two id sets:
  1. user ids referenced by `userTargets` and sales-owner `goalNodes`
  2. names referenced by `breakdown_config sales_owner`
     (resolved via `.in("full_name", names)`)

Both profile queries are merged into the `salesProfiles` prop. The
component never queries Supabase for sales rep data on the client.

---

## 5. Holding vs subsidiary scoping

Holding companies (`is_holding = true`) see all data through RLS.
However, the active *goal* selected by `src/app/page.tsx` is filtered by
`activeCompany.id`. A duplicate-name goal owned by a subsidiary will be
ignored if the active company is the holding. If you see what looks like
the wrong goal driving the dashboard, check `goals_v2` for multiple
active rows with the same name across different `company_id`s.

---

## 6. Common pitfalls when extending this widget

- **Don't introduce a fourth target storage.** If you find yourself
  inventing a new place to store sales targets, you are about to recreate
  bug 3.1 a year from now. Use one of the three existing mechanisms.
- **Don't switch any sort order without checking the insight callout.**
  Idle reps must be visible at the top because the insight text references
  whichever rep the reader sees first.
- **Don't bypass `prorateTarget`.** Any new target source must go through
  the same proration helpers in `dashboard-period.ts`. If proration cannot
  be applied (e.g. for `all_time`), use `isAllTimeRange()` to short-circuit
  rather than skipping it silently.
- **Name matching is fragile.** `breakdown_config sales_owner` only stores
  display names. If goal settings is edited so that a rep's name no longer
  matches `profiles.full_name` exactly, they will revert to a `name:` key
  and lose their profile. Make name edits in profiles, not in goal
  settings.

---

## 7. Files that matter

```
src/app/page.tsx
src/features/leads/components/analytics-dashboard.tsx
src/features/leads/components/dashboard-widgets/sales-perf-widget.tsx
src/features/leads/lib/dashboard-period.ts
src/features/leads/lib/__tests__/dashboard-period-proration.test.ts
src/app/actions/goal-actions.ts             # autoInsertGoalHierarchyAction
src/types/goals.ts
supabase/migrations/20260525024200_fix_goal_nodes_reference_field.sql
```

---

## 8. Smoke test checklist after any change here

1. `npm run typecheck` clean.
2. `npx vitest run src/features/leads/lib/__tests__/dashboard-period-proration.test.ts` — 16 tests pass.
3. `npm test` — full suite passes.
4. Visual: dashboard with `Custom Range = 01/04/2026 → 30/04/2026` shows
   all 7 currently-configured reps for Werkudara Group, including reps
   with zero April leads (they should appear at the top with 0% bars).
5. Switch period to `All Time` — every rep should still appear with their
   raw (un-prorated) target.
