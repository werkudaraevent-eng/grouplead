# Sales Mission Flow Diagrams

Diagrams cover MVP behavior for management, Admin, and Sales.

## 1. Platform boundary

```mermaid
flowchart LR
    U[Shared Identity] --> L[LeadEngine]
    U --> S[Sales Mission]
    L -->|Users, tenant membership| S
    L -->|Company/contact API v1| S
    S -->|Mission, result, reporting| SDB[(Sales Mission DB)]
    L --> LDB[(LeadEngine DB)]
    S -. no direct DB access .-> LDB
```

## 2. End-to-end mission flow

```mermaid
flowchart TD
    A[Sales/Admin contacts client] --> B{Client confirms visit?}
    B -- No --> X[No mission created / follow-up later]
    B -- Yes --> C[Create mission]
    C --> D[Live search client company in LeadEngine]
    D --> E{Company found?}
    E -- Yes --> F[Save LeadEngine ID + company snapshot]
    E -- No --> G[Create pending company via LeadEngine API]
    G --> H[Save pending company ID + snapshot]
    F --> I[Contact optional]
    H --> I
    I --> J[Set mission type, date, time, location, initial contact details]
    J --> K[Assign one primary sales]
    K --> L[Assign zero or more supporting sales]
    L --> M{Conflict after admin buffer check?}
    M -- Yes --> N[Show conflict; change time or assignment]
    N --> M
    M -- No --> O[Send assignment notifications]
    O --> P{Primary accepts?}
    P -- No --> Q[Admin reassigns, reschedules, or cancels]
    P -- Yes --> R[Mission accepted; supporting responses non-blocking]
    R --> T[Mission appears in Sales calendar and list]
    T --> V[Mission visit]
    V --> W[Primary fills result; supporting sales add separate notes]
    W --> Y[Primary submits result]
    Y --> Z[Result enters KPI/reporting]
```

## 3. Assignment response flow

```mermaid
stateDiagram-v2
    [*] --> ASSIGNED
    ASSIGNED --> ACCEPTED: Primary accepts
    ASSIGNED --> REJECTED: Sales rejects assignment
    ASSIGNED --> RESCHEDULE_REQUESTED: Sales requests new time
    RESCHEDULE_REQUESTED --> ASSIGNED: Admin rejects request
    RESCHEDULE_REQUESTED --> SCHEDULED: Admin approves new time
    SCHEDULED --> ASSIGNED: Admin assigns sales
    ACCEPTED --> IN_PROGRESS: Mission starts
    ACCEPTED --> CANCELLED: Admin cancels
    IN_PROGRESS --> COMPLETED: Visit finished
    COMPLETED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]

    note right of ACCEPTED
      Primary acceptance required.
      Supporting pending/rejected does not block.
    end note
```

## 4. Result flow

```mermaid
flowchart TD
    A[DRAFT result] --> B{Required validation passes?}
    B -- No --> C[Show validation errors; remain DRAFT]
    B -- Yes --> D[SUBMITTED]
    D --> E[KPI/reporting immediately]
    E --> F{Admin finds specific issue?}
    F -- No --> G[Keep SUBMITTED]
    F -- Yes --> H[NEEDS_CLARIFICATION + concrete admin note]
    H --> I[Primary updates result]
    I --> J[RESUBMITTED / SUBMITTED]
    J --> E
```

`NEEDS_CLARIFICATION` is not a generic approval gate. It records a specific question or correction request after a valid submission.

## 5. Contact capture and matching flow

```mermaid
flowchart TD
    A[Contact added during initial contact or visit] --> B{Existing LeadEngine contact selected?}
    B -- Yes --> C[Save contact ID + snapshot]
    B -- No --> D[Save contact snapshot in mission]
    D --> E{Enough identity data for review?}
    E -- No --> F[PENDING_REVIEW; no name-only auto-match]
    E -- Yes --> G[Submit new contact to LeadEngine review]
    G --> H{Admin CRM decision}
    H -- MATCH_EXISTING --> I[Map pending contact to master ID]
    H -- CREATE_NEW --> J[Create master contact]
    H -- Needs more data --> F
    C --> K[Contact linked to mission]
    I --> K
    J --> K
    F --> K
```

One mission supports multiple contact records through a repeatable contact group.

## 6. Company review and mapping flow

```mermaid
flowchart TD
    A[Company selected from live search] --> B[Save master ID + snapshot]
    C[Company not found] --> D[Create PENDING_REVIEW company through LeadEngine API]
    D --> E[Mission can continue operationally]
    E --> F{Admin CRM decision}
    F -- MATCH_EXISTING --> G[Create official mapping pending -> existing]
    F -- APPROVE_NEW --> H[Promote pending company to master]
    F -- REJECT_DUPLICATE --> I[Mark duplicate; request correction]
    G --> J[Update all pending mission relations]
    H --> J
    I --> K[Mission remains with review-required relation]
    B --> L[Mission linked to company]
    J --> L
```

The mapping updates live references. Original company name and relation history remain immutable for audit.

## 7. Tenant switch and data isolation

```mermaid
flowchart LR
    A[User login] --> B[Load allowed tenant memberships]
    B --> C[Select active tenant]
    C --> D[Sales Mission validates membership server-side]
    D --> E[Scoped queries use company_id]
    E --> F[Calendar, list, form, reports]
    D -. invalid .-> G[403 / no data]
```

`company_id` is tenant scope. `client_company_id` is visited customer. They are different fields and must never be interchanged.

## 8. Admin configuration flow

```mermaid
flowchart TD
    A[Admin opens Settings] --> B{Choose configuration}
    B --> C[Mission type]
    B --> D[Form template]
    B --> E[Dynamic fields/options]
    B --> F[Conflict buffer]
    B --> G[Notification channels]
    C --> H[Save + audit]
    D --> I[Create new template version]
    E --> I
    F --> H
    G --> H
    I --> J[Publish for new missions only]
    J --> K[Existing missions retain captured template version]
```

## 9. Management view

```mermaid
flowchart LR
    A[Mission volume] --> R[Reporting]
    B[Result by sales] --> R
    C[Result by company] --> R
    D[Result by mission type] --> R
    E[Potential opportunity] --> R
    F[Open next actions] --> R
    G[Contacts discovered] --> R
    H[Needs clarification] --> R
    R --> I[Management dashboard]
```
