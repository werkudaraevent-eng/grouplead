"use server"

import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { LeadEngineError, searchClientCompanies } from "@/lib/leadengine/client"

export interface CompanySuggestion {
  id: string
  name: string
  industry: string | null
}

export interface CompanySearchResult {
  companies: CompanySuggestion[]
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
  if (!access) return { companies: [], error: "Sesi tidak valid." }
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { companies: [], error: "Anda tidak punya izin membuat mission." }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) return { companies: [], error: null }

  try {
    const companies = await searchClientCompanies(trimmed)
    return {
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        industry: company.industry ?? null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      companies: [],
      error:
        error instanceof LeadEngineError
          ? error.message
          : "Pencarian perusahaan tidak tersedia saat ini.",
    }
  }
}
