# ADR-001: Sales Mission as Separate Application

## Status
Superseded by ADR-002

## Date
2026-07-21

## Context

Werkudara Group needs scheduling and structured result capture for sales missions. LeadEngine already owns CRM data and is an active product. The existing `Booking-Room-System` repository is used for internal room booking and does not provide the required Sales Mission domain or stable integration API.

Requirements:

- Sales Mission must not disturb LeadEngine.
- Users and tenant context should be shared.
- Company and contact master data must remain in LeadEngine.
- Mission scheduling, results, and reporting need independent ownership.
- Admin must configure mission types and form fields without code changes.

## Decision

Build Sales Mission as a new repository and separate deployment.

- Shared authentication identity with LeadEngine.
- Separate Sales Mission business database.
- Tenant switch supported in Sales Mission.
- LeadEngine remains master for users, tenant membership, `client_companies`, and `contacts`.
- Sales Mission communicates with LeadEngine through versioned APIs.
- No direct cross-database access.
- Sales Mission stores external IDs and immutable snapshots for history.
- Reporting remains inside Sales Mission; results do not create LeadEngine timeline/activity records.

## Alternatives considered

### Add Sales Mission inside LeadEngine

Rejected. It would increase coupling between an active CRM and a new scheduling/result domain, raising release and regression risk.

### Modify `Booking-Room-System` into Sales Mission

Rejected. That application is used for internal room booking. Its existing activity model does not include the required company/contact/result domain or stable API contract.

### Monorepo with separate apps

Accepted later by ADR-002. This ADR records the original separate-repository decision.

## Consequences

### Positive

- Sales Mission releases do not require LeadEngine deployment.
- Domain ownership is explicit.
- Separate database limits accidental coupling.
- API boundary enables future providers or integrations.
- Admin-configurable forms reduce code changes for business field changes.

### Negative

- Requires API versioning and contract testing.
- Shared authentication and tenant context need careful security validation.
- Cross-app debugging and deployment coordination are more complex.
- Company/contact operations depend on LeadEngine availability.

## Guardrails

- Every Sales Mission business table is tenant-scoped.
- Backend validates tenant membership; client-provided tenant ID is never trusted alone.
- External API payloads are schema-validated.
- API errors use a consistent structure.
- Master company/contact changes go through LeadEngine API.
- Mission snapshots and mapping history are not hard-deleted.
