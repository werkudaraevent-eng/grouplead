import { z } from "zod"

/**
 * A follow-up: the report's next action as a task that lives.
 *
 * Created from the report (type, owner, due date), owned by someone, closed
 * with how it went, and chained: closing one may open the next. The CRM
 * pattern (a task on the record, a timeline, "log and schedule next"), not
 * a page of its own. Pure types and rules here; the queries and actions
 * import them.
 */
export type FollowUpStatus = "OPEN" | "DONE" | "CANCELLED"

export interface FollowUp {
  id: string
  missionId: string
  reportId: string | null
  parentId: string | null
  /** A next_action_type code and its label. */
  actionType: string
  actionLabel: string
  ownerId: string | null
  ownerName: string | null
  /** YYYY-MM-DD, or null when no day was set. */
  dueDate: string | null
  status: FollowUpStatus
  channel: string | null
  channelLabel: string | null
  outcome: string | null
  outcomeLabel: string | null
  outcomeKind: string | null
  note: string | null
  closedAt: string | null
  closedByName: string | null
  createdAt: string
  createdByName: string | null
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CODE = z.string().trim().min(1).max(60)

/** What a new follow-up needs: the type; owner and day may be decided later. */
export const newFollowUpSchema = z.object({
  actionType: CODE,
  ownerId: z.string().uuid().nullish(),
  dueDate: z.string().regex(DATE_PATTERN, "Tanggal tidak valid").nullish(),
})
export type NewFollowUpInput = z.infer<typeof newFollowUpSchema>

/** Closing a follow-up: how it was done, how it went, and optionally what comes next. */
export const logFollowUpSchema = z.object({
  channel: CODE,
  outcome: CODE,
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  doneAt: z.string().datetime({ offset: true }).optional(),
  next: newFollowUpSchema.nullish(),
})
export type LogFollowUpInput = z.infer<typeof logFollowUpSchema>

/** The one-word state a list shows: open, late, done, or called off. */
export function followUpState(item: Pick<FollowUp, "status" | "dueDate">, today: string): "open" | "late" | "done" | "cancelled" {
  if (item.status === "DONE") return "done"
  if (item.status === "CANCELLED") return "cancelled"
  return item.dueDate && item.dueDate < today ? "late" : "open"
}

export const FOLLOW_UP_STATE_LABELS: Record<ReturnType<typeof followUpState>, string> = {
  open: "Terbuka",
  late: "Lewat",
  done: "Selesai",
  cancelled: "Dibatalkan",
}

/**
 * Order for a timeline: oldest first, so the chain reads top to bottom, and
 * an open one last among equals.
 */
export function sortFollowUps<T extends Pick<FollowUp, "createdAt" | "status">>(items: T[]): T[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** The row a list should speak for: the open one if any, else the latest closed. */
export function currentFollowUp<T extends Pick<FollowUp, "createdAt" | "status">>(items: T[]): T | null {
  const sorted = sortFollowUps(items)
  return sorted.find((item) => item.status === "OPEN") ?? sorted[sorted.length - 1] ?? null
}
