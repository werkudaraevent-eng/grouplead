import { describe, expect, it } from "vitest"
import { calendarFacetValues, calendarHref, filterCalendarMissions, groupDayMissions, parseCalendarGroup, parseCalendarSales, parseCalendarValues, parseCalendarView, toggleMe } from "./calendar-filter"
import type { MissionListItem } from "./mission-schema"

const A = "2d5d1f98-53a5-4e76-827d-85a1cdb55fce"
const B = "9cc31e48-2f69-473e-bbaa-cbb16d2ed628"

describe("parseCalendarSales", () => {
  it("keeps ids and me, once each, and drops anything else", () => {
    expect(parseCalendarSales(`me,${A},${A},nonsense,${B}`)).toEqual(["me", A, B])
    expect(parseCalendarSales(undefined)).toEqual([])
    expect(parseCalendarSales(["me", A])).toEqual(["me", A])
  })
})

describe("calendarHref", () => {
  it("writes month, then day, then the filter, and nothing empty", () => {
    expect(calendarHref({ month: "2026-09", sales: [] })).toBe("/workspace/calendar?month=2026-09")
    expect(calendarHref({ month: "2026-09", day: "2026-09-21", sales: ["me", A] })).toBe(`/workspace/calendar?month=2026-09&day=2026-09-21&sales=me%2C${A}`)
  })

  it("round-trips through the parser", () => {
    const href = calendarHref({ month: "2026-09", sales: ["me", A] })
    const params = new URLSearchParams(href.split("?")[1])
    expect(parseCalendarSales(params.get("sales") ?? undefined)).toEqual(["me", A])
  })

  it("writes where, what kind and the grouping, one value per parameter, and reads them back", () => {
    const href = calendarHref({ month: "2026-09", sales: [], location: ["Jakarta Pusat", "Bogor, Kota"], type: ["Meeting"], group: "location" })
    expect(href).toBe("/workspace/calendar?month=2026-09&location=Jakarta+Pusat&location=Bogor%2C+Kota&type=Meeting&group=location")
    const params = new URLSearchParams(href.split("?")[1])
    expect(parseCalendarView({ sales: params.get("sales") ?? undefined, location: params.getAll("location"), type: params.getAll("type"), group: params.get("group") ?? undefined })).toEqual({
      sales: [],
      location: ["Jakarta Pusat", "Bogor, Kota"],
      type: ["Meeting"],
      group: "location",
    })
    expect(calendarHref({ month: "2026-09", sales: [], group: "none" })).toBe("/workspace/calendar?month=2026-09")
  })
})

describe("parseCalendarValues and parseCalendarGroup", () => {
  it("trims, dedupes, caps, and refuses an unknown grouping", () => {
    expect(parseCalendarValues([" Jakarta ", "Jakarta", "", "Bogor"])).toEqual(["Jakarta", "Bogor"])
    expect(parseCalendarValues("Solo")).toEqual(["Solo"])
    expect(parseCalendarValues(undefined)).toEqual([])
    expect(parseCalendarValues(Array.from({ length: 30 }, (_, index) => `L${index}`))).toHaveLength(20)
    expect(parseCalendarGroup("sales")).toBe("sales")
    expect(parseCalendarGroup("bogus")).toBe("none")
    expect(parseCalendarGroup(undefined)).toBe("none")
  })
})

const mission = (over: Partial<MissionListItem> & { id: string }): MissionListItem =>
  ({
    clientCompanyName: "PT Contoh",
    clientCompanyId: null,
    missionType: "Meeting",
    status: "SCHEDULED",
    location: "Jakarta Pusat",
    address: null,
    objective: null,
    scheduledStart: "2026-09-21T02:00:00Z",
    scheduledEnd: null,
    primarySalesName: "Ananda",
    supportingSalesNames: [],
    primarySalesId: A,
    assigneeIds: [A],
    allowJoin: true,
    createdBy: A,
    createdByName: null,
    createdAt: "2026-09-01T00:00:00Z",
    reportStatus: "NONE",
    visitOutcome: null,
    appointment: { salutation: null, contactId: null, name: null, jobTitle: null, division: null, phone: null, email: null },
    supportingCount: 0,
    ...over,
  }) as MissionListItem

describe("filterCalendarMissions", () => {
  const rows = [
    mission({ id: "1" }),
    mission({ id: "2", location: "Bogor", missionType: "Follow-up", primarySalesId: B, assigneeIds: [B], primarySalesName: "Bima" }),
    mission({ id: "3", status: "CANCELLED" }),
    mission({ id: "4", location: null }),
  ]

  it("drops what was called off, then narrows by person, place and kind together", () => {
    expect(filterCalendarMissions(rows, { chosen: new Set(), location: [], type: [] }).map((row) => row.id)).toEqual(["1", "2", "4"])
    expect(filterCalendarMissions(rows, { chosen: new Set([B]), location: [], type: [] }).map((row) => row.id)).toEqual(["2"])
    expect(filterCalendarMissions(rows, { chosen: new Set(), location: ["Jakarta Pusat"], type: [] }).map((row) => row.id)).toEqual(["1"])
    expect(filterCalendarMissions(rows, { chosen: new Set(), location: ["Bogor"], type: ["Meeting"] })).toEqual([])
  })

  it("offers the month's own locations and types, plus what the filter names", () => {
    expect(calendarFacetValues(rows, { location: ["Depok"], type: [] })).toEqual({ locations: ["Bogor", "Depok", "Jakarta Pusat"], types: ["Follow-up", "Meeting"] })
  })
})

describe("groupDayMissions", () => {
  const rows = [mission({ id: "1" }), mission({ id: "2", location: "Bogor" }), mission({ id: "3", location: null, primarySalesName: null })]

  it("is one unlabelled section when ungrouped", () => {
    expect(groupDayMissions(rows, "none")).toEqual([{ key: "all", label: null, missions: rows }])
  })

  it("groups by place or by person in name order, the unnamed last, keeping the day's order inside", () => {
    expect(groupDayMissions(rows, "location").map((section) => [section.label, section.missions.map((row) => row.id)])).toEqual([
      ["Bogor", ["2"]],
      ["Jakarta Pusat", ["1"]],
      ["Tanpa lokasi", ["3"]],
    ])
    expect(groupDayMissions(rows, "sales").map((section) => [section.label, section.missions.length])).toEqual([
      ["Ananda", 2],
      ["Belum ditugaskan", 1],
    ])
  })
})

describe("toggleMe", () => {
  it("adds and removes the viewer without touching the rest", () => {
    expect(toggleMe([A])).toEqual(["me", A])
    expect(toggleMe(["me", A])).toEqual([A])
  })
})
