import { z } from "zod"
import type { AssignmentResponse, MissionStatus } from "./mission-schema"

/**
 * Assignment responses and mission status.
 *
 * The mission's status is derived from its assignments rather than set by hand,
 * so a mission can never claim to be accepted while the primary has not
 * answered. Pure and tested here; the server action applies the result.
 */

export const RESPONSE_LABELS: Record<AssignmentResponse, string> = {
  PENDING: "Menunggu jawaban",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
  RESCHEDULE_REQUESTED: "Minta jadwal ulang",
}

/** Statuses that are the end of the line — nothing derived may move them. */
const TERMINAL_STATUSES: MissionStatus[] = ["COMPLETED", "CANCELLED"]

export interface AssignmentState {
  role: "PRIMARY" | "SUPPORTING"
  response: AssignmentResponse
}

/**
 * Mission status implied by the current assignment responses.
 *
 * The rules, in the order they are applied:
 *  - A finished or cancelled mission is left alone. A late response must not
 *    resurrect it.
 *  - An open reschedule request outranks everything else: the schedule itself
 *    is in question, so acceptance of the old time means nothing.
 *  - Only the primary's answer moves the mission. Supporting sales may decline
 *    without blocking the visit — that is the whole point of the role split.
 *  - With no primary assigned the mission is merely scheduled, not assigned.
 */
export function deriveMissionStatus(
  current: MissionStatus,
  assignments: AssignmentState[]
): MissionStatus {
  if (TERMINAL_STATUSES.includes(current)) return current
  if (current === "IN_PROGRESS") return current

  if (assignments.some((item) => item.response === "RESCHEDULE_REQUESTED")) {
    return "RESCHEDULE_REQUESTED"
  }

  const primary = assignments.find((item) => item.role === "PRIMARY")
  if (!primary) return "SCHEDULED"

  switch (primary.response) {
    case "ACCEPTED":
      return "ACCEPTED"
    case "REJECTED":
      return "REJECTED"
    default:
      return "ASSIGNED"
  }
}

/**
 * May this person still answer their assignment?
 *
 * Answering is closed once the visit is over or cancelled — a report has been
 * written, and changing the answer afterwards would rewrite history.
 */
export function canRespond(missionStatus: MissionStatus): boolean {
  return !TERMINAL_STATUSES.includes(missionStatus) && missionStatus !== "IN_PROGRESS"
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

export const rescheduleRequestSchema = z
  .object({
    date: z.string().regex(DATE_PATTERN, "Tanggal tidak valid"),
    startTime: z.string().regex(TIME_PATTERN, "Jam mulai tidak valid"),
    endTime: z.string().regex(TIME_PATTERN, "Jam selesai tidak valid").optional().or(z.literal("")),
    reason: z.string().trim().min(1, "Alasan wajib diisi").max(1000),
  })
  .superRefine((value, ctx) => {
    if (value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai harus setelah jam mulai" })
    }
  })

export type RescheduleRequestInput = z.infer<typeof rescheduleRequestSchema>

export interface RescheduleDecisionResult {
  /** Responses to write back after a decision. */
  responses: Array<{ userId: string; response: AssignmentResponse }>
  missionStatus: MissionStatus
}

/**
 * What an approval does to the team's answers.
 *
 * Everyone is put back to PENDING, because accepting Tuesday 09:30 is not
 * accepting Thursday 14:00 — the thing they agreed to no longer exists. The
 * requester is the exception: they proposed this exact time, so re-asking them
 * would be pointless friction.
 */
export function applyRescheduleApproval(
  assignments: Array<{ userId: string; role: "PRIMARY" | "SUPPORTING" }>,
  requestedBy: string
): RescheduleDecisionResult {
  const responses = assignments.map((item) => ({
    userId: item.userId,
    response: (item.userId === requestedBy ? "ACCEPTED" : "PENDING") as AssignmentResponse,
  }))

  const missionStatus = deriveMissionStatus(
    "ASSIGNED",
    assignments.map((item) => ({
      role: item.role,
      response: (item.userId === requestedBy ? "ACCEPTED" : "PENDING") as AssignmentResponse,
    }))
  )

  return { responses, missionStatus }
}

/**
 * What a rejection does.
 *
 * The proposed time is discarded and everyone returns to the answer they held
 * before asking — which for the requester means undecided again, since their
 * RESCHEDULE_REQUESTED was never an acceptance.
 */
export function applyRescheduleRejection(
  assignments: Array<{ userId: string; role: "PRIMARY" | "SUPPORTING"; response: AssignmentResponse }>
): RescheduleDecisionResult {
  const responses = assignments
    .filter((item) => item.response === "RESCHEDULE_REQUESTED")
    .map((item) => ({ userId: item.userId, response: "PENDING" as AssignmentResponse }))

  const settled = assignments.map((item) => ({
    role: item.role,
    response: (item.response === "RESCHEDULE_REQUESTED" ? "PENDING" : item.response) as AssignmentResponse,
  }))

  return { responses, missionStatus: deriveMissionStatus("ASSIGNED", settled) }
}
