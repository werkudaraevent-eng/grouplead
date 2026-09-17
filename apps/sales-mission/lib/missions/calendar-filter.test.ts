import { describe, expect, it } from "vitest"
import { calendarHref, parseCalendarSales, toggleMe } from "./calendar-filter"

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
})

describe("toggleMe", () => {
  it("adds and removes the viewer without touching the rest", () => {
    expect(toggleMe([A])).toEqual(["me", A])
    expect(toggleMe(["me", A])).toEqual([A])
  })
})
