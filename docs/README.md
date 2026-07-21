# docs/ — Documentation Index

Documentation for LeadEngine. Start with the system overview; the rest are
topic-specific references.

## Canonical

| Doc | What it covers |
|-----|----------------|
| [leadengine-system-overview.md](leadengine-system-overview.md) | **Start here.** Baseline system doc: routes, domain model, auth/tenancy/RLS, read/write boundaries, legacy status. |

## Dashboard & Analytics

| Doc | What it covers |
|-----|----------------|
| [dashboard-kpi-bases.md](dashboard-kpi-bases.md) | Per-KPI date basis on the Performance Dashboard. Read before touching KPI cards or filter logic. |
| [sales-performance-widget.md](sales-performance-widget.md) | Sales Performance widget data sources, proration, gotchas. |

## Conventions

| Doc | What it covers |
|-----|----------------|
| [text-input-conventions.md](text-input-conventions.md) | How user-typed names are normalized, duplicate-detected, and title-case-suggested across Company / Contact forms. |

## Product & Planning

| Doc | What it covers |
|-----|----------------|
| [launch-readiness-phase-plan.md](launch-readiness-phase-plan.md) | Launch readiness checklist / phase plan. |
| [launch-import-sample-audit.md](launch-import-sample-audit.md) | Import sample data audit for launch. |
| [journey-outline.md](journey-outline.md) | User journey outline. |
| [laporan-mei-2026.md](laporan-mei-2026.md) | May 2026 progress report (Bahasa Indonesia). |
| [sales-mission-mvp-spec.md](sales-mission-mvp-spec.md) | Draft MVP specification for separate Sales Mission application. |
| [sales-mission-flows.md](sales-mission-flows.md) | Mermaid flow diagrams for management, Admin, and Sales. |

### Decisions

| Doc | What it covers |
|-----|----------------|
| [ADR-001-sales-mission-separate-application.md](decisions/ADR-001-sales-mission-separate-application.md) | Separate Sales Mission repository, deployment, database, and API boundary. |

## Site Map

| Doc | What it covers |
|-----|----------------|
| [sitemap.md](sitemap.md) | Route map with required permissions. |
| sitemap.html / journey-presentation.html | Rendered visual versions (open in a browser). |

## Notes

- `superpowers/` holds historical planning specs and cleanup plans. Treat as
  historical unless cross-referenced by current code.
- If a doc conflicts with the code, **the code wins** — see the
  source-of-truth priority in the root [`README.md`](../README.md).
