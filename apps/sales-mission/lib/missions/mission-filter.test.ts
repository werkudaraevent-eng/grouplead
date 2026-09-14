import { describe, expect, it } from "vitest"
import {
  EMPTY_QUERY,
  applyMissionQuery,
  availableMissionFilters,
  countActiveFacets,
  countMissionFilters,
  dateRangeFor,
  facetOptions,
  isEmptyQuery,
  parseMissionQuery,
  serializeMissionQuery,
  filterMissions,
  isAwaitingTeam,
  needsMyAnswer,
  resolveMissionFilter,
} from "./mission-filter"
import type { MissionListItem, MissionStatus } from "./mission-schema"

function mission(overrides: Partial<MissionListItem> & { id: string }): MissionListItem {
  return {
    clientCompanyName: "PT Arunika Kreasi",
    clientCompanyId: null,
    missionType: "Meeting",
    status: "ASSIGNED" as MissionStatus,
    location: null,
    objective: null,
    scheduledStart: "2026-09-01T02:30:00.000Z",
    scheduledEnd: null,
    primarySalesName: "Wg, Hanung",
    supportingSalesNames: [],
    primarySalesId: null,
    assigneeIds: [],
    allowJoin: true,
    createdBy: "creator",
    createdByName: "Pembuat",
    createdAt: "2026-09-01T01:00:00.000Z",
    reportStatus: "NONE",
    visitOutcome: null,
    appointment: {
      salutation: null,
      contactId: null,
      name: null,
      jobTitle: null,
      division: null,
      phone: null,
      email: null,
      building: null,
      notes: null,
    },
    supportingCount: 0,
    viewerRole: null,
    viewerResponse: null,
    pendingResponses: 0,
    ...overrides,
  }
}

describe("resolveMissionFilter", () => {
  it("falls back to the full list rather than an empty one", () => {
    expect(resolveMissionFilter(undefined)).toBe("all")
    expect(resolveMissionFilter(null)).toBe("all")
    expect(resolveMissionFilter("penugasan")).toBe("all")
    expect(resolveMissionFilter("")).toBe("all")
  })

  it("accepts the known lenses", () => {
    expect(resolveMissionFilter("mine")).toBe("mine")
    expect(resolveMissionFilter("team")).toBe("team")
  })
})

describe("needsMyAnswer", () => {
  it("is true only while the viewer's own response is pending", () => {
    expect(needsMyAnswer(mission({ id: "a", viewerResponse: "PENDING" }))).toBe(true)
    expect(needsMyAnswer(mission({ id: "b", viewerResponse: "ACCEPTED" }))).toBe(false)
    expect(needsMyAnswer(mission({ id: "c", viewerResponse: null }))).toBe(false)
  })

  it("stops asking once the visit is over or cancelled", () => {
    // The assignment row keeps its PENDING response forever when nobody
    // answered, so without the status check a finished visit would sit in the
    // queue permanently.
    expect(needsMyAnswer(mission({ id: "d", viewerResponse: "PENDING", status: "COMPLETED" }))).toBe(false)
    expect(needsMyAnswer(mission({ id: "e", viewerResponse: "PENDING", status: "CANCELLED" }))).toBe(false)
    expect(needsMyAnswer(mission({ id: "f", viewerResponse: "PENDING", status: "IN_PROGRESS" }))).toBe(false)
  })
})

describe("isAwaitingTeam", () => {
  it("counts anyone still holding the mission up", () => {
    expect(isAwaitingTeam(mission({ id: "a", pendingResponses: 2 }))).toBe(true)
    expect(isAwaitingTeam(mission({ id: "b", pendingResponses: 0 }))).toBe(false)
  })

  it("applies the same terminal-status rule", () => {
    expect(isAwaitingTeam(mission({ id: "c", pendingResponses: 1, status: "COMPLETED" }))).toBe(false)
  })
})

describe("filterMissions", () => {
  const missions = [
    mission({ id: "mine", viewerResponse: "PENDING", pendingResponses: 1 }),
    mission({ id: "team", viewerResponse: "ACCEPTED", pendingResponses: 1 }),
    mission({ id: "settled", viewerResponse: "ACCEPTED", pendingResponses: 0 }),
    mission({ id: "done", viewerResponse: "PENDING", pendingResponses: 1, status: "COMPLETED" }),
  ]

  it("returns everything under the default lens", () => {
    expect(filterMissions(missions, "all")).toHaveLength(4)
  })

  it("narrows to the viewer's own outstanding answers", () => {
    expect(filterMissions(missions, "mine").map((item) => item.id)).toEqual(["mine"])
  })

  it("overlaps deliberately: a mission waiting on you also waits on the team", () => {
    expect(filterMissions(missions, "team").map((item) => item.id)).toEqual(["mine", "team"])
  })

  it("counts each lens over the unfiltered list", () => {
    expect(countMissionFilters(missions)).toEqual({ all: 4, mine: 1, team: 2 })
  })
})

describe("with confirmation switched off", () => {
  const off = { requireAssignmentConfirmation: false }
  const on = { requireAssignmentConfirmation: true }
  // A PENDING row can outlive the switch: it was written while confirmation
  // was on. Nobody is being asked any more, so it must not be shown as a
  // question.
  const leftover = mission({ id: "leftover", viewerResponse: "PENDING", pendingResponses: 1 })

  it("asks nobody for anything", () => {
    expect(needsMyAnswer(leftover, off)).toBe(false)
    expect(isAwaitingTeam(leftover, off)).toBe(false)
    expect(needsMyAnswer(leftover, on)).toBe(true)
  })

  it("offers only the full list as a lens", () => {
    expect(availableMissionFilters(off)).toEqual(["all"])
    expect(availableMissionFilters(on)).toEqual(["all", "mine", "team"])
  })

  it("counts zero for the waiting lenses", () => {
    expect(countMissionFilters([leftover], off)).toEqual({ all: 1, mine: 0, team: 0 })
  })
})

describe("mission query", () => {
  const now = new Date("2026-09-16T05:00:00.000Z") // Wed 16 Sep 2026, 12:00 WIB
  const rows = [
    mission({ id: "a", clientCompanyName: "PT Arunika", location: "Jakarta Selatan", missionType: "Meeting", status: "ACCEPTED", scheduledStart: "2026-09-16T02:30:00.000Z", assigneeIds: ["u1"] }),
    mission({ id: "b", clientCompanyName: "Bumi Serpong", location: "Tangerang", missionType: "Survey", status: "COMPLETED", scheduledStart: "2026-09-18T02:30:00.000Z", assigneeIds: ["u2", "u3"] }),
    mission({ id: "c", clientCompanyName: "Cahaya Abadi", location: "Jakarta Selatan", missionType: "Meeting", status: "CANCELLED", scheduledStart: "2026-08-02T02:30:00.000Z", assigneeIds: ["u1", "u2"] }),
    mission({ id: "d", clientCompanyName: "Delta", location: null, missionType: "Visit", status: "ASSIGNED", scheduledStart: "2026-10-01T02:30:00.000Z", assigneeIds: [] }),
  ]
  const ids = (list: MissionListItem[]) => list.map((item) => item.id)

  it("parses the URL and drops what it does not understand", () => {
    const query = parseMissionQuery({ q: " aru ", status: "ACCEPTED,COMPLETED,BOGUS", date: "yesterday", from: "2026-09-01", to: "nope" })
    expect(query.q).toBe("aru")
    expect(query.status).toEqual(["ACCEPTED", "COMPLETED", "BOGUS"])
    expect(query.date).toBeNull()
    expect(query.from).toBe("2026-09-01")
    expect(query.to).toBeNull()
  })

  it("round-trips through the URL", () => {
    const query = { ...EMPTY_QUERY, q: "x", sales: ["u1"], date: "custom" as const, from: "2026-09-01", to: "2026-09-30" }
    const params = serializeMissionQuery(query)
    expect(parseMissionQuery(Object.fromEntries(params))).toEqual(query)
    // from/to are meaningless without a custom range and are not carried.
    expect(serializeMissionQuery({ ...query, date: "today" }).has("from")).toBe(false)
  })

  it("searches across company, location, objective, and people", () => {
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, q: "tangerang" }, now))).toEqual(["b"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, q: "ARUN" }, now))).toEqual(["a"])
  })

  it("ORs inside a facet and ANDs across facets", () => {
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, status: ["ACCEPTED", "CANCELLED"] }, now))).toEqual(["a", "c"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, status: ["ACCEPTED", "CANCELLED"], location: ["Jakarta Selatan"], type: ["meeting"] }, now))).toEqual(["a", "c"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, status: ["CANCELLED"], location: ["Tangerang"] }, now))).toEqual([])
  })

  it("narrows by whether a report is owed, drafted, or in", () => {
    const visits = [
      mission({ id: "owed", scheduledStart: "2026-09-15T02:00:00.000Z", scheduledEnd: "2026-09-15T03:00:00.000Z" }),
      mission({ id: "drafted", reportStatus: "DRAFT" }),
      mission({ id: "done", status: "COMPLETED", reportStatus: "SUBMITTED" }),
      mission({ id: "ahead", scheduledStart: "2026-09-20T02:00:00.000Z" }),
    ]
    expect(ids(applyMissionQuery(visits, { ...EMPTY_QUERY, report: ["needs_report"] }, now))).toEqual(["owed"])
    expect(ids(applyMissionQuery(visits, { ...EMPTY_QUERY, report: ["draft", "reported"] }, now))).toEqual(["drafted", "done"])
    expect(parseMissionQuery({ report: "draft,bogus" }).report).toEqual(["draft"])
  })

  it("narrows to who scheduled the mission", () => {
    const scheduled = [mission({ id: "x", createdBy: "u9" }), mission({ id: "y", createdBy: "u1" })]
    expect(ids(applyMissionQuery(scheduled, { ...EMPTY_QUERY, creator: ["u9"] }, now))).toEqual(["x"])
  })

  it("matches a person whether they lead or support", () => {
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, sales: ["u2"] }, now))).toEqual(["b", "c"])
  })

  it("starts the week on the Monday of the calendar date, not of the UTC instant", () => {
    // Wed 16 Sep 2026 → Mon 14 – Sun 20.
    expect(dateRangeFor({ ...EMPTY_QUERY, date: "week" }, now)).toEqual(["2026-09-14", "2026-09-20"])
  })

  it("resolves date presets in mission time", () => {
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "today" }, now))).toEqual(["a"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "week" }, now))).toEqual(["a", "b"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "month" }, now))).toEqual(["a", "b"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "upcoming" }, now))).toEqual(["a", "b", "d"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "past" }, now))).toEqual(["c"])
    expect(ids(applyMissionQuery(rows, { ...EMPTY_QUERY, date: "custom", from: "2026-09-17", to: null }, now))).toEqual(["b", "d"])
  })

  it("offers the facet values the data actually holds, sorted", () => {
    expect(facetOptions(rows)).toEqual({ types: ["Meeting", "Survey", "Visit"], locations: ["Jakarta Selatan", "Tangerang"] })
  })

  it("counts facets, not values", () => {
    expect(countActiveFacets({ ...EMPTY_QUERY, status: ["A", "B"], q: "x" })).toBe(2)
    expect(isEmptyQuery(EMPTY_QUERY)).toBe(true)
  })
})
