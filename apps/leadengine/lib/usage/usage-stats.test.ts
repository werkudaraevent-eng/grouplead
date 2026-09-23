import { describe, expect, it } from "vitest"
import {
  dailyActiveSeries,
  daysAgo,
  isUsageAdmin,
  isWeekendDay,
  lastSeenLabel,
  lastSeenStamp,
  parseUsagePeriod,
  rollupPages,
  rollupPeople,
  shares,
  shiftDay,
  summarizeUsage,
  unlistedUserIds,
  usageBarSize,
  USAGE_CHART_AXIS_ROOM,
  usageDayKey,
  usageDayLabel,
  usageDayLongLabel,
  usageDayWindow,
  usageSinceLabel,
  weeklyActiveDays,
  windowStart,
  type UsageDayRow,
  type UsageLastSeen,
  type UsagePageRow,
} from "./usage-stats"

const TODAY = "2026-09-23"

const day = (userId: string, dayKey: string, views = 1, lastSeenAt = `${dayKey}T02:00:00Z`, lastPath: string | null = "/"): UsageDayRow => ({
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
  it("keys a moment by its WIB day", () => {
    // 16:59 UTC is 23:59 WIB, still the 22nd; 17:00 UTC is midnight, the 23rd.
    expect(usageDayKey(new Date("2026-09-22T16:59:00Z"))).toBe("2026-09-22")
    expect(usageDayKey(new Date("2026-09-22T17:00:00Z"))).toBe(TODAY)
    expect(usageDayKey(new Date("2026-12-31T18:00:00Z"))).toBe("2027-01-01")
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

describe("isUsageAdmin", () => {
  it("is the same test as fn_user_is_admin()", () => {
    expect(isUsageAdmin("super_admin")).toBe(true)
    expect(isUsageAdmin("admin")).toBe(true)
    expect(isUsageAdmin("Super Admin")).toBe(true)
    expect(isUsageAdmin("ADMIN")).toBe(true)
  })
  it("refuses every other role and no role", () => {
    expect(isUsageAdmin("executive")).toBe(false)
    expect(isUsageAdmin("sales")).toBe(false)
    expect(isUsageAdmin("administrator")).toBe(false)
    expect(isUsageAdmin(null)).toBe(false)
    expect(isUsageAdmin(undefined)).toBe(false)
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

  it("labels a day the same in every runtime, and with its weekday for the tooltip", () => {
    expect(usageDayLabel("2026-09-22")).toBe("22 Sep")
    expect(usageDayLongLabel("2026-09-21")).toBe("Mon 21 Sep")
    expect(usageDayLongLabel("2026-08-02")).toBe("Sun 2 Aug")
    expect(usageSinceLabel("2026-09-23")).toBe("23 September 2026")
  })
})

describe("usageBarSize", () => {
  const slot = (width: number, days: number) => (width - USAGE_CHART_AXIS_ROOM) / days

  it("never draws a bar wider than its day's slot, down to ninety days on a phone", () => {
    for (const width of [200, 260, 296, 320, 360, 420, 768, 1100]) {
      for (const days of [7, 30, 90]) {
        const size = usageBarSize(width, days)
        expect(size).toBeGreaterThanOrEqual(1)
        if (slot(width, days) >= 1) expect(size).toBeLessThanOrEqual(slot(width, days))
      }
    }
  })

  it("keeps a week on a desk as bars, not blocks", () => {
    expect(usageBarSize(1100, 7)).toBe(28)
  })

  it("is 1px before the chart has been measured", () => {
    expect(usageBarSize(0, 30)).toBe(1)
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
    const lastSeen: UsageLastSeen[] = [{ userId: "c", day: "2026-06-01", lastSeenAt: "2026-06-01T05:00:00Z", lastPath: "/contacts" }]
    const [citra] = rollupPeople([people[2]], [], lastSeen, TODAY)
    expect(citra.state).toBe("idle")
    expect(citra.lastSeenAt).toBe("2026-06-01T05:00:00Z")
    expect(citra.lastPath).toBe("/contacts")
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

describe("shares", () => {
  it("adds up to exactly 100, giving the remainder to the largest fractions", () => {
    expect(shares([1, 1, 1])).toEqual([34, 33, 33])
    expect(shares([2, 1]).reduce((sum, value) => sum + value, 0)).toBe(100)
  })
  it("is all zeros with no total", () => {
    expect(shares([0, 0])).toEqual([0, 0])
    expect(shares([])).toEqual([])
  })
})

describe("rollupPages", () => {
  const page = (path: string, dayKey: string, views: number): UsagePageRow => ({ path, day: dayKey, views })

  it("sums a path across days, most opened first, with shares of the whole", () => {
    const result = rollupPages(
      [page("/", TODAY, 6), page("/", "2026-09-22", 2), page("/leads/:id", TODAY, 2), page("/old", "2026-01-01", 50)],
      windowStart(TODAY, 30),
      TODAY
    )
    expect(result.total).toBe(10)
    expect(result.rows.map((row) => [row.label, row.value, row.share])).toEqual([
      ["Dashboard", 8, 80],
      ["Lead details", 2, 20],
    ])
  })

  it("folds everything past the top rows into one Other row", () => {
    const rows = Array.from({ length: 5 }, (_, index) => page(`/p${index}`, TODAY, 10 - index))
    const result = rollupPages(rows, TODAY, TODAY, 3)
    expect(result.all).toHaveLength(5)
    expect(result.rows).toHaveLength(4)
    const other = result.rows[3]
    expect(other.label).toBe("Other (2 pages)")
    expect(other.value).toBe(13)
    expect(other.folded).toBe(2)
    expect(result.rows.reduce((sum, row) => sum + row.share, 0)).toBe(100)
  })

  it("says page, not pages, when it folds one", () => {
    const rows = Array.from({ length: 4 }, (_, index) => page(`/p${index}`, TODAY, 10 - index))
    expect(rollupPages(rows, TODAY, TODAY, 3).rows[3].label).toBe("Other (1 page)")
  })

  it("is empty with nothing opened", () => {
    expect(rollupPages([], TODAY, TODAY)).toEqual({ rows: [], all: [], total: 0 })
  })
})

describe("lastSeenLabel", () => {
  const now = new Date("2026-09-23T05:00:00Z") // 12:00 WIB
  it("speaks in minutes and hours on the same day", () => {
    expect(lastSeenLabel("2026-09-23T04:59:30Z", now)).toBe("Just now")
    expect(lastSeenLabel("2026-09-23T04:48:00Z", now)).toBe("12 minutes ago")
    expect(lastSeenLabel("2026-09-23T03:30:00Z", now)).toBe("1 hour ago")
    expect(lastSeenLabel("2026-09-23T02:30:00Z", now)).toBe("2 hours ago")
  })
  it("counts days in WIB", () => {
    // 23:50 WIB on the 22nd is yesterday, even ten minutes before midnight.
    expect(lastSeenLabel("2026-09-22T16:50:00Z", new Date("2026-09-22T17:10:00Z"))).toBe("Yesterday")
    expect(lastSeenLabel("2026-09-20T05:00:00Z", now)).toBe("3 days ago")
  })
  it("gives the date for anything a month old", () => {
    expect(lastSeenLabel("2026-06-01T05:00:00Z", now)).toBe("1 Jun 2026")
  })
  it("reads a clock slightly ahead as just now, and garbage as a dash", () => {
    expect(lastSeenLabel("2026-09-23T05:01:00Z", now)).toBe("Just now")
    expect(lastSeenLabel("not a date", now)).toBe("—")
  })
  it("has an exact stamp for the title, in WIB", () => {
    expect(lastSeenStamp("2026-09-23T02:41:00Z")).toBe("Wed 23 Sep 2026, 09:41 WIB")
    expect(lastSeenStamp("2026-09-22T17:05:00Z")).toBe("Wed 23 Sep 2026, 00:05 WIB")
    expect(lastSeenStamp("nope")).toBe("")
  })
})
