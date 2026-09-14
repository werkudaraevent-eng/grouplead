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

/*
  ─── Filter panel ───────────────────────────────────────────────────────────

  The lenses above answer one question ("who owes an answer"). The query below
  is the general filter every list tool has settled on, from Linear to HubSpot:
  a text search, a handful of facets, a date range, all carried in the URL so a
  filtered view can be bookmarked or sent to a colleague, and shown back as
  removable chips so what is narrowing the list is never hidden.
*/

export const DATE_PRESETS = ["today", "week", "month", "upcoming", "past", "custom"] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Hari ini",
  week: "Minggu ini",
  month: "Bulan ini",
  upcoming: "Mendatang",
  past: "Sudah lewat",
  custom: "Rentang tanggal",
}

export interface MissionQuery {
  /** Matches company, location, objective, mission type, and contact name. */
  q: string
  status: string[]
  type: string[]
  /** User ids; matches primary or supporting. */
  sales: string[]
  /** User ids of whoever scheduled the mission. */
  creator: string[]
  location: string[]
  date: DatePreset | null
  /** YYYY-MM-DD, mission time. Only read when `date` is "custom". */
  from: string | null
  to: string | null
}

export const EMPTY_QUERY: MissionQuery = {
  q: "",
  status: [],
  type: [],
  sales: [],
  creator: [],
  location: [],
  date: null,
  from: null,
  to: null,
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "")
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))]
}

/** Read the query off `?q=&status=a,b&…`. Unknown values are dropped, never thrown. */
export function parseMissionQuery(params: Record<string, string | string[] | undefined>): MissionQuery {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
  }
  const date = one("date")
  const from = one("from")
  const to = one("to")
  return {
    q: one("q"),
    status: list(params.status),
    type: list(params.type),
    sales: list(params.sales),
    creator: list(params.creator),
    location: list(params.location),
    date: DATE_PRESETS.includes(date as DatePreset) ? (date as DatePreset) : null,
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
  }
}

/** The inverse of parseMissionQuery, for building links. Empty facets are omitted. */
export function serializeMissionQuery(query: MissionQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status.length) params.set("status", query.status.join(","))
  if (query.type.length) params.set("type", query.type.join(","))
  if (query.sales.length) params.set("sales", query.sales.join(","))
  if (query.creator.length) params.set("creator", query.creator.join(","))
  if (query.location.length) params.set("location", query.location.join(","))
  if (query.date) params.set("date", query.date)
  if (query.date === "custom") {
    if (query.from) params.set("from", query.from)
    if (query.to) params.set("to", query.to)
  }
  return params
}

/** How many facets are narrowing the list, for the "Filter (3)" button. */
export function countActiveFacets(query: MissionQuery): number {
  return (
    (query.q ? 1 : 0) +
    (query.status.length ? 1 : 0) +
    (query.type.length ? 1 : 0) +
    (query.sales.length ? 1 : 0) +
    (query.creator.length ? 1 : 0) +
    (query.location.length ? 1 : 0) +
    (query.date ? 1 : 0)
  )
}

export function isEmptyQuery(query: MissionQuery): boolean {
  return countActiveFacets(query) === 0
}

/** Day key in mission time, shared with the calendar. */
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso))
}

function shiftDay(day: string, days: number): string {
  const base = new Date(`${day}T00:00:00+07:00`)
  return dayKey(new Date(base.getTime() + days * 86_400_000).toISOString())
}

/** Monday-first week containing `day`. */
function weekBounds(day: string): [string, string] {
  // Weekday of the calendar date itself; the WIB midnight instant is the
  // previous UTC day and would shift the whole week back.
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7 // Mon = 0
  const monday = shiftDay(day, -weekday)
  return [monday, shiftDay(monday, 6)]
}

/** Inclusive [from, to] day range for a preset, or null for "no date facet". */
export function dateRangeFor(query: MissionQuery, now: Date): [string | null, string | null] | null {
  if (!query.date) return null
  const today = dayKey(now.toISOString())
  switch (query.date) {
    case "today":
      return [today, today]
    case "week":
      return weekBounds(today)
    case "month": {
      const first = `${today.slice(0, 7)}-01`
      const nextMonthFirst = `${shiftDay(first, 35).slice(0, 7)}-01`
      return [first, shiftDay(nextMonthFirst, -1)]
    }
    case "upcoming":
      return [today, null]
    case "past":
      return [null, shiftDay(today, -1)]
    case "custom":
      return [query.from, query.to]
  }
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

/**
 * Apply the query. Pure, so the list, the export, and the tests all narrow
 * the same way. Facets AND together; values inside a facet OR together, which
 * is what every filter panel means by "Status: Diterima, Selesai".
 */
export function applyMissionQuery<T extends MissionListItem>(missions: T[], query: MissionQuery, now: Date): T[] {
  const q = normalise(query.q)
  const status = new Set(query.status)
  const type = new Set(query.type.map(normalise))
  const sales = new Set(query.sales)
  const creator = new Set(query.creator)
  const location = new Set(query.location.map(normalise))
  const range = dateRangeFor(query, now)

  return missions.filter((mission) => {
    if (q) {
      const haystack = [
        mission.clientCompanyName,
        mission.location,
        mission.objective,
        mission.missionType,
        mission.appointment.name,
        mission.primarySalesName,
        ...mission.supportingSalesNames,
      ]
        .map(normalise)
        .join(" ")
      if (!haystack.includes(q)) return false
    }
    if (status.size && !status.has(mission.status)) return false
    if (type.size && !type.has(normalise(mission.missionType))) return false
    if (sales.size && !mission.assigneeIds.some((id) => sales.has(id))) return false
    if (creator.size && !creator.has(mission.createdBy)) return false
    if (location.size && !location.has(normalise(mission.location))) return false
    if (range) {
      if (!mission.scheduledStart) return false
      const day = dayKey(mission.scheduledStart)
      if (range[0] && day < range[0]) return false
      if (range[1] && day > range[1]) return false
    }
    return true
  })
}

/** Distinct values for the facets that come from the data itself. */
export function facetOptions(missions: MissionListItem[]): { types: string[]; locations: string[] } {
  const types = new Set<string>()
  const locations = new Set<string>()
  for (const mission of missions) {
    if (mission.missionType.trim()) types.add(mission.missionType.trim())
    if (mission.location?.trim()) locations.add(mission.location.trim())
  }
  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, "id"))
  return { types: sort(types), locations: sort(locations) }
}
