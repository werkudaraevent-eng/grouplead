# Product Overview

LeadEngine is a corporate lead management and CRM system built for **Werkudara Group**, an Indonesian event management company.

## Core Purpose
Track corporate event leads through a sales pipeline — from initial inquiry to closed deal — with SLA tracking, department task workflows, and financial oversight.

## Key Concepts
- **Leads**: Corporate event projects (conferences, galas, product launches) with a 60+ column schema covering identity, event details, financials, SLA timestamps, and contact info
- **Pipeline Stages**: Lead Masuk → Estimasi Project → Proposal Sent → Closed Won / Closed Lost
- **Business Units (BU)**: WNW, WNS, UK, TEP, CREATIVE
- **Departments**: TEP, CREATIVE, FINANCE, LEGAL, PD, SO, ACS — each handles specific workflow tasks per lead
- **SLA Tracking**: Timestamps track handoffs between departments (e.g. TEP→PD, PD→SO). Completing a department task auto-updates the corresponding SLA column on the lead via database triggers
- **Lead Tasks**: Trello-style task cards assigned to departments per lead. Completing tasks drives the SLA timeline forward
- **Profiles & Roles**: super_admin, director, bu_manager, sales, finance — linked to Supabase Auth

## Currency & Locale
- Financial amounts are in IDR (Indonesian Rupiah)
- Display format uses compact notation: Rp1.2B, Rp500M
- Some field names use Indonesian terms (e.g. `tipe`, `nominal_konfirmasi`, `selisih`)

## Current State
- The lead form is under maintenance for the new 60-column schema (placeholder UI shown)
- Companies and Contacts pages derive data from the leads table (no separate tables yet)
- RLS policies are permissive (public access) — intended to be tightened later
