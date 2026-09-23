import { describe, expect, it } from "vitest"
import {
  dailyActiveSeries,
  daysAgo,
  isWeekendDay,
  lastSeenLabel,
  lastSeenStamp,
  parseUsagePeriod,
  rollupPages,
  rollupPeople,
  shiftDay,
  summarizeUsage,
  unlistedUserIds,
  usageDayLabel,
  usageDayLongLabel,
  usageDayWindow,
  weeklyActiveDays,
  windowStart,
  type UsageDayRow,
  type UsageLastSeen,
  type UsagePageRow,
} from "./usage-stats"

const TODAY = "2026-09-23"

const day = (userId: string, dayKey: string, views = 1, lastSeenAt = `${dayKey}T02:00:00Z`, lastPath: string | null = "/workspace"): UsageDayRow => ({
  userId,
  day: dayKey,
  views,
  lastSeenAt,
  lastPath,
})

describe("day arithmetic", () => {
  it("moves across months and years", () => {
    expect(shiftDay("2026-09-01", -1)).toBe("2026-08-31")
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01")
  })
  it("starts an N-day window N-1 days back, so it includes today", () => {
    expect(windowStart(TODAY, 1)).toBe(TODAY)
    expect(windowStart(TODAY, 7)).toBe("2026-09-17")
    expect(windowStart(TODAY, 30)).toBe("2026-08-25")
  })
  it("counts whole days back", () => {
    expect(daysAgo(TODAY, TODAY)).toBe(0)
    expect(daysAgo("2026-09-22", TODAY)).toBe(1)
    expect(daysAgo("2026-08-24", TODAY)).toBe(30)
  })
})

describe("parseUsagePeriod", () => {
  it("takes the three offered periods and defaults to 30", () => {
    expect(parseUsagePeriod("7")).toBe(7)
    expect(parseUsagePeriod("90")).toBe(90)
    expect(parseUsagePeriod(undefined)).toBe(30)
    expect(parseUsagePeriod("14")).toBe(30)
    expect(parseUsagePeriod("abc")).toBe(30)
  })
})

describe("usageDayWindow", () => {
  it("reads eight weeks for the people table, or the period when it reaches further", () => {
    expect(usageDayWindow(7)).toBe(56)
    expect(usageDayWindow(30)).toBe(56)
    expect(usageDayWindow(90)).toBe(90)
  })
})

describe("summarizeUsage", () => {
  it("counts people, not rows, per window, and sums 30 days of opens", () => {
    const rows = [
      day("a", TODAY, 5),
      day("a", "2026-09-20", 3),
      day("b", "2026-09-17", 2), // the 7-day window's first day
      day("c", "2026-09-16", 4), // one day outside it
      day("d", "2026-08-25", 1), // the 30-day window's first day
      day("e", "2026-08-24", 9), // outside every window
    ]
    expect(summarizeUsage(rows, TODAY)).toEqual({ activeToday: 1, active7: 2, active30: 4, views30: 15 })
  })
  it("is all zeros with no rows", () => {
    expect(summarizeUsage([], TODAY)).toEqual({ activeToday: 0, active7: 0, active30: 0, views30: 0 })
  })
})

describe("weeklyActiveDays", () => {
  it("buckets distinct days into rolling weeks ending today, oldest first", () => {
    const weeks = weeklyActiveDays([TODAY, "2026-09-22", "2026-09-17", "2026-09-16", TODAY], TODAY)
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toBe(3) // 23, 22, 17 (the 23rd counted once)
    expect(weeks[6]).toBe(1) // 16
    expect(weeks.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
  })
  it("ignores days beyond the reach and in the future", () => {
    expect(weeklyActiveDays([shiftDay(TODAY, -56), shiftDay(TODAY, 1)], TODAY)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(weeklyActiveDays([shiftDay(TODAY, -55)], TODAY)[0]).toBe(1)
  })
})

describe("dailyActiveSeries", () => {
  it("has every day of the range, both ends included, oldest first", () => {
    const series = dailyActiveSeries([], windowStart(TODAY, 7), TODAY)
    expect(series.map((entry) => entry.day)).toEqual(["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", TODAY])
    expect(series.every((entry) => entry.active === 0)).toBe(true)
  })

  it("fills 90 days across a month boundary", () => {
    const series = dailyActiveSeries([], windowStart(TODAY, 90), TODAY)
    expect(series).toHaveLength(90)
    expect(series[0].day).toBe("2026-06-26")
    expect(series[89].day).toBe(TODAY)
  })

  it("counts distinct people per day, and a day nobody came is 0, not missing", () => {
    const rows = [
      day("a", TODAY, 5),
      day("b", TODAY, 1),
      day("a", TODAY, 2), // the same person twice is one person
      day("c", "2026-09-21", 0), // a heartbeat alone still means here
    ]
    const series = dailyActiveSeries(rows, "2026-09-21", TODAY)
    expect(series).toEqual([
      { day: "2026-09-21", active: 1, weekend: false },
      { day: "2026-09-22", active: 0, weekend: false },
      { day: TODAY, active: 2, weekend: false },
    ])
  })

  it("flags Saturday and Sunday as weekend", () => {
    const series = dailyActiveSeries([], "2026-09-18", "2026-09-21") // Fri, Sat, Sun, Mon
    expect(series.map((entry) => entry.weekend)).toEqual([false, true, true, false])
    expect(isWeekendDay("2026-09-26")).toBe(true)
    expect(isWeekendDay(TODAY)).toBe(false)
  })

  it("ignores rows outside the range", () => {
    const rows = [day("a", "2026-09-16", 3), day("b", "2026-09-24", 1), day("c", "2026-09-17", 1)]
    const series = dailyActiveSeries(rows, "2026-09-17", TODAY)
    expect(series.reduce((sum, entry) => sum + entry.active, 0)).toBe(1)
    expect(series[0]).toEqual({ day: "2026-09-17", active: 1, weekend: false })
  })

  it("is empty for a range that ends before it starts", () => {
    expect(dailyActiveSeries([day("a", TODAY)], TODAY, "2026-09-22")).toEqual([])
  })

  it("labels a day the way the board does, and with its weekday for the tooltip", () => {
    expect(usageDayLabel("2026-09-22")).toBe("22 Sep")
    expect(usageDayLongLabel("2026-09-21")).toBe("Sen 21 Sep")
    expect(usageDayLongLabel("2026-08-02")).toBe("Min 2 Agu")
  })
})

describe("rollupPeople", () => {
  const people = [
    { id: "a", name: "Ayu", avatarUrl: null },
    { id: "b", name: "Bima", avatarUrl: "https://example.com/b.png" },
    { id: "c", name: "Citra", avatarUrl: null },
    { id: "d", name: "Dewi", avatarUrl: null },
  ]

  it("lists everyone, most recently seen first, the never-seen last by name", () => {
    const rows = [day("a", "2026-09-20", 2, "2026-09-20T03:00:00Z"), day("b", TODAY, 1, `${TODAY}T01:00:00Z`)]
    const result = rollupPeople(people, rows, [], TODAY)
    expect(result.map((person) => person.id)).toEqual(["b", "a", "c", "d"])
    expect(result[2].state).toBe("never")
    expect(result[2].lastSeenAt).toBeNull()
  })

  it("counts days active in 30 days and opens in 7", () => {
    const rows = [day("a", TODAY, 4), day("a", "2026-09-17", 3), day("a", "2026-09-10", 10), day("a", "2026-08-20", 1)]
    const [ayu] = rollupPeople([people[0]], rows, [], TODAY)
    expect(ayu.daysActive30).toBe(3)
    expect(ayu.views7).toBe(7)
    expect(ayu.state).toBe("active")
    expect(ayu.weekly[7]).toBe(2)
  })

  it("marks someone not seen in 7 days as idle, using their last day however old", () => {
    const lastSeen: UsageLastSeen[] = [{ userId: "c", day: "2026-06-01", lastSeenAt: "2026-06-01T05:00:00Z", lastPath: "/workspace/calendar" }]
    const [citra] = rollupPeople([people[2]], [], lastSeen, TODAY)
    expect(citra.state).toBe("idle")
    expect(citra.lastSeenAt).toBe("2026-06-01T05:00:00Z")
    expect(citra.lastPath).toBe("/workspace/calendar")
    expect(citra.daysActive30).toBe(0)
  })

  it("is idle on the eighth day, active on the seventh", () => {
    const [seventh] = rollupPeople([people[0]], [day("a", "2026-09-17")], [], TODAY)
    const [eighth] = rollupPeople([people[0]], [day("a", "2026-09-16")], [], TODAY)
    expect(seventh.state).toBe("active")
    expect(eighth.state).toBe("idle")
  })
})

describe("unlistedUserIds", () => {
  it("names the ids the rows carry that the people list does not", () => {
    const people = [{ id: "a", name: "Ayu", avatarUrl: null }]
    const lastSeen: UsageLastSeen[] = [{ userId: "z", day: TODAY, lastSeenAt: `${TODAY}T01:00:00Z`, lastPath: null }]
    expect(unlistedUserIds(people, lastSeen, [day("a", TODAY), day("y", TODAY), day("z", TODAY)]).sort()).toEqual(["y", "z"])
  })
})

describe("rollupPages", () => {
  const page = (path: string, dayKey: string, views: number): UsagePageRow => ({ path, day: dayKey, views })

  it("sums a path across days, most opened first, with shares of the whole", () => {
    const result = rollupPages(
      [page("/workspace", TODAY, 6), page("/workspace", "2026-09-22", 2), page("/workspace/activities/:id", TODAY, 2), page("/workspace/old", "2026-01-01", 50)],
      windowStart(TODAY, 30),
      TODAY
    )
    expect(result.total).toBe(10)
    expect(result.rows.map((row) => [row.label, row.value, row.share])).toEqual([
      ["Hari ini", 8, 80],
      ["Detail aktivitas", 2, 20],
    ])
  })

  it("folds everything past the top rows into one Lainnya row", () => {
    const rows = Array.from({ length: 5 }, (_, index) => page(`/workspace/p${index}`, TODAY, 10 - index))
    const result = rollupPages(rows, TODAY, TODAY, 3)
    expect(result.all).toHaveLength(5)
    expect(result.rows).toHaveLength(4)
    const other = result.rows[3]
    expect(other.label).toBe("Lainnya (2 halaman)")
    expect(other.value).toBe(13)
    expect(other.folded).toBe(2)
    expect(result.rows.reduce((sum, row) => sum + row.share, 0)).toBe(100)
  })

  it("is empty with nothing opened", () => {
    expect(rollupPages([], TODAY, TODAY)).toEqual({ rows: [], all: [], total: 0 })
  })
})

describe("lastSeenLabel", () => {
  const now = new Date("2026-09-23T05:00:00Z") // 12.00 WIB
  it("speaks in minutes and hours on the same day", () => {
    expect(lastSeenLabel("2026-09-23T04:59:30Z", now)).toBe("Baru saja")
    expect(lastSeenLabel("2026-09-23T04:48:00Z", now)).toBe("12 menit lalu")
    expect(lastSeenLabel("2026-09-23T02:30:00Z", now)).toBe("2 jam lalu")
  })
  it("counts days in WIB", () => {
    // 23.50 WIB on the 22nd is yesterday, even ten minutes before midnight.
    expect(lastSeenLabel("2026-09-22T16:50:00Z", new Date("2026-09-22T17:10:00Z"))).toBe("Kemarin")
    expect(lastSeenLabel("2026-09-20T05:00:00Z", now)).toBe("3 hari lalu")
  })
  it("gives the date for anything a month old", () => {
    expect(lastSeenLabel("2026-06-01T05:00:00Z", now)).toBe("1 Jun 2026")
  })
  it("has an exact stamp for the title", () => {
    expect(lastSeenStamp("2026-09-23T02:41:00Z")).toContain("09.41")
    expect(lastSeenStamp("2026-09-23T02:41:00Z").endsWith("WIB")).toBe(true)
  })
})
