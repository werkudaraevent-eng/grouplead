import { awaitsConfirmation, canRespond, type ConfirmationPolicy } from "./assignment-workflow"
import type { MissionListItem } from "./mission-schema"

/**
 * Lenses on the mission list.
 *
 * These replace a separate "Penugasan" screen that listed every assignment row
 * in the tenant, pivoted per person. It was the same data as this list with the
 * mission taken out of it, so a rep read two menus to answer one question and
 * neither of them said which missions were waiting on them.
 *
 * The lenses overlap on purpose: a mission waiting on you is also a mission
 * waiting on the team. They are filters, not a partition, and the labels say so.
 */

export const MISSION_FILTERS = ["all", "mine", "team"] as const
export type MissionFilter = (typeof MISSION_FILTERS)[number]

/** Second person throughout, matching every other string on this screen. */
export const MISSION_FILTER_LABELS: Record<MissionFilter, string> = {
  all: "Semua",
  mine: "Perlu jawaban Anda",
  team: "Menunggu jawaban tim",
}

/**
 * The lenses that make sense under the tenant's policy. With confirmation
 * off nobody is ever asked to answer, so the two waiting lenses would only
 * ever show zero and a chip that is always zero is noise.
 */
export function availableMissionFilters(policy: ConfirmationPolicy): readonly MissionFilter[] {
  return policy.requireAssignmentConfirmation ? MISSION_FILTERS : ["all"]
}

/** Unknown or absent values fall back to the full list rather than an empty one. */
export function resolveMissionFilter(value: string | undefined | null): MissionFilter {
  return MISSION_FILTERS.includes(value as MissionFilter) ? (value as MissionFilter) : "all"
}

const ASK: ConfirmationPolicy = { requireAssignmentConfirmation: true }

/**
 * Does this viewer still owe an answer?
 *
 * Gated on `canRespond` so a finished or cancelled visit stops nagging: the
 * assignment row keeps its PENDING response forever once nobody answered, and
 * without this the queue would fill with visits that already happened. Gated
 * on the policy too: with confirmation off a PENDING row left over from
 * before the switch is not a question anyone is being asked.
 */
export function needsMyAnswer(mission: MissionListItem, policy: ConfirmationPolicy = ASK): boolean {
  return (
    awaitsConfirmation(mission.viewerResponse ?? "ACCEPTED", policy) && canRespond(mission.status)
  )
}

/** Is anyone on this mission still holding it up? Same terminal-status rule. */
export function isAwaitingTeam(mission: MissionListItem, policy: ConfirmationPolicy = ASK): boolean {
  return (
    policy.requireAssignmentConfirmation && mission.pendingResponses > 0 && canRespond(mission.status)
  )
}

export function filterMissions<T extends MissionListItem>(
  missions: T[],
  filter: MissionFilter,
  policy: ConfirmationPolicy = ASK
): T[] {
  if (filter === "mine") return missions.filter((mission) => needsMyAnswer(mission, policy))
  if (filter === "team") return missions.filter((mission) => isAwaitingTeam(mission, policy))
  return missions
}

/** Counts for the chips, so a lens with nothing behind it can be dimmed. */
export function countMissionFilters(
  missions: MissionListItem[],
  policy: ConfirmationPolicy = ASK
): Record<MissionFilter, number> {
  return {
    all: missions.length,
    mine: missions.filter((mission) => needsMyAnswer(mission, policy)).length,
    team: missions.filter((mission) => isAwaitingTeam(mission, policy)).length,
  }
}
