import type { ListField, ListSpec, RelationTarget, SortTarget } from "./list-plan"

/**
 * The Contacts list: its row, its filters, its sorts, and how it is read
 * from `contact_list_rows` (migration 20260923150000) or, before that
 * migration, from `contacts` with embeds.
 */

export interface ContactListRow {
    id: string
    salutation: string | null
    full_name: string
    email: string | null
    phone: string | null
    job_title: string | null
    contact_source: string | null
    created_at: string
    client_company_id: string | null
    client_company: { name: string } | null
    secondary_email: string | null
    secondary_phone: string | null
    secondary_emails: string[] | null
    secondary_phones: string[] | null
    linkedin_url: string | null
    notes: string | null
    date_of_birth: string | null
    address: string | null
    social_urls: { platform: string; url: string }[] | null
    owner_id: string | null
    owner?: { full_name: string; avatar_url?: string | null } | null
    needs_enrichment?: boolean
}

const COLUMNS =
    "id, salutation, full_name, email, phone, job_title, contact_source, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, needs_enrichment"

const COMPANY: RelationTarget = {
    viewColumn: "company_name",
    fk: "client_company_id",
    table: "client_companies",
    column: "name",
    softDelete: true,
    embed: "client_company",
}

const OWNER: RelationTarget = {
    viewColumn: "owner_name",
    fk: "owner_id",
    table: "profiles",
    column: "full_name",
    embed: "owner",
}

/** The filters, in the filter bar's order; labels and pinning are the bar's, unchanged. */
export const CONTACT_FIELDS: readonly ListField[] = [
    { field: "client_company.name", param: "company", label: "Company", type: "select", pinned: true, target: { kind: "relation", relation: COMPANY } },
    { field: "owner.full_name", param: "owner", label: "Owner", type: "select", pinned: true, target: { kind: "relation", relation: OWNER } },
    { field: "contact_source", param: "source", label: "Contact source", type: "select", pinned: true, target: { kind: "text", column: "contact_source" } },
    { field: "email", param: "email", label: "Has email", type: "boolean", pinned: true, defaultOperator: "is_true", target: { kind: "presence", column: "email" } },
    { field: "phone", param: "phone", label: "Has phone", type: "boolean", defaultOperator: "is_true", target: { kind: "presence", column: "phone" } },
    { field: "job_title", param: "job_title", label: "Job title", type: "text", target: { kind: "text", column: "job_title" } },
    { field: "needs_enrichment", param: "needs_details", label: "Needs details", type: "boolean", defaultOperator: "is_true", target: { kind: "flag", column: "needs_enrichment" } },
    { field: "created_at", param: "created", label: "Created date", type: "date-range", target: { kind: "date", column: "created_at" } },
    { field: "notes", param: "notes", label: "Notes", type: "text", target: { kind: "text", column: "notes" } },
]

const column = (name: string): SortTarget => ({ kind: "column", column: name })

/**
 * Every column a header can sort, keyed as the table and saved views name
 * them. Social links has no order worth sorting by and no header arrow.
 */
export const CONTACT_SORTS: Readonly<Record<string, SortTarget>> = {
    full_name: column("full_name"),
    client_company: { kind: "relation", relation: COMPANY },
    job_title: column("job_title"),
    contact_source: column("contact_source"),
    email: column("email"),
    phone: column("phone"),
    owner: { kind: "relation", relation: OWNER },
    secondary_email: column("secondary_email"),
    secondary_phone: column("secondary_phone"),
    address: column("address"),
    date_of_birth: column("date_of_birth"),
    notes: column("notes"),
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

function fromView(row: Record<string, unknown>): ContactListRow {
    const { company_name, owner_name, owner_avatar_url, ...rest } = row
    return {
        ...(rest as unknown as ContactListRow),
        client_company: text(company_name) ? { name: text(company_name)! } : null,
        owner: text(owner_name) ? { full_name: text(owner_name)!, avatar_url: text(owner_avatar_url) } : null,
    }
}

function fromTable(row: Record<string, unknown>): ContactListRow {
    const r = row as unknown as ContactListRow
    return { ...r, client_company: r.client_company ?? null, owner: r.owner ?? null }
}

export const CONTACT_LIST: ListSpec<ContactListRow> = {
    key: "contacts",
    table: "contacts",
    view: "contact_list_rows",
    tableSelect: `${COLUMNS}, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name, avatar_url)`,
    viewSelect: `${COLUMNS}, company_name, owner_name, owner_avatar_url`,
    nameColumn: "full_name",
    fields: CONTACT_FIELDS,
    sorts: CONTACT_SORTS,
    // The fields the old in-browser search read, company name included.
    search: {
        columns: ["full_name", "salutation", "email", "phone", "job_title", "contact_source", "secondary_email", "secondary_phone"],
        relations: [COMPANY],
    },
    fromView,
    fromTable,
    options: {
        viewSelect: "company_name, owner_name, contact_source",
        tableSelect: "contact_source, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name)",
        fields: {
            "client_company.name": (row) => row.client_company?.name,
            "owner.full_name": (row) => row.owner?.full_name,
            contact_source: (row) => row.contact_source,
        },
    },
}
