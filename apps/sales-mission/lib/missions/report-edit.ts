import { MISSION_TIME_ZONE } from "./mission-schema"

/**
 * Who may change a visit report after it was sent.
 *
 * The rule the big CRMs settle on: editing is allowed, silence is not. The
 * author has a window (the admin's setting, in days); an admin has no
 * window. Every accepted edit keeps the outgoing version with a reason, so
 * the record can change and the history cannot.
 */

export interface ReportEditContext {
  isAdmin: boolean
  isPrimary: boolean
  /** When the report was sent. Null means it was never sent, so there is nothing to reopen. */
  submittedAt: string | null
  now: Date
  /** Days the author may still edit. 0 means only an admin. */
  windowDays: number
}

export type ReportEditVerdict =
  | { allowed: true; by: "admin" | "author"; until: Date | null }
  | { allowed: false; reason: "not_sent" | "not_author" | "window_closed" | "admin_only" }

const DAY_MS = 86_400_000

/** The last moment the author may edit, or null when there is no window. */
export function editWindowEndsAt(submittedAt: string | null, windowDays: number): Date | null {
  if (!submittedAt || windowDays <= 0) return null
  return new Date(new Date(submittedAt).getTime() + windowDays * DAY_MS)
}

export function canEditSubmittedReport(context: ReportEditContext): ReportEditVerdict {
  if (!context.submittedAt) return { allowed: false, reason: "not_sent" }
  if (context.isAdmin) return { allowed: true, by: "admin", until: null }
  if (!context.isPrimary) return { allowed: false, reason: "not_author" }
  if (context.windowDays <= 0) return { allowed: false, reason: "admin_only" }
  const until = editWindowEndsAt(context.submittedAt, context.windowDays)
  if (!until || context.now.getTime() > until.getTime()) return { allowed: false, reason: "window_closed" }
  return { allowed: true, by: "author", until }
}

/** One sentence for the report card, saying what the viewer can do and until when. */
export function describeEditWindow(verdict: ReportEditVerdict, windowDays: number): string | null {
  const stamp = (date: Date) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(date)
  if (verdict.allowed) {
    if (verdict.by === "admin") return null
    return verdict.until ? `Bisa diubah sendiri sampai ${stamp(verdict.until)}. Setiap perubahan tercatat.` : null
  }
  switch (verdict.reason) {
    case "window_closed":
      return `Jendela ubah ${windowDays} hari sudah lewat. Minta admin membuka laporan ini.`
    case "admin_only":
      return "Laporan yang sudah dikirim hanya bisa diubah admin."
    default:
      return null
  }
}
