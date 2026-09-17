import { describe, expect, it } from "vitest"
import { parseRingkasanQuery, resolveReportDay, resolveRingkasanRange, serializeRingkasanQuery } from "./ringkasan-filter"

const A = "2d5d1f98-53a5-4e76-827d-85a1cdb55fce"
const now = new Date("2026-09-17T10:00:00+07:00")

describe("parse and serialize", () => {
  it("defaults to this month and everyone, and writes nothing for that", () => {
    const query = parseRingkasanQuery({})
    expect(query).toEqual({ date: "month", from: null, to: null, sales: [], day: null })
    expect(serializeRingkasanQuery(query).toString()).toBe("")
  })

  it("round-trips a custom range, the sales and the day", () => {
    const params = { date: "custom", from: "2026-09-01", to: "2026-09-15", sales: `me,${A}`, day: "2026-09-10" }
    const query = parseRingkasanQuery(params)
    expect(query.date).toBe("custom")
    expect(query.sales).toEqual(["me", A])
    expect(serializeRingkasanQuery(query).toString()).toBe(`date=custom&from=2026-09-01&to=2026-09-15&sales=me%2C${A}&day=2026-09-10`)
    expect(parseRingkasanQuery(Object.fromEntries(serializeRingkasanQuery(query)))).toEqual(query)
  })

  it("reads bounds without a preset as custom and drops bounds on a preset", () => {
    expect(parseRingkasanQuery({ from: "2026-09-01" }).date).toBe("custom")
    expect(parseRingkasanQuery({ date: "week", from: "2026-09-01" }).from).toBeNull()
    expect(parseRingkasanQuery({ day: "17/09/2026" }).day).toBeNull()
  })
})

describe("resolveRingkasanRange", () => {
  it("resolves presets in mission time", () => {
    expect(resolveRingkasanRange(parseRingkasanQuery({ date: "today" }), now)).toEqual({ from: "2026-09-17", to: "2026-09-17" })
    expect(resolveRingkasanRange(parseRingkasanQuery({ date: "week" }), now)).toEqual({ from: "2026-09-14", to: "2026-09-20" })
    expect(resolveRingkasanRange(parseRingkasanQuery({}), now)).toEqual({ from: "2026-09-01", to: "2026-09-30" })
  })

  it("falls back to this month for a half or upside-down custom range", () => {
    expect(resolveRingkasanRange(parseRingkasanQuery({ date: "custom", from: "2026-09-05" }), now)).toEqual({ from: "2026-09-01", to: "2026-09-30" })
    expect(resolveRingkasanRange(parseRingkasanQuery({ date: "custom", from: "2026-09-20", to: "2026-09-05" }), now)).toEqual({ from: "2026-09-01", to: "2026-09-30" })
    expect(resolveRingkasanRange(parseRingkasanQuery({ date: "custom", from: "2026-09-05", to: "2026-09-20" }), now)).toEqual({ from: "2026-09-05", to: "2026-09-20" })
  })
})

describe("resolveReportDay", () => {
  const range = { from: "2026-09-01", to: "2026-09-30" }

  it("takes the asked day when it is inside the range", () => {
    expect(resolveReportDay(parseRingkasanQuery({ day: "2026-09-10" }), range, now)).toBe("2026-09-10")
    expect(resolveReportDay(parseRingkasanQuery({ day: "2026-10-10" }), range, now)).toBe("2026-09-17")
  })

  it("otherwise clamps today into the range", () => {
    expect(resolveReportDay(parseRingkasanQuery({}), range, now)).toBe("2026-09-17")
    expect(resolveReportDay(parseRingkasanQuery({}), { from: "2026-08-01", to: "2026-08-31" }, now)).toBe("2026-08-31")
    expect(resolveReportDay(parseRingkasanQuery({}), { from: "2026-10-01", to: "2026-10-31" }, now)).toBe("2026-10-01")
  })
})
