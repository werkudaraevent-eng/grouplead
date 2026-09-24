import { FOLLOW_UP_STATE_LABELS, followUpState } from "@/lib/missions/follow-ups"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import type { ReportListItem } from "./report-list-queries"

/**
 * Where a report's next action stands, in the words the Laporan list uses:
 * the desk's Tindak lanjut column (the full line, owner and step count
 * included) and the phone card's follow-up chip (the short form, because
 * the card's foot already names the sales utama beside it).
 */

type FollowUpFields = Pick<ReportListItem, "followUp" | "followUpDate" | "nextActionOwnerName" | "status">

const shortDay = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(iso))

/** "Sel, 29 Sep" for a YYYY-MM-DD day in mission time. */
export const followUpDay = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00+07:00`))

/** The whole line: open or late with its day and owner, or how it ended. */
export function followUpLine(report: FollowUpFields, today: string): { text: string; late: boolean } | null {
  // A tracked follow-up speaks for itself.
  if (report.followUp) {
    const item = report.followUp
    const state = followUpState(item, today)
    const label = FOLLOW_UP_STATE_LABELS[state]
    const text =
      state === "done"
        ? `${label}${item.outcomeLabel ? ` · ${item.outcomeLabel.toLowerCase()}` : ""}${item.closedAt ? ` · ${shortDay(item.closedAt)}` : ""}`
        : state === "cancelled"
          ? label
          : `${label}${item.dueDate ? ` · ${followUpDay(item.dueDate)}` : ""}${item.ownerName ? ` · ${item.ownerName}` : ""}`
    return { text: `${text}${item.count > 1 ? ` · ${item.count} langkah` : ""}`, late: state === "late" }
  }
  if (!report.followUpDate) return null
  const late = report.followUpDate < today && report.status !== "DRAFT"
  return { text: `${late ? "Lewat" : "Follow-up"} ${followUpDay(report.followUpDate)}${report.nextActionOwnerName ? ` · ${report.nextActionOwnerName}` : ""}`, late }
}

export type FollowUpChipTone = "open" | "late" | "closed"

/**
 * The phone card's chip: "Follow-up Sel, 29 Sep" while open, "Lewat Sel,
 * 29 Sep" in the warning tone once its day has passed (the word says it,
 * not only the colour), "Selesai 30 Sep" or "Dibatalkan" muted once it is
 * closed. No owner: the card's foot shows the sales utama right beside it,
 * and the whole line stays in `title`.
 */
export function followUpChip(report: FollowUpFields, today: string): { text: string; tone: FollowUpChipTone; title: string } | null {
  const line = followUpLine(report, today)
  if (!line) return null
  if (report.followUp) {
    const item = report.followUp
    const state = followUpState(item, today)
    const day = item.dueDate ? ` ${followUpDay(item.dueDate)}` : ""
    switch (state) {
      case "done":
        return { text: `${FOLLOW_UP_STATE_LABELS.done}${item.closedAt ? ` ${shortDay(item.closedAt)}` : ""}`, tone: "closed", title: line.text }
      case "cancelled":
        return { text: FOLLOW_UP_STATE_LABELS.cancelled, tone: "closed", title: line.text }
      case "late":
        return { text: `${FOLLOW_UP_STATE_LABELS.late}${day}`, tone: "late", title: line.text }
      case "open":
        return { text: item.dueDate ? `Follow-up${day}` : "Follow-up terbuka", tone: "open", title: line.text }
    }
  }
  const day = followUpDay(report.followUpDate!)
  return line.late ? { text: `Lewat ${day}`, tone: "late", title: line.text } : { text: `Follow-up ${day}`, tone: "open", title: line.text }
}
