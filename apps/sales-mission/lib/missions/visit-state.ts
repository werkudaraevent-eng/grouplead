import type { MissionListItem } from "./mission-schema"

/**
 * Where a visit stands, as one word.
 *
 * The mission's status says where it is in its lifecycle; the report says
 * whether what happened was written down. Reading both at once is the
 * question a manager scans the list for ("which visits have no report?"),
 * so it is answered once here and shown the same way everywhere.
 *
 *   upcoming      the visit is still ahead
 *   needs_report  the slot has passed and nothing has been written
 *   draft         a report was started and not sent
 *   reported      the report is in; the mission is complete
 *   cancelled     the visit was called off or refused
 *   unscheduled   no time on it yet
 */
export type VisitState = "upcoming" | "needs_report" | "draft" | "reported" | "cancelled" | "unscheduled"

export const VISIT_STATE_LABELS: Record<VisitState, string> = {
  upcoming: "Mendatang",
  needs_report: "Belum ada laporan",
  draft: "Laporan draf",
  reported: "Selesai",
  cancelled: "Dibatalkan",
  unscheduled: "Belum dijadwalkan",
}

const ASSUMED_DURATION_MS = 60 * 60 * 1000

export function visitState(
  mission: Pick<MissionListItem, "status" | "reportStatus" | "scheduledStart" | "scheduledEnd">,
  now: Date
): VisitState {
  if (mission.status === "CANCELLED" || mission.status === "REJECTED") return "cancelled"
  if (mission.status === "COMPLETED" || mission.reportStatus === "SUBMITTED") return "reported"
  if (mission.reportStatus === "DRAFT" || mission.reportStatus === "NEEDS_CLARIFICATION") return "draft"
  if (!mission.scheduledStart) return "unscheduled"
  const start = new Date(mission.scheduledStart).getTime()
  if (Number.isNaN(start)) return "unscheduled"
  const end = mission.scheduledEnd ? new Date(mission.scheduledEnd).getTime() : start + ASSUMED_DURATION_MS
  return end <= now.getTime() ? "needs_report" : "upcoming"
}

/** Whether the state is one a report would resolve. */
export function reportOwed(state: VisitState): boolean {
  return state === "needs_report" || state === "draft"
}
