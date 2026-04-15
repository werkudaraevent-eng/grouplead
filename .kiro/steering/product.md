# Product Overview

LeadEngine is an internal multi-company CRM and lead management system for **Werkudara Group**, an Indonesian event management holding company.

## Canonical Reference
The authoritative system document is [docs/leadengine-system-overview.md]. Always defer to that file and the actual codebase when conflicts arise.

## Core Purpose
Track corporate event leads through configurable sales pipelines — from initial inquiry to closed deal — with multi-company data isolation, RBAC permissions, and management-facing analytics.

## Key Concepts
- **Leads**: Corporate event opportunities with structured schema covering identity, event details, financials, classification, and contact info
- **Pipeline Stages**: Configurable per-pipeline with transition rules, closure restrictions, and required-field gating
- **Client Companies**: CRM customer organizations (distinct from internal tenant `companies`)
- **Contacts**: CRM contacts linked to client companies
- **Companies (Tenancy)**: Internal tenant/business units with holding-company model for cross-company visibility
- **Company Members**: Users mapped to companies with user types (staff, leader, executive, admin, super_admin)
- **RBAC**: Role-based permissions via `role_permissions` + `app_modules` matrix, company-scoped
- **RLS**: Postgres Row Level Security as the authoritative access control boundary
- **Master Options**: Dynamic dropdown values for classification fields, company-scoped or global
- **Form Schemas**: Dynamic form field configuration and layout metadata per module

## Currency & Locale
- Financial amounts in IDR (Indonesian Rupiah)
- Display format: compact notation (Rp1.2B, Rp500M)
- Some field names use Indonesian terms (e.g. `tipe`, `kategori`)

## Active Product Scope
- Lead tracking and pipeline management
- Client company and contact database
- Multi-company tenancy with holding view
- RBAC permissions and user management
- Pipeline configuration and transition rules
- Master options and form schema settings
- Management-facing analytics dashboard

## Out of Active Scope
- Department-based lead task workflows (legacy artifacts exist but not active direction)
- Centralized activity log (fragmented across multiple tables, not yet unified)

## Upcoming: Goal Management & Management Dashboard
A design blueprint exists at [docs/superpowers/specs/2026-04-14-goal-management-design.md] for:
- Revenue goal setting with hierarchical templates
- Analytical dimensions (segment, line industry, etc.)
- Period attribution with configurable cutoff rules
- Snapshot-based closed-period reporting
- Attainment vs forecast separation
- Management dashboard with drill-down and saved views

This is not yet implemented — treat as approved design direction.
