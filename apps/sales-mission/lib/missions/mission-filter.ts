import { canRespond } from "./assignment-workflow"
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

/** Unknown or absent values fall back to the full list rather than an empty one. */
export function resolveMissionFilter(value: string | undefined | null): MissionFilter {
  return MISSION_FILTERS.includes(value as MissionFilter) ? (value as MissionFilter) : "all"
}

/**
 * Does this viewer still owe an answer?
 *
 * Gated on `canRespond` so a finished or cancelled visit stops nagging: the
 * assignment row keeps its PENDING response forever once nobody answered, and
 * without this the queue would fill with visits that already happened.
 */
export function needsMyAnswer(mission: MissionListItem): boolean {
  return mission.viewerResponse === "PENDING" && canRespond(mission.status)
}

/** Is anyone on this mission still holding it up? Same terminal-status rule. */
export function isAwaitingTeam(mission: MissionListItem): boolean {
  return mission.pendingResponses > 0 && canRespond(mission.status)
}

export function filterMissions<T extends MissionListItem>(missions: T[], filter: MissionFilter): T[] {
  if (filter === "mine") return missions.filter(needsMyAnswer)
  if (filter === "team") return missions.filter(isAwaitingTeam)
  return missions
}

/** Counts for the chips, so a lens with nothing behind it can be dimmed. */
export function countMissionFilters(missions: MissionListItem[]): Record<MissionFilter, number> {
  return {
    all: missions.length,
    mine: missions.filter(needsMyAnswer).length,
    team: missions.filter(isAwaitingTeam).length,
  }
}
