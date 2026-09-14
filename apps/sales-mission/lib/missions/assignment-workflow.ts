import { z } from "zod"
import type { AssignmentResponse, MissionStatus } from "./mission-schema"
import { STATUS_LABELS } from "./status-labels"

/**
 * Assignment responses and mission status.
 *
 * The mission's status is derived from its assignments rather than set by hand,
 * so a mission can never claim to be accepted while the primary has not
 * answered. Pure and tested here; the server action applies the result.
 */

/**
 * Kept as a narrowed view of the shared map rather than its own copy: an
 * ACCEPTED assignment and an ACCEPTED mission must never read differently.
 */
export const RESPONSE_LABELS: Record<AssignmentResponse, string> = {
  PENDING: STATUS_LABELS.PENDING,
  ACCEPTED: STATUS_LABELS.ACCEPTED,
  REJECTED: STATUS_LABELS.REJECTED,
  RESCHEDULE_REQUESTED: STATUS_LABELS.RESCHEDULE_REQUESTED,
}

/** Statuses that are the end of the line — nothing derived may move them. */
const TERMINAL_STATUSES: MissionStatus[] = ["COMPLETED", "CANCELLED"]

export interface ConfirmationPolicy {
  /** See MissionSettings.requireAssignmentConfirmation. */
  requireAssignmentConfirmation: boolean
}

/**
 * The answer a brand-new assignment starts with.
 *
 * With confirmation off, assigning someone is the acceptance: the person
 * doing the assigning is a manager or the appointment team, and a rep who
 * cannot make it says so through Tolak or Minta jadwal ulang rather than by
 * withholding a click. With it on, the rep is asked.
 */
export function initialResponse(
  policy: ConfirmationPolicy,
  options: { selfAssigned?: boolean } = {}
): AssignmentResponse {
  // Putting yourself on a visit is the acceptance. Asking the scheduler to
  // then confirm their own decision, or offering them Tolak on it, is a
  // question with no sensible answer; a self-scheduled visit that cannot
  // happen is moved or cancelled.
  if (options.selfAssigned) return "ACCEPTED"
  return policy.requireAssignmentConfirmation ? "PENDING" : "ACCEPTED"
}

/** Whether this viewer is being asked for anything at all under this policy. */
export function awaitsConfirmation(response: AssignmentResponse, policy: ConfirmationPolicy): boolean {
  return policy.requireAssignmentConfirmation && response === "PENDING"
}

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

const NO_CONFIRMATION: ConfirmationPolicy = { requireAssignmentConfirmation: false }

/**
 * What an approval does to the team's answers.
 *
 * With confirmation on, everyone is put back to PENDING, because accepting
 * Tuesday 09:30 is not accepting Thursday 14:00 — the thing they agreed to no
 * longer exists. The requester is the exception: they proposed this exact
 * time, so re-asking them would be pointless friction. With confirmation off,
 * nobody is asked to click anything, so everyone lands on ACCEPTED and the
 * new time is theirs to decline the same way as the old one.
 */
export function applyRescheduleApproval(
  assignments: Array<{ userId: string; role: "PRIMARY" | "SUPPORTING" }>,
  requestedBy: string,
  policy: ConfirmationPolicy = NO_CONFIRMATION
): RescheduleDecisionResult {
  const reset = initialResponse(policy)
  const responses = assignments.map((item) => ({
    userId: item.userId,
    response: (item.userId === requestedBy ? "ACCEPTED" : reset) as AssignmentResponse,
  }))

  const missionStatus = deriveMissionStatus(
    "ASSIGNED",
    assignments.map((item) => ({
      role: item.role,
      response: (item.userId === requestedBy ? "ACCEPTED" : reset) as AssignmentResponse,
    }))
  )

  return { responses, missionStatus }
}

/**
 * What a rejection does.
 *
 * The proposed time is discarded and everyone returns to the answer they held
 * before asking — which for the requester means undecided again under
 * confirmation, since their RESCHEDULE_REQUESTED was never an acceptance, or
 * accepted without it, since that is what they held before asking.
 */
export function applyRescheduleRejection(
  assignments: Array<{ userId: string; role: "PRIMARY" | "SUPPORTING"; response: AssignmentResponse }>,
  policy: ConfirmationPolicy = NO_CONFIRMATION
): RescheduleDecisionResult {
  const reset = initialResponse(policy)
  const responses = assignments
    .filter((item) => item.response === "RESCHEDULE_REQUESTED")
    .map((item) => ({ userId: item.userId, response: reset }))

  const settled = assignments.map((item) => ({
    role: item.role,
    response: (item.response === "RESCHEDULE_REQUESTED" ? reset : item.response) as AssignmentResponse,
  }))

  return { responses, missionStatus: deriveMissionStatus("ASSIGNED", settled) }
}
