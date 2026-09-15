import { describe, expect, it } from "vitest"
import {
  buildMonthGrid,
  currentMissionMonth,
  formatMonthLabel,
  missionsOnDay,
  monthWindow,
  resolveMonth,
  shiftMonth,
} from "./mission-calendar"
import type { MissionListItem } from "./mission-schema"

function mission(id: string, scheduledStart: string | null): MissionListItem {
  return {
    id,
    clientCompanyName: `Client ${id}`,
    clientCompanyId: null,
    missionType: "Meeting",
    status: "ASSIGNED",
    location: null,
    address: null,
    objective: null,
    scheduledStart,
    scheduledEnd: null,
    primarySalesName: null,
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
  }
}

// 2026-08-22T10:00 WIB
const NOW = new Date("2026-08-22T03:00:00.000Z")

describe("resolveMonth", () => {
  it("falls back to the current mission month when absent or malformed", () => {
    expect(resolveMonth(undefined, NOW)).toBe("2026-08")
    expect(resolveMonth("garbage", NOW)).toBe("2026-08")
    expect(resolveMonth("2026-8", NOW)).toBe("2026-08")
  })

  it("rejects an out-of-range month rather than rendering an empty grid", () => {
    expect(resolveMonth("2026-13", NOW)).toBe("2026-08")
    expect(resolveMonth("2026-00", NOW)).toBe("2026-08")
  })

  it("accepts a well-formed month", () => {
    expect(resolveMonth("2027-02", NOW)).toBe("2027-02")
  })
})

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09")
    expect(shiftMonth("2026-08", -1)).toBe("2026-07")
  })

  it("rolls over year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })
})

describe("currentMissionMonth", () => {
  it("uses the Jakarta day, not the UTC one", () => {
    // 2026-09-01T00:30 WIB is still 2026-08-31 in UTC.
    expect(currentMissionMonth(new Date("2026-08-31T17:30:00.000Z"))).toBe("2026-09")
  })
})

describe("monthWindow", () => {
  it("covers the whole month in mission time, with a week either side", () => {
    const { since, until } = monthWindow("2026-09")
    expect(since.toISOString()).toBe("2026-08-24T17:00:00.000Z")
    expect(until.toISOString()).toBe("2026-10-07T17:00:00.000Z")
    // The bug this guards: a visit on the 21st must be inside the window.
    const visit = new Date("2026-09-21T02:00:00.000Z")
    expect(visit >= since && visit <= until).toBe(true)
  })

  it("handles the year boundary", () => {
    const { until } = monthWindow("2026-12")
    expect(until.toISOString()).toBe("2027-01-07T17:00:00.000Z")
  })
})

describe("buildMonthGrid", () => {
  it("hands each day its missions, earliest first, on the mission-time day", () => {
    const grid = buildMonthGrid(
      "2026-08",
      [
        { scheduledStart: "2026-08-29T07:00:00.000Z", name: "Zenith" }, // 14:00 WIB
        { scheduledStart: "2026-08-29T02:30:00.000Z", name: "ZINIT" }, // 09:30 WIB
        { scheduledStart: "2026-08-28T17:30:00.000Z", name: "Late" }, // 00:30 WIB on the 29th
        { scheduledStart: null, name: "Unscheduled" },
      ],
      NOW
    )
    const day = grid.days.find((d) => d.date === "2026-08-29")!
    expect(day.missionCount).toBe(3)
    expect(day.missions.map((m) => m.name)).toEqual(["Late", "ZINIT", "Zenith"])
    expect(grid.days.find((d) => d.date === "2026-08-28")!.missions).toEqual([])
  })

  it("offsets the first day to a Monday-first grid", () => {
    // 2026-08-01 is a Saturday → five blanks before it.
    expect(buildMonthGrid("2026-08", [], NOW).leadingBlanks).toBe(5)
    // 2026-06-01 is a Monday → no blanks.
    expect(buildMonthGrid("2026-06", [], NOW).leadingBlanks).toBe(0)
  })

  it("produces the right number of days, including leap February", () => {
    expect(buildMonthGrid("2026-08", [], NOW).days).toHaveLength(31)
    expect(buildMonthGrid("2026-09", [], NOW).days).toHaveLength(30)
    expect(buildMonthGrid("2026-02", [], NOW).days).toHaveLength(28)
    expect(buildMonthGrid("2028-02", [], NOW).days).toHaveLength(29)
  })

  it("counts missions onto their Jakarta day", () => {
    const grid = buildMonthGrid("2026-08", [mission("a", "2026-08-25T02:30:00.000Z")], NOW)
    expect(grid.days.find((day) => day.dayOfMonth === 25)?.missionCount).toBe(1)
  })

  it("places a late-evening WIB mission on that day, not the UTC next day", () => {
    // 2026-08-25T23:30 WIB === 2026-08-25T16:30Z. Naive UTC would say the 25th
    // too, so use a case where UTC actually rolls over: 2026-08-25T07:30 WIB is
    // 2026-08-25T00:30Z. Use 00:30 WIB instead, which is 2026-08-24T17:30Z.
    const grid = buildMonthGrid("2026-08", [mission("a", "2026-08-24T17:30:00.000Z")], NOW)
    expect(grid.days.find((day) => day.dayOfMonth === 25)?.missionCount).toBe(1)
    expect(grid.days.find((day) => day.dayOfMonth === 24)?.missionCount).toBe(0)
  })

  it("tallies multiple missions on one day", () => {
    const grid = buildMonthGrid(
      "2026-08",
      [mission("a", "2026-08-25T02:30:00.000Z"), mission("b", "2026-08-25T06:00:00.000Z")],
      NOW
    )
    expect(grid.days.find((day) => day.dayOfMonth === 25)?.missionCount).toBe(2)
  })

  it("ignores unscheduled and unparseable missions", () => {
    const grid = buildMonthGrid("2026-08", [mission("a", null), mission("b", "not-a-date")], NOW)
    expect(grid.days.every((day) => day.missionCount === 0)).toBe(true)
  })

  it("marks today only in the month that contains it", () => {
    expect(buildMonthGrid("2026-08", [], NOW).days.filter((day) => day.isToday)).toHaveLength(1)
    expect(buildMonthGrid("2026-09", [], NOW).days.some((day) => day.isToday)).toBe(false)
  })
})

describe("missionsOnDay", () => {
  it("returns that day's missions in time order", () => {
    const missions = [
      mission("late", "2026-08-25T06:00:00.000Z"),
      mission("early", "2026-08-25T02:30:00.000Z"),
      mission("other-day", "2026-08-26T02:30:00.000Z"),
    ]
    expect(missionsOnDay(missions, "2026-08-25").map((item) => item.id)).toEqual(["early", "late"])
  })

  it("returns nothing for a day with no missions", () => {
    expect(missionsOnDay([mission("a", "2026-08-25T02:30:00.000Z")], "2026-08-26")).toEqual([])
  })
})

describe("formatMonthLabel", () => {
  it("renders an Indonesian month and year", () => {
    expect(formatMonthLabel("2026-08")).toContain("2026")
    expect(formatMonthLabel("2026-08").toLowerCase()).toContain("agustus")
  })
})
