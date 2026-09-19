import type { VisitOutcome } from "./visit-report-schema"
import { normalizeDisc, type DiscLetter } from "@/lib/contacts/disc"
import type { DiscForCrm } from "@/lib/leadengine/client"
import { labelOf, outcomeReachesCrm, type ChoiceSet } from "./report-choices"

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
export function visitReachesCrm(outcome: VisitOutcome, choices?: ChoiceSet | null): boolean {
  return outcomeReachesCrm(outcome, choices)
}

/** Contacts worth a CRM row: a name is required, everything else is a bonus. */
export function contactsForCrm<T extends VisitForCrm["contacts"][number]>(contacts: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
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

/**
 * The DISC reading as the CRM stores it, or null when the rep made none.
 * Signed with the name and the date because a reading is one person's
 * impression on one day, and the CRM shows it as such.
 */
export function discForCrm(contact: {
  discPrimary?: DiscLetter | null
  discSecondary?: DiscLetter | null
  discNote?: string | null
  discAssessedByName?: string | null
  discAssessedAt?: string | null
}): DiscForCrm | null {
  const disc = normalizeDisc(contact.discPrimary, contact.discSecondary)
  if (!disc.primary) return null
  return {
    primary: disc.primary,
    secondary: disc.secondary,
    note: contact.discNote?.trim() || null,
    assessedByName: contact.discAssessedByName ?? null,
    assessedAt: contact.discAssessedAt ?? null,
  }
}

/** One line for the CRM timeline, in the CRM's language. */
export function describeOutcome(outcome: VisitOutcome, choices?: ChoiceSet | null): string {
  return labelOf(choices, "visit_outcome", outcome)
}
