"use server"

import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { LeadEngineError, searchClientCompanies } from "@/lib/leadengine/client"

export interface CompanySuggestion {
  id: string
  name: string
  industry: string | null
}

export interface CompanySearchResult {
  companies: CompanySuggestion[]
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
  if (!access) return { companies: [], previousNames: [], error: "Sesi tidak valid." }
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { companies: [], previousNames: [], error: "Anda tidak punya izin membuat mission." }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) return { companies: [], previousNames: [], error: null }

  // Runs whether or not the CRM answers: it is this app's own data, and it is
  // most useful precisely when the CRM has no match.
  const previousNames = await previousMissionNames(access, trimmed)

  try {
    const companies = await searchClientCompanies(trimmed)
    const known = new Set(companies.map((company) => company.name.trim().toLowerCase()))
    return {
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        industry: company.industry ?? null,
      })),
      previousNames: previousNames.filter((name) => !known.has(name.toLowerCase())),
      error: null,
    }
  } catch (error) {
    return {
      companies: [],
      previousNames,
      error:
        error instanceof LeadEngineError
          ? error.message
          : "Pencarian perusahaan tidak tersedia saat ini.",
    }
  }
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
