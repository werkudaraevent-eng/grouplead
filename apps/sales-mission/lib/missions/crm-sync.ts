import type { VisitOutcome } from "./visit-report-schema"
import { VISIT_OUTCOME_LABELS } from "./visit-report-schema"

/**
 * What a submitted visit report hands to the CRM.
 *
 * Pure, so the rule "which visits register a company and which do not" can be
 * tested without a database. The action in visit-report-actions does the
 * network calls; this decides what they should say.
 */

export interface VisitForCrm {
  outcome: VisitOutcome
  contacts: Array<{ fullName: string; jobTitle?: string; phone?: string; email?: string }>
}

/**
 * A visit where nobody was met teaches the CRM nothing it can act on: there is
 * no person to register and "we went and they were out" is not an account
 * relationship. Registering the company from such a visit would fill the CRM
 * with names from cancelled trips. Those visits stay in Sales Mission's own
 * history and reach the CRM the first time someone is actually met.
 */
export function visitReachesCrm(outcome: VisitOutcome): boolean {
  return outcome === "MET_DECISION_MAKER" || outcome === "MET_STAFF" || outcome === "RESCHEDULED_ON_SITE"
}

/** Contacts worth a CRM row: a name is required, everything else is a bonus. */
export function contactsForCrm(contacts: VisitForCrm["contacts"]): VisitForCrm["contacts"] {
  const seen = new Set<string>()
  const result: VisitForCrm["contacts"] = []
  for (const contact of contacts) {
    const name = contact.fullName.trim()
    if (!name) continue
    // Two rows for the same name on one report are a typing slip, not two
    // people. Keep the first; the second usually has less filled in.
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...contact, fullName: name })
  }
  return result
}

/** One line for the CRM timeline, in the CRM's language. */
export function describeOutcome(outcome: VisitOutcome): string {
  return VISIT_OUTCOME_LABELS[outcome]
}
