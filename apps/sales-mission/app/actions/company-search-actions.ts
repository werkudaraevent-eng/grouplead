"use server"

import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { LeadEngineError, searchClientCompanies } from "@/lib/leadengine/client"

export interface CompanySuggestion {
  id: string
  name: string
  industry: string | null
}

export interface ProspectSuggestion {
  id: string
  name: string
  statusLabel: string
  ownerName: string | null
  clientCompanyId: string | null
  location: string | null
  address: string | null
  notes: string | null
  contactSalutation: string | null
  contactName: string | null
  contactJobTitle: string | null
  contactPhone: string | null
  contactEmail: string | null
}

export interface CompanySearchResult {
  companies: CompanySuggestion[]
  /** Open prospects whose company matches: picking one links the mission to it. */
  prospects: ProspectSuggestion[]
  /**
   * Names typed on earlier missions in this unit that the CRM does not know.
   * Offered so the second rep to visit a new company reuses the first rep's
   * spelling instead of inventing a near-duplicate that two submits then turn
   * into two CRM rows.
   */
  previousNames: string[]
  /** Set when LeadEngine could not be reached, so the UI can say why. */
  error: string | null
}

/**
 * Live search for the client-company picker.
 *
 * Read-only by design: searching never writes to LeadEngine, so it cannot
 * create duplicates. A failure returns an explanatory message rather than
 * throwing — the rep can still type a name and continue, and the company gets
 * linked through the CRM review flow later.
 *
 * Held to the same grant as the one form that uses it. Read-only does not mean
 * harmless: this walks LeadEngine's client list a prefix at a time, and the
 * only screen offering it is the one guarded by mission `create`.
 */
export async function searchCompanies(query: string): Promise<CompanySearchResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { companies: [], prospects: [], previousNames: [], error: "Sesi tidak valid." }
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { companies: [], prospects: [], previousNames: [], error: "Anda tidak punya izin membuat mission." }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) return { companies: [], prospects: [], previousNames: [], error: null }

  // Both lookups at once. The CRM hop is the slow one and the own-history
  // read does not depend on it; waiting for them in turn added the whole of
  // the short one to every keystroke.
  const [previousNames, prospects, crm] = await Promise.all([
    // Runs whether or not the CRM answers: it is this app's own data, and it
    // is most useful precisely when the CRM has no match.
    previousMissionNames(access, trimmed),
    (await canPerform(access, "sales_mission_prospect", "read")) ? openProspects(access, trimmed) : Promise.resolve([]),
    searchClientCompanies(trimmed).then(
      (companies) => ({ ok: true as const, companies }),
      (error: unknown) => ({ ok: false as const, error })
    ),
  ])

  if (!crm.ok) {
    return {
      companies: [],
      prospects,
      previousNames,
      error:
        crm.error instanceof LeadEngineError
          ? crm.error.message
          : "Pencarian perusahaan tidak tersedia saat ini.",
    }
  }

  {
    const companies = crm.companies
    const known = new Set(companies.map((company) => company.name.trim().toLowerCase()))
    return {
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        industry: company.industry ?? null,
      })),
      prospects,
      previousNames: previousNames.filter((name) => !known.has(name.toLowerCase())),
      error: null,
    }
  }
}

/** Open prospects (no mission yet) whose company matches, for the picker's third group. */
async function openProspects(
  access: NonNullable<Awaited<ReturnType<typeof getSalesMissionAccess>>>,
  query: string
): Promise<ProspectSuggestion[]> {
  const supabase = await createClient()
  const escaped = query.replace(/[%_]/g, (match) => `\\${match}`)
  const { data } = await supabase
    .schema("sales_mission")
    .from("prospects")
    .select("id, client_company_name, client_company_id, location, address, notes, contact_salutation, contact_name, contact_job_title, contact_phone, contact_email, owner_id, status_id")
    .eq("company_id", access.companyId)
    .is("deleted_at", null)
    .is("mission_id", null)
    .ilike("client_company_name", `%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(8)
  const rows = data ?? []
  if (rows.length === 0) return []
  const [{ data: owners }, { data: statuses }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((row) => row.owner_id as string).filter(Boolean))]),
    supabase.schema("sales_mission").from("prospect_statuses").select("id, label").in("id", [...new Set(rows.map((row) => row.status_id as string))]),
  ])
  const ownerName = new Map((owners ?? []).map((row) => [row.id as string, row.full_name as string]))
  const statusLabel = new Map((statuses ?? []).map((row) => [row.id as string, row.label as string]))
  return rows.map((row) => ({
    id: row.id as string,
    name: row.client_company_name as string,
    statusLabel: statusLabel.get(row.status_id as string) ?? "",
    ownerName: row.owner_id ? (ownerName.get(row.owner_id as string) ?? null) : null,
    clientCompanyId: (row.client_company_id as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    contactSalutation: (row.contact_salutation as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactJobTitle: (row.contact_job_title as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
  }))
}

/** Distinct typed company names on this unit's missions that are not CRM-linked. */
async function previousMissionNames(
  access: NonNullable<Awaited<ReturnType<typeof getSalesMissionAccess>>>,
  query: string
): Promise<string[]> {
  const supabase = await createClient()
  const escaped = query.replace(/[%_]/g, (match) => `\\${match}`)
  const { data } = await supabase
    .schema("sales_mission")
    .from("missions")
    .select("client_company_name_snapshot")
    .is("deleted_at", null)
    .eq("company_id", access.companyId)
    .is("client_company_id", null)
    .ilike("client_company_name_snapshot", `%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(30)

  const seen = new Set<string>()
  const names: string[] = []
  for (const row of data ?? []) {
    const name = (row.client_company_name_snapshot as string).trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name)
    if (names.length === 5) break
  }
  return names
}
