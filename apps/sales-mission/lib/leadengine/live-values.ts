import type { MissionAppointment } from "@/lib/missions/mission-schema"

/**
 * Live CRM values over the copies Sales Activity keeps (DESIGN.md "Live from
 * the CRM, recorded here").
 *
 * An activity and a prospect copy the company's name, and an activity its
 * appointment contact's details, when they are made, and keep the CRM's id
 * beside the copy. Admins correct names and numbers in LeadEngine, so the copy
 * goes stale. Where the link exists, the detail pages show the CRM's current
 * value; the copy stays what it is, the record of what was written at the
 * time, and is named under the live value when the two differ enough to
 * confuse. Pure: the fetching is in `live-crm.ts`.
 */

export interface LiveCompany {
  name: string
}

export interface LiveContact {
  fullName: string
  jobTitle: string | null
  phone: string | null
  email: string | null
}

export interface LiveCrm {
  company: LiveCompany | null
  contact: LiveContact | null
}

export const NO_LIVE_CRM: LiveCrm = { company: null, contact: null }

/** Names a reader would take as the same: case and runs of spaces are not a correction worth a line. */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = (value: string | null | undefined) => (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID")
  return key(a) === key(b)
}

export interface ShownName {
  /** What the page shows: the CRM's current name, else the recorded one. */
  name: string
  /** The recorded name, only when it differs from the one shown. */
  recordedAs: string | null
}

/** The name to show, and the recorded one when the CRM's current name differs from it. */
export function liveName(recorded: string, live: string | null | undefined): ShownName {
  const current = live?.trim()
  const kept = recorded.trim()
  if (!current) return { name: recorded, recordedAs: null }
  return { name: current, recordedAs: kept && !sameName(current, kept) ? kept : null }
}

const filled = (value: string | null | undefined) => value?.trim() || null

/**
 * The appointment contact with the CRM's current details over the copy.
 *
 * The CRM wins where it has a value; where it has none the copy stays, since
 * the appointment team often learns a number or a title the CRM never had
 * (the lead push offers exactly those back to the CRM). Division, building
 * and notes are Sales Activity's own and are never replaced. Without a link,
 * or when the CRM could not be read, the copy is shown as it is.
 */
export function liveAppointment(
  appointment: MissionAppointment,
  live: LiveContact | null
): { appointment: MissionAppointment; recordedName: string | null } {
  if (!live || !appointment.contactId) return { appointment, recordedName: null }
  const name = liveName(appointment.name ?? "", live.fullName)
  return {
    appointment: {
      ...appointment,
      name: filled(name.name),
      jobTitle: filled(live.jobTitle) ?? appointment.jobTitle,
      phone: filled(live.phone) ?? appointment.phone,
      email: filled(live.email) ?? appointment.email,
    },
    recordedName: name.recordedAs,
  }
}

/** When the copy was made, as the quiet line under a live value says it. */
export const RECORDED_WHEN = {
  activity: "Tercatat saat dijadwalkan",
  prospect: "Tercatat saat dibuat",
} as const

export function recordedLine(when: keyof typeof RECORDED_WHEN, recorded: string | null): string | null {
  return recorded ? `${RECORDED_WHEN[when]}: ${recorded}` : null
}

/**
 * The promise's value, or `fallback` once `ms` has passed or if it fails.
 *
 * The CRM is another deployment; a page that waits on it without a limit is
 * as slow as its slowest day. Never rejects.
 */
export function settleWithin<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}
