import type { ClientCompany } from "@/types"
import type { ListField, ListSpec, RelationTarget, SortTarget } from "./list-plan"

/**
 * The Companies list (client companies, the CRM's customer organisations;
 * never the tenant `companies` table): its row, its filters, its sorts, and
 * how it is read from `client_company_list_rows` (migration 20260923150000)
 * or, before that migration, from `client_companies` with embeds.
 */

export type CompanyListRow = ClientCompany & {
    lead_count: number
    owner?: { full_name: string; avatar_url?: string | null } | null
    parent?: { id: string; name: string } | null
}

const COLUMNS =
    "id, name, industry, line_industry, website, phone, address, area, street_address, city, postal_code, country, parent_id, owner_id, created_at, account_status, needs_enrichment, custom_data"

const OWNER: RelationTarget = {
    viewColumn: "owner_name",
    fk: "owner_id",
    table: "profiles",
    column: "full_name",
    embed: "owner",
}

const PARENT: RelationTarget = {
    viewColumn: "parent_name",
    fk: "parent_id",
    table: "client_companies",
    column: "name",
    softDelete: true,
    embed: "parent",
}

/** The filters, in the filter bar's order; labels and pinning are the bar's, unchanged. */
export const COMPANY_FIELDS: readonly ListField[] = [
    { field: "industry", param: "sector", label: "Sector", type: "select", pinned: true, target: { kind: "text", column: "industry" } },
    { field: "line_industry", param: "line_industry", label: "Line industry", type: "select", pinned: true, target: { kind: "text", column: "line_industry" } },
    { field: "owner.full_name", param: "owner", label: "Owner", type: "select", pinned: true, target: { kind: "relation", relation: OWNER } },
    { field: "phone", param: "phone", label: "Has phone", type: "boolean", defaultOperator: "is_true", target: { kind: "presence", column: "phone" } },
    { field: "website", param: "website", label: "Has website", type: "boolean", defaultOperator: "is_true", target: { kind: "presence", column: "website" } },
    { field: "country", param: "country", label: "Country", type: "select", target: { kind: "text", column: "country" } },
    { field: "needs_enrichment", param: "needs_details", label: "Needs details", type: "boolean", defaultOperator: "is_true", target: { kind: "flag", column: "needs_enrichment" } },
    { field: "created_at", param: "created", label: "Created date", type: "date-range", target: { kind: "date", column: "created_at" } },
]

const column = (name: string): SortTarget => ({ kind: "column", column: name })

/** Every column a header can sort, keyed as the table and saved views name them. */
export const COMPANY_SORTS: Readonly<Record<string, SortTarget>> = {
    name: column("name"),
    industry: column("industry"),
    line_industry: column("line_industry"),
    phone: column("phone"),
    website: column("website"),
    owner: { kind: "relation", relation: OWNER },
    parent: { kind: "relation", relation: PARENT },
    address: column("address"),
    city: column("city"),
    postal_code: column("postal_code"),
    country: column("country"),
    created_at: column("created_at"),
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

function fromView(row: Record<string, unknown>): CompanyListRow {
    const { parent_name, owner_name, owner_avatar_url, ...rest } = row
    const base = rest as unknown as CompanyListRow
    return {
        ...base,
        lead_count: 0,
        parent: text(parent_name) && base.parent_id ? { id: base.parent_id, name: text(parent_name)! } : null,
        owner: text(owner_name) ? { full_name: text(owner_name)!, avatar_url: text(owner_avatar_url) } : null,
    }
}

function fromTable(row: Record<string, unknown>): CompanyListRow {
    const r = row as unknown as CompanyListRow
    return { ...r, lead_count: 0, parent: r.parent ?? null, owner: r.owner ?? null }
}

export const COMPANY_LIST: ListSpec<CompanyListRow> = {
    key: "companies",
    table: "client_companies",
    view: "client_company_list_rows",
    tableSelect: `${COLUMNS}, parent:parent_id(id, name), owner:profiles!client_companies_owner_id_fkey(full_name, avatar_url)`,
    viewSelect: `${COLUMNS}, parent_name, owner_name, owner_avatar_url`,
    nameColumn: "name",
    fields: COMPANY_FIELDS,
    sorts: COMPANY_SORTS,
    // The fields the old in-browser search read, owner and parent included.
    search: {
        columns: ["name", "industry", "line_industry", "phone", "website", "city", "country"],
        relations: [OWNER, PARENT],
    },
    fromView,
    fromTable,
    options: {
        viewSelect: "industry, line_industry, country, owner_name",
        tableSelect: "industry, line_industry, country, owner:profiles!client_companies_owner_id_fkey(full_name)",
        fields: {
            industry: (row) => row.industry,
            line_industry: (row) => row.line_industry,
            "owner.full_name": (row) => row.owner?.full_name,
            country: (row) => row.country,
        },
    },
}
