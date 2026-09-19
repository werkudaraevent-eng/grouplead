import type { Channel } from "@/lib/prospects/prospect-schema"

/**
 * The follow-up a person started and has not written down yet.
 *
 * Pressing WhatsApp, Telepon or Email on a prospect leaves the app for the
 * call; when the person comes back, the prompt asks how it went. This is
 * the note passed between those two moments: one at a time, in
 * sessionStorage so a reload on the way back does not lose it, and stale
 * after half an hour so a call nobody finished logging does not ambush the
 * next day.
 */
export interface PendingFollowUp {
  prospectId: string
  /** "Company · Contact", for the prompt's subtitle. */
  label: string
  /** The prospect's status when the call started, so the outcome can suggest the next one. */
  statusId: string
  channel: Channel
  at: number
}

const KEY = "sales-activity.pending-follow-up"
const TTL_MS = 30 * 60_000

/** Fired on `window` when a follow-up is remembered, for a prompt already on the page. */
export const PENDING_FOLLOW_UP_EVENT = "sales-activity:pending-follow-up"

export function rememberPendingFollowUp(pending: Omit<PendingFollowUp, "at">): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...pending, at: Date.now() } satisfies PendingFollowUp))
    window.dispatchEvent(new Event(PENDING_FOLLOW_UP_EVENT))
  } catch {
    // Private mode or storage off: the person logs from the button instead.
  }
}

export function readPendingFollowUp(now = Date.now()): PendingFollowUp | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as PendingFollowUp
    if (!pending?.prospectId || now - pending.at > TTL_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return pending
  } catch {
    return null
  }
}

export function clearPendingFollowUp(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
