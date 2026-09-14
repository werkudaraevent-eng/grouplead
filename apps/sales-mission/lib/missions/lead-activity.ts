import { MISSION_TIME_ZONE, type MissionListItem } from "./mission-schema"
import type { VisitReportRecord } from "./mission-queries"
import { INTEREST_LEVEL_LABELS, NEXT_ACTION_LABELS, VISIT_OUTCOME_LABELS } from "./visit-report-schema"

/**
 * What a pushed lead's timeline should say about the visit that produced it.
 *
 * LeadEngine's timeline is a list of typed activities; its "Meetings" filter
 * matches an action_type containing "meeting", its "Deal Created" category
 * one containing "create". So a push writes two entries: the visit itself,
 * dated when it happened, and the hand-off, dated now. The reader on the
 * CRM side then sees who was met, what was heard and what was promised
 * without opening Sales Mission.
 */
export interface LeadActivityDraft {
  type: "Meeting" | "lead_created"
  description: string
  /** ISO instant the activity happened; null means "when the push is recorded". */
  occurredAt: string | null
}

export function visitActivities(
  mission: Pick<MissionListItem, "clientCompanyName" | "scheduledStart" | "location" | "missionType">,
  report: Pick<VisitReportRecord, "visitOutcome" | "meetingSummary" | "clientNeeds" | "interestLevel" | "nextActionType" | "followUpDate" | "contacts">,
  pushedBy: string
): LeadActivityDraft[] {
  const when = mission.scheduledStart
    ? new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(mission.scheduledStart))
    : null

  const met = report.contacts
    .map((contact) => (contact.jobTitle ? `${contact.fullName} (${contact.jobTitle})` : contact.fullName))
    .filter(Boolean)

  const lines: string[] = []
  lines.push([mission.missionType, mission.clientCompanyName, mission.location, when].filter(Boolean).join(" · "))
  if (report.visitOutcome) lines.push(`Hasil: ${VISIT_OUTCOME_LABELS[report.visitOutcome]}`)
  if (met.length) lines.push(`Bertemu: ${met.join(", ")}`)
  if (report.interestLevel) lines.push(`Tingkat minat: ${INTEREST_LEVEL_LABELS[report.interestLevel]}`)
  if (report.clientNeeds.length) lines.push(`Kebutuhan: ${report.clientNeeds.join(", ")}`)
  if (report.nextActionType && report.nextActionType !== "NONE") {
    lines.push(`Next action: ${NEXT_ACTION_LABELS[report.nextActionType]}${report.followUpDate ? ` (${report.followUpDate})` : ""}`)
  }
  if (report.meetingSummary.trim()) lines.push("", report.meetingSummary.trim())

  return [
    { type: "Meeting", description: lines.join("\n").slice(0, 4000), occurredAt: mission.scheduledStart ?? null },
    {
      type: "lead_created",
      description: `Lead dibuat dari laporan kunjungan Sales Mission oleh ${pushedBy}.`,
      occurredAt: null,
    },
  ]
}
