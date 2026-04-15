# Goal Management And Management Dashboard Design

> **For future implementation:** this is a design/blueprint document, not a statement that the feature is already implemented.
> Baseline system truth remains [docs/leadengine-system-overview.md](D:\Website\Group Lead 2026\docs\leadengine-system-overview.md).

## V1 Simplification

> **Added 2026-07** — This section documents the V1 implementation scope.

V1 takes a pragmatic, minimal approach to goal management:

- **Templates, Dimensions, and Buckets are deferred to V2.** The full hierarchical template system, analytical dimension CMS, bucket classification rules, and template versioning described in this document remain the approved design direction but are not implemented in V1.
- **V1 uses direct goal creation with auto-computed breakdowns from lead data.** Users create revenue goals directly (name, period type, target amount) without selecting or configuring templates.
- **Breakdown is read-only, computed in real time from leads.** The Goal Settings page includes a "Goal Breakdown" section that groups lead attainment and pipeline data by Client Company or Sales Owner (`pic_sales_id`). No child goals or template nodes are created — the breakdown is purely a query-time aggregation.
- **No template versioning, node trees, or bucket rules in V1.** These CMS surfaces (Templates page, Dimensions page) are hidden from navigation but preserved in the codebase for V2 re-enablement.
- **No database schema changes.** V1 works entirely with the existing `goals`, `goal_periods`, `goal_settings`, `leads`, `pipeline_stages`, `client_companies`, and `profiles` tables.

### V1 Feature Surface

| Area | V1 Scope |
|------|----------|
| Goal creation | Name, period type, target amount |
| Goal periods | Monthly, quarterly, yearly with open/close lifecycle |
| Breakdown | Read-only, by Client Company or Sales Owner, from lead data |
| Attribution settings | Event date / closed won date basis, cutoff day |
| Forecast settings | Weighted forecast on/off, stage weights |
| Critical fields | Protected reporting-critical field list |
| Auto-lock | Scheduled period auto-close |
| Templates | Deferred to V2 |
| Dimensions | Deferred to V2 |
| Buckets & classification | Deferred to V2 |
| Snapshot-based history | Existing infrastructure, used by period close |

## Goal

Design a management-grade goal and reporting system that lets the company define revenue goals, break them down through configurable hierarchies and analytical dimensions, and monitor attainment, forecast, and history without requiring future recoding for common planning changes.

## Executive Summary

In business terms, the system should work like this:

- management sets one main company revenue goal
- that goal can be broken down into smaller owned targets
- the breakdown can follow company ownership, sales ownership, and analytical groupings such as segment
- the dashboard shows what is already achieved, what is still pipeline, and what is realistically likely to close
- historical reports stay stable after a period is closed, even if mappings or templates change later

The main objective is to let management answer, in one place and quickly:

- Are we on track?
- Which area is helping or hurting the result?
- Is the gap caused by weak attainment, weak forecast, or poor data structure?

## Product Intent

This system exists to help management make quick decisions from the dashboard by answering:

- Is the main company goal on track?
- Which breakdowns are on track or off track?
- Which companies, segments, and sales owners are contributing to gaps?
- What does recent history suggest about likely performance ahead?
- How much of the outlook is actual attainment versus forecasted pipeline?

## Non-Goals For V1

These are explicitly out of V1 scope:

- company/contact growth as first-class goal engines
- free-form formula builder for bucket rules
- add/remove arbitrary dashboard widgets
- manual lead-to-bucket overrides
- making the dashboard a full CRUD surface

## Core Principles

1. Revenue goal attainment value is based only on `Closed Won` leads using `actual_value`, while period placement follows the configured attribution basis and monthly closing rule.
2. Forecast is always separated from attainment.
3. Open periods may read live data; closed periods must be snapshot-based.
4. Admin changes to templates, dimensions, or mappings must not silently rewrite closed history.
5. The CMS must be flexible enough that common planning changes do not require code changes.

## Scope Summary

V1 includes:

- company revenue goals
- monthly, quarterly, and yearly goal periods
- multi-template hierarchical goal breakdowns
- rule-based analytical dimensions, including custom dimensions such as `segment`
- ownership hierarchy using built-in lead ownership fields
- configurable period attribution rules
- snapshot-based closed-period reporting
- configurable raw and weighted forecast reporting
- management dashboard with read-mostly drill-down behavior
- goal settings CMS with granular permissions

## Business Reading Model

The dashboard should help management read the business through three clearly separated lenses:

1. `Attainment`
   - revenue that is already real and counted
   - based on `Closed Won` and `actual_value`

2. `Forecast`
   - revenue that is still in pipeline and may close
   - shown as raw pipeline and optionally weighted forecast

3. `History`
   - how the business has performed across closed periods
   - should remain stable after period close unless an audited reopen happens

These three lenses must never be mixed into one ambiguous number.

## Terminology

### Goal Period

A planning/reporting period such as:

- monthly
- quarterly
- yearly

Business meaning:

- monthly is for operational review
- quarterly is for management correction and pattern reading
- yearly is for strategic target direction

### Goal Template

A versioned, hierarchical template describing how a goal is broken down.

### Ownership Hierarchy

The path of target ownership, such as:

- holding
- company/subsidiary
- sales owner

This is not hardcoded to one exact business structure forever, but V1 ownership sources are fixed to current system fields.

### Analytical Dimension

A rule-based classification used to analyze or break down results, such as:

- segment
- line industry
- category
- lead source

### Segment

`segment` is not a hardcoded organizational level. It is a custom analytical dimension built from mappings such as:

- `line_industry` in `Banking`, `Finance`, `Financial Institution`, `Insurance`, `Financial Technologies`
- mapped into segment `BFSI`

### Reporting-Critical Field

A lead field whose post-win changes materially affect goal attribution, attainment, ownership, or period reporting.

V1 mandatory protected minimum set:

- `actual_value`
- `event_date` / event end date basis
- `project_name`
- `company_id`
- `pic_sales_id`

Super admin may extend this list, but cannot remove the protected minimum set.

## Example End-To-End Flow

Example:

- company yearly goal = `120B`
- period = `monthly`
- attribution basis = `event date`
- monthly closing cutoff = `25`
- template = `Revenue by Company -> Segment -> Sales`

One lead has:

- event dates: `24, 25, 26 August`
- stage: `Closed Won`
- `actual_value = 500M`
- `company_id = WNW`
- `pic_sales_id = Ahmad`
- `line_industry = Banking`

Then:

- because the event end date is `26 August` and cutoff is `25`, the lead is counted into `September`
- it contributes `500M` to attainment
- it rolls up to:
  - holding
  - WNW
  - segment `BFSI`
  - sales `Ahmad`

If the same lead was still only in pipeline:

- it would contribute to forecast
- not to attainment

## Goal Model

### Top-Level Goal

The primary business goal is revenue.

Company/contact metrics may appear on the management dashboard as contextual analytics, but they are not first-class goal engines in V1.

### Hierarchical Templates

Templates are hierarchical, not flat.

Example:

- Company Goal
  - Segment
    - Line Industry
      - Category

Each level may use a different dimension.

### Multi-Template Support

Admins may create multiple templates.

Each goal period chooses which published template version it uses.

### Template Versioning

Templates must support at least:

- `draft`
- `published`

When a goal period adopts a template, the system stores a versioned snapshot reference so later template edits do not mutate closed history.

## Breakdown Rules

### Rule Engine V1

V1 supports:

- `is one of`
- `AND` combinations across multiple fields
- deterministic priority ordering
- overlap warning
- mandatory fallback bucket

V1 does not support:

- formula scripting
- arbitrary nested boolean logic beyond the supported simple model

### Single-Bucket Rule

At each level, one lead may belong to one bucket only.

If multiple buckets match:

- system applies the highest-priority matching bucket
- system surfaces overlap warning to the admin

If no bucket matches:

- the lead goes to a mandatory fallback bucket such as `Others` or `Unmapped`

## Ownership Hierarchy

### V1 Ownership Sources

Ownership roll-up uses current system fields:

- company/subsidiary from `company_id`
- sales from `pic_sales_id`

These are ownership sources, not free-form custom buckets.

### Why Ownership Is Separate From Analytical Dimensions

Ownership answers who owns the target.

Analytical dimensions answer how results are classified and analyzed.

Keeping these separate prevents hardcoding business reporting structures into organizational logic.

## Period Attribution

### Supported Period Types

The system supports from the start:

- monthly
- quarterly
- yearly

### Basis Options

Admins can configure the period attribution basis:

- `event date`
- `closed won date`

For event-based attribution:

- the system uses event end date for multi-day events
- the period bucket follows the configured monthly closing cutoff

Recommended business default:

- `event date` basis
- using event end date for multi-day events
- with monthly closing cutoff configured in settings

Why this default is recommended:

- it matches how the company currently reads monthly business performance
- it aligns reporting with the company's closing practice
- it keeps the dashboard useful for management without forcing a code change when the cutoff policy evolves

Example:

- event dates `2026-08-24`, `2026-08-25`, `2026-08-26`
- monthly cutoff day `25`
- because the end date is `2026-08-26`, the event is attributed to September

### Cutoff Configuration

Admins can configure monthly cutoff logic in CMS:

- one rule reused for all months
- or explicit per-month settings

### Scope Of Period Rules

Period attribution rules use:

- global default
- optional template override

## Goal Target Entry

### Modes

Target values on nodes can be:

- manual
- automatic from admin-entered percentage
- automatic from history

### History-Based Automatic Allocation

Recommended order:

1. same period last year
2. previous comparable period
3. manual fallback if history is insufficient

This fallback chain is part of the model, not an implementation afterthought.

## Attainment, Forecast, And History

### Attainment

Goal attainment is calculated only from:

- leads that are `Closed Won`
- using `actual_value`

Estimated pipeline values never count as attainment.

This rule defines:

- which leads are eligible for attainment
- which numeric field is used for attainment value

It does not by itself define which month/quarter/year the attainment belongs to. Period placement is controlled separately by the configured attribution basis and closing cutoff rule.

Business interpretation:

- attainment answers: "How much revenue is already achieved?"
- period attribution answers: "In which reporting bucket should that achieved revenue appear?"

### Forecast

Forecast remains separate from attainment.

V1 dashboard should support:

- raw pipeline
- weighted forecast

Weighted forecast is configurable:

- on/off at settings level
- global default stage weights
- optional pipeline-level overrides

Business interpretation:

- raw pipeline answers: "What is the total open opportunity value?"
- weighted forecast answers: "What is the more realistic likely value of that open pipeline?"

Both numbers are useful, but neither should replace attainment.

### Closed Won Gating

The current business flow already requires a modal on move to `Closed Won` with:

- amount
- event name
- event date

And a modal on move to `Lost` with:

- lost reason

This supports cleaner reporting inputs for the future goal engine.

### Snapshot Strategy

Open periods:

- may read live data

Closed periods:

- are snapshot-based

Snapshots preserve:

- template version used
- ownership/analytical attribution state
- period rule state
- attainment/forecast numbers as of close

Business reason:

- management must be able to trust that last month's review deck does not silently change because someone edited mappings or templates later

### Reopen Strategy

Closed periods are locked by default.

Allowed controls:

- manual close
- auto-close / auto-lock from CMS schedule
- controlled reopen by authorized roles

Every reopen must capture:

- actor
- reason
- timestamp
- resulting recalculation/snapshot revision

Business reason:

- closed periods should feel final
- corrections are allowed, but they must be visible and auditable

## Post-Win Adjustments

### Edit Policy

Won leads may still be edited.

However, reporting-critical fields require special permission.

### Reporting Effect

When a lead first moves into `Closed Won`, the system should create reporting snapshot data.

If a reporting-critical field changes later:

- system creates an adjustment record
- change is audited
- closed-period history should not mutate silently

## Dashboard Design Direction

### Dashboard Role

The management dashboard is a read-mostly decision-support surface.

Allowed V1 interactions:

- filter
- export
- drill-down to lead/company/contact detail
- saved views
- widget reordering

Not allowed in V1:

- general record editing from the dashboard
- add/remove arbitrary widgets

Business reason:

- the dashboard is for fast reading and decision support
- operational editing should happen in the relevant lead, company, or contact surfaces

### Default Landing

Default view should be:

- holding consolidated

Then users can drill down into:

- subsidiary/company
- lower-level ownership
- analytical breakdowns

### Widget Set V1

Use one default widget set for all users.

Users may reorder widgets, but V1 does not support add/remove widget catalog management.

Suggested default widget categories:

- goal attainment summary
- raw pipeline
- weighted forecast
- historical trend
- breakdown by company
- breakdown by segment
- sales contribution
- variance / gap indicators
- drill-down exception lists

Recommended reading order for management:

1. total goal attainment
2. forecast outlook
3. historical trend
4. breakdown by company and segment
5. sales and exception lists

## Saved Views

Saved views should support:

- personal views
- shared views

Shared views should be permission-restricted.

Minimum saveable state should include:

- period
- scope/company selection
- goal template
- attribution basis
- relevant dashboard filters
- layout ordering state

## Permissions

This feature needs dedicated permissions rather than relying on broad admin access.

Suggested permission families:

- `management_dashboard.read`
- `goal_settings.read`
- `goal_settings.manage`
- `goal_template.manage`
- `goal_period.manage`
- `goal_period.close`
- `goal_period.reopen`
- `forecast_settings.manage`

`super_admin` must retain full access.

## CMS Surfaces Needed

### Goal Settings

Should manage:

- goal periods
- global period attribution defaults
- monthly cutoff settings
- auto-lock schedule
- default forecast settings
- protected reporting-critical field extensions

This is the governance center of the system.

### Goal Template Settings

Should manage:

- templates
- versions
- bucket rules
- level-by-level dimensions
- fallback bucket naming
- overlap warnings
- priority ordering

This is where admins define how the business is broken down and read.

### Analytical Dimension Settings

Should manage:

- reusable custom dimensions
- mapping from existing lead fields to higher-order groupings such as `segment`

This is what prevents future recoding when management wants to regroup the business.

### Ownership/Allocation Settings

Should manage:

- target allocation mode
- manual vs automatic allocation
- historical basis selection
- percentage allocation input where relevant

## Risks And Guardrails

### Key Risks

- mixing implemented behavior with future-state reporting rules
- silent mutation of closed history
- overlap rules that create confusing attribution
- too much CMS freedom without guardrails
- overloading the dashboard with edit behavior

### Guardrails

- keep system overview and design blueprint separate
- protect a minimum set of reporting-critical fields
- use snapshotting for closed periods
- require audit trail on reopen and adjustment flows
- separate attainment from forecast at all times

## Recommended Implementation Order

1. canonical data model for goals, templates, dimensions, periods, snapshots, and adjustments
2. CMS for analytical dimensions and template versioning
3. period attribution and period governance settings
4. attainment and forecast calculation services
5. management dashboard read model
6. saved views and widget layout persistence
7. drill-down and export refinement

## Review Gate

This document should be reviewed and approved before implementation planning begins.
