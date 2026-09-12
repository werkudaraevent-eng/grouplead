import { describe, expect, it } from "vitest"
import {
  countMissionFilters,
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
    allowJoin: true,
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
