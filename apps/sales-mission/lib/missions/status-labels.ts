import type { MissionStatus, AssignmentResponse } from "./mission-schema"
import type { ReportStatus } from "./visit-report-schema"

/**
 * Human labels for every status the UI renders.
 *
 * Badges used to print the raw column value with underscores swapped for
 * spaces, so field sales — and anyone walking past the TV board — read
 * "RESCHEDULE REQUESTED" and "NEEDS CLARIFICATION" in English while the rest of
 * the screen is Indonesian.
 *
 * The three enums are merged into one map because their overlapping keys mean
 * the same thing in each: an ACCEPTED mission and an ACCEPTED assignment are
 * both "Diterima". A split map would invite them to drift apart.
 */

export type LabelledStatus = MissionStatus | AssignmentResponse | ReportStatus

export const STATUS_LABELS: Record<LabelledStatus, string> = {
  // Mission lifecycle
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  ASSIGNED: "Ditugaskan",
  ACCEPTED: "Diterima",
  IN_PROGRESS: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  RESCHEDULE_REQUESTED: "Minta jadwal ulang",
  REJECTED: "Ditolak",
  // Assignment response
  PENDING: "Menunggu jawaban",
  // Visit report
  SUBMITTED: "Terkirim",
  NEEDS_CLARIFICATION: "Perlu klarifikasi",
}

/**
 * Label for a status, falling back to a readable form of the raw value.
 *
 * The fallback exists because a status added to the database before it is added
 * here should degrade to "STATUS BARU", not crash a badge.
 */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as LabelledStatus] ?? status.replaceAll("_", " ")
}
