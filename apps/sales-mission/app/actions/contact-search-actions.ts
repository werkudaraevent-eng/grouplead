"use server"

import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { LeadEngineError, fetchCompanyContacts } from "@/lib/leadengine/client"

export interface ContactSuggestion {
  id: string
  fullName: string
  jobTitle: string | null
  phone: string | null
  email: string | null
}

export interface ContactLookupResult {
  contacts: ContactSuggestion[]
  /** Set when LeadEngine could not be reached, so the UI can say why. */
  error: string | null
}

/**
 * The people the CRM already knows at a company.
 *
 * Held to the same grant as the form that uses it. Read-only does not mean
 * harmless: this returns names, job titles, phone numbers and emails, and the
 * only screen that offers it is the one guarded by mission `create`.
 *
 * A failure returns an empty list with a message rather than throwing. The
 * contact is typed by hand today and must stay typeable tomorrow: a CRM outage
 * cannot be allowed to stop a rep scheduling a visit.
 */
export async function lookupCompanyContacts(clientCompanyId: string): Promise<ContactLookupResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { contacts: [], error: "Sesi tidak valid." }

  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { contacts: [], error: "Anda tidak punya izin membuat aktivitas." }
  }

  if (!clientCompanyId) return { contacts: [], error: null }

  try {
    const contacts = await fetchCompanyContacts(clientCompanyId)
    return {
      contacts: contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        jobTitle: contact.jobTitle ?? null,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      contacts: [],
      error:
        error instanceof LeadEngineError
          ? error.message
          : "Daftar kontak tidak tersedia saat ini.",
    }
  }
}
