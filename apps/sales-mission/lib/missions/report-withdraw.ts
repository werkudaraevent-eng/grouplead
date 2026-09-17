import type { MissionStatus } from "./mission-schema"

/**
 * Where a mission goes back to when its report is withdrawn.
 *
 * Sending a report moved the mission to COMPLETED and wrote that move to
 * the status history. Withdrawing undoes exactly that move: the mission
 * returns to whatever it was before, read from the latest COMPLETED row.
 * A mission with no such row (data older than the history) goes back to
 * ACCEPTED, the state a visit is in once its rep has agreed to make it.
 */
export function statusBeforeCompletion(
  history: ReadonlyArray<{ fromStatus: string | null; toStatus: string; createdAt: string }>
): MissionStatus {
  const completed = [...history]
    .filter((row) => row.toStatus === "COMPLETED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const previous = completed?.fromStatus
  if (previous && previous !== "COMPLETED" && previous !== "CANCELLED" && previous !== "REJECTED") return previous as MissionStatus
  return "ACCEPTED"
}
