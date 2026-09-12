/**
 * Merging a newly picked CRM contact into what the form already holds.
 *
 * Three states have to be told apart per field, and the first version of this
 * told apart only two. It used `current || incoming`, which protects a rep's
 * manual correction but treats the *previous contact's* CRM data as if it were
 * one: switching from A to B left B's name above A's job title, phone and
 * email, with no sign anything was stale.
 *
 * Remembering what the CRM supplied last time is what separates them. A value
 * still equal to that was never the rep's, so it belongs to the contact being
 * replaced and goes with them. A value that differs was typed or corrected by a
 * person and survives.
 */

export interface CrmSnapshot {
  jobTitle: string | null
  phone: string | null
  email: string | null
}

/**
 * One field's value after a contact change.
 *
 * `incoming` is null when the link is being broken rather than switched, which
 * clears CRM-sourced values for the same reason: they only ever made sense
 * while attached to that contact.
 */
export function mergeContactField(
  current: string,
  previousCrmValue: string | null | undefined,
  incoming: string | null | undefined
): string {
  const editedByHand = current !== "" && current !== (previousCrmValue ?? "")
  return editedByHand ? current : incoming ?? ""
}

export interface ContactFields {
  jobTitle: string
  phone: string
  email: string
}

/** Apply the rule to all three detail fields at once. */
export function mergeContactFields(
  current: ContactFields,
  previousCrm: CrmSnapshot | null,
  incoming: CrmSnapshot | null
): ContactFields {
  return {
    jobTitle: mergeContactField(current.jobTitle, previousCrm?.jobTitle, incoming?.jobTitle),
    phone: mergeContactField(current.phone, previousCrm?.phone, incoming?.phone),
    email: mergeContactField(current.email, previousCrm?.email, incoming?.email),
  }
}
