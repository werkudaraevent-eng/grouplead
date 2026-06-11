# Performance Dashboard — Per-KPI Date Basis

> Living reference for how date filtering works on the main `/dashboard`
> page. Read this before changing any KPI calculation, filter logic, or
> date helper in `src/features/leads/lib/dashboard-period.ts`.
>
> Last updated 2026-05-25.

---

## Why this exists

The dashboard's period filter (`This Month` / `This Quarter` / `This
Year` / `Custom Range`) does not commit a single date column. Each KPI
on the dashboard answers a different question, and each question is
naturally bucketed by a different date.

A single global "based on" toggle (the pattern most BI tools use) has
been deliberately avoided here because:

- It puts an accounting decision in the user's hands that should not
  be a user decision (e.g. "Won Revenue by received date" is not a
  meaningful metric).
- It encourages users to mix bases inconsistently across reports and
  comparisons.
- It hides which basis a metric actually uses behind a setting that
  may have been changed by someone else.

Instead, every KPI ships with a **hardcoded basis chosen for accounting
correctness**, plus visible disclosures (Layer 1 micro-meta + Layer 2
tooltip) that make the basis self-documenting.

---

## The four bases

Defined in `src/features/leads/lib/dashboard-period.ts` as `DateBasis`:

| Basis           | Source field(s)                                                | Question it answers                              |
|-----------------|----------------------------------------------------------------|--------------------------------------------------|
| `received`      | `received_date` → `created_at`                                 | "Who came in this period?"                       |
| `close`         | `closed_won_date` → `closed_lost_date`                         | "What got resolved this period?"                 |
| `revenue`       | `month_event` → `event_date_end` → `event_date_start`          | "When was/will revenue be earned?"               |
| `target_close`  | `target_close_date` only — **no fallback**                     | "What is forecast to close in this period?"      |

`getDateForBasis(lead, basis)` is the canonical resolver.
`splitLeadsByBasis(leads, basis, period, ...)` is the canonical splitter
and returns `{ current, previous, excluded }`. Leads that cannot resolve
a date for the requested basis end up in `excluded` so the UI can
surface missing data.

---

## KPI → basis map

This is the contract enforced by `src/features/leads/components/analytics-dashboard.tsx`.

Each card shows a **hero number** plus optional **supporting metrics** (a
small muted line of total value + average under the hero). The supporting
line is rendered by `SingleKPIWidget`'s `supporting` prop.

| KPI (card)      | Basis           | Hero            | Supporting        | Notes                                                                 |
|-----------------|-----------------|-----------------|-------------------|-----------------------------------------------------------------------|
| Incoming Lead   | `received`      | count           | Σ est. value, avg | Pure intake metric. Σ uses `estimated_value`.                         |
| Lead Events     | `revenue`       | count           | Σ est. value, avg | Every lead recognised this period, any status. Σ uses `estimated_value`. |
| Lead Conversion | mixed           | %               | —                 | won count (revenue bucket) ÷ incoming count (received bucket). A won deal counts against the cohort of leads that came in. |
| Won             | `revenue`       | Σ actual value  | deal count, avg   | Σ uses `actual_value` for closed-won deals in the recognition month.  |
| Lost            | `revenue`       | count           | Σ est. value, avg | closed-lost deals (lost/turndown/postponed/cancelled all map to `closed_status = 'lost'`). YoY is inverted (up = bad). |

YoY arrows on each card use the **same basis** for current and previous
buckets so the comparison is honest (apples-to-apples). The previous
bucket comes from the prior-year pipeline (cross-year YoY) via
`splitLeadsByBasisWithPrior`. The Lost card sets `invertDelta` so a rise
in losses shows red, not green.

---

## UX disclosures (the truth-in-labelling)

We use two layers, both implemented inside `SingleKPIWidget`.

### Layer 1 — basis micro-meta (always visible)

Every card renders a 9px uppercase line below the trend, e.g.:

```
by close date
by revenue recognition month
by target close date
```

The label is short, low-contrast, never truncated. Designed to read like
a print-style data caption. Source: `basisLabel` prop on `SingleKPIWidget`.

### Layer 2 — calculation tooltip (on hover)

Every card has an `Info` icon next to its label. Hovering reveals a
dark tooltip that contains:

```
[Metric Name]
[1-line definition]
─────────────
Formula: [expression]
Date used: [field chain]
─────────────
[Why this basis — 1 short sentence]
```

Source: `basisInfo` prop on `SingleKPIWidget` (accepts `ReactNode`).

### Header-level note

Inline with the period chip, an `Info` icon shows a tooltip:

> Each KPI uses the date basis appropriate to what it measures (received
> / close / revenue / target close). Hover the ⓘ on any card for details.

This catches users who change the period filter and wonder why some
numbers move differently from others.

---

## Pipeline Value's "excluded" footer

Active deals without a `target_close_date` cannot be bucketed. We do
not fall back silently because:

- The user expects "Pipeline Value · This Quarter" to mean "deals
  forecast to close this quarter," not "all open deals."
- Falling back to `event_date_end` or `+30d from created_at` would
  mask data quality issues in the pipeline.

Instead, the card shows an amber footer:

```
3 active deals excluded — no target close date set
```

Sourced from `stats.activeWithoutTargetClose` in `analytics-dashboard.tsx`.
The fix is for sales reps to set `target_close_date` on their leads.

---

## Pitfalls when extending

- **Don't introduce a 5th basis.** The four cover every meaningful
  question on a sales dashboard. If you find yourself wanting another
  basis, you probably want a different metric instead.
- **Don't bypass `splitLeadsByBasis`.** Custom widgets and new KPIs
  must use this helper so excluded counts and previous-period buckets
  stay correct.
- **Don't share a single `periodLeads` list across cards.** That was
  the bug this whole subsystem replaces. Each card derives from its
  own bucket.
- **Don't forget Layer 1 + Layer 2.** A new card without `basisLabel`
  + `basisInfo` defeats the purpose of the design. The `SingleKPIWidget`
  type allows them to be optional only because the existing custom
  widget renderer (which is user-defined) cannot fill them in.
- **`pipeline_stage` selection.** Lead queries that drive the dashboard
  must select `closed_status` and `stage_type` from `pipeline_stages`,
  not just `name` + `color`. The Lead type allows these as optional
  on `pipeline_stage` because not every fetcher needs them.

---

## Files that matter

```
src/features/leads/lib/dashboard-period.ts                            # DateBasis + helpers
src/features/leads/lib/__tests__/dashboard-period-basis.test.ts       # 16 unit tests
src/features/leads/lib/__tests__/dashboard-period-proration.test.ts   # proration helpers
src/features/leads/components/analytics-dashboard.tsx                 # per-basis stats + KPI list
src/features/leads/components/dashboard-widgets/single-kpi-widget.tsx # Layer 1 + Layer 2 UI
src/types/index.ts                                                    # Lead.pipeline_stage shape
src/app/page.tsx                                                      # lead select includes closed_status + stage_type
```

---

## Smoke test checklist after any change

1. `npm run typecheck` clean.
2. `npx vitest run src/features/leads/lib/__tests__/dashboard-period-basis.test.ts` — 16 tests pass.
3. `npm test` — full suite passes.
4. Visual checks on `/dashboard`:
   - Each card shows a basis micro-meta below the trend.
   - Hovering the ⓘ on each card shows the formula + date basis.
   - Switching from `This Quarter` to `This Month` should change every
     card differently (because they use different bases) — that's
     intentional, not a bug.
   - If any active deal has no `target_close_date`, the Pipeline Value
     card shows the amber excluded footer.
   - The ⓘ next to the period chip shows the global note.
