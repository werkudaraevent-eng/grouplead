import { fetchClientCompany, fetchContact, isLeadEngineConfigured } from "./client"
import { NO_LIVE_CRM, settleWithin, type LiveCompany, type LiveContact, type LiveCrm } from "./live-values"

/**
 * How long a detail page waits for LeadEngine before showing its own copy.
 * Started beside the page's other queries, so on a normal day it costs
 * nothing; on a bad one the page is this much slower, never more.
 */
export const LIVE_CRM_TIMEOUT_MS = 2500

/**
 * The CRM's current company name and appointment contact for a record that
 * links to them, read as the signed-in person (their LeadEngine grants and
 * row security apply).
 *
 * Never throws and never waits past `LIVE_CRM_TIMEOUT_MS`: LeadEngine not
 * configured, unreachable, slow, a record in its Recycle Bin, one this person
 * may not see, or a reply that does not parse all come back as null, and the
 * page shows what it recorded. Nothing here writes to the record.
 */
export async function loadLiveCrm(links: { clientCompanyId: string | null; contactId?: string | null }): Promise<LiveCrm> {
  if (!isLeadEngineConfigured() || (!links.clientCompanyId && !links.contactId)) return NO_LIVE_CRM

  const options = { timeoutMs: LIVE_CRM_TIMEOUT_MS }
  const company: Promise<LiveCompany | null> = links.clientCompanyId
    ? fetchClientCompany(links.clientCompanyId, options).then((record) => ({ name: record.name }))
    : Promise.resolve(null)
  const contact: Promise<LiveContact | null> = links.contactId
    ? fetchContact(links.contactId, options).then((record) => ({
        fullName: record.fullName,
        jobTitle: record.jobTitle ?? null,
        phone: record.phone ?? null,
        email: record.email ?? null,
      }))
    : Promise.resolve(null)

  // The fetch's own timeout covers the request; this covers everything
  // before it (reading the session) as well.
  const [liveCompany, liveContact] = await Promise.all([
    settleWithin(company, LIVE_CRM_TIMEOUT_MS, null),
    settleWithin(contact, LIVE_CRM_TIMEOUT_MS, null),
  ])
  return { company: liveCompany, contact: liveContact }
}
