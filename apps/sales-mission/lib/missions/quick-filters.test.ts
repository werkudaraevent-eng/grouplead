import { describe, expect, it } from "vitest"
import { EMPTY_QUERY, parseMissionQuery, serializeMissionQuery } from "./mission-filter"
import { hasMe, isPlainView, plainView, resolveSales, SALES_ME, toggleDate, toggleLens, toggleMe, viewParams, type QuickView } from "./quick-filters"
import { isBareRequest, sanitizeView, sanitizeViewString } from "@/lib/view-cookies"

const view: QuickView = { query: { ...EMPTY_QUERY, q: "aruna", status: ["ACCEPTED"] }, lens: "all", sort: "upcoming" }

describe("quick filters", () => {
  it("keeps the rest of the query when a chip toggles", () => {
    const today = toggleDate(view, "today")
    expect(today.query.date).toBe("today")
    expect(today.query.q).toBe("aruna")
    expect(today.query.status).toEqual(["ACCEPTED"])
    expect(toggleDate(today, "today").query.date).toBeNull()
    expect(toggleDate(today, "week").query.date).toBe("week")
  })

  it("adds and removes 'me' in the sales facet without touching other people", () => {
    const withPerson: QuickView = { ...view, query: { ...view.query, sales: ["u1"] } }
    const me = toggleMe(withPerson)
    expect(hasMe(me.query)).toBe(true)
    expect(me.query.sales).toEqual(["u1", SALES_ME])
    expect(toggleMe(me).query.sales).toEqual(["u1"])
  })

  it("resolves 'me' to the viewer once", () => {
    expect(resolveSales(["u1", "me", "u2"], "u2")).toEqual(["u1", "u2"])
    expect(resolveSales([], "u2")).toEqual([])
  })

  it("'me' survives the URL", () => {
    const query = { ...EMPTY_QUERY, sales: ["me", "u1"] }
    expect(parseMissionQuery(Object.fromEntries(serializeMissionQuery(query))).sales).toEqual(["me", "u1"])
  })

  it("Semua clears the chips but not the search or the sheet's facets", () => {
    const busy = toggleLens(toggleMe(toggleDate(view, "week")), "mine")
    expect(isPlainView(busy)).toBe(false)
    const plain = plainView(busy)
    expect(isPlainView(plain)).toBe(true)
    expect(plain.query.q).toBe("aruna")
    expect(plain.query.status).toEqual(["ACCEPTED"])
  })

  it("builds the list's query with the lens and only a non-default sort", () => {
    const params = viewParams(toggleLens(toggleDate(view, "today"), "mine"), "upcoming")
    expect(params.get("date")).toBe("today")
    expect(params.get("filter")).toBe("mine")
    expect(params.has("sort")).toBe(false)
    expect(viewParams({ ...view, sort: "client:asc" }, "upcoming").get("sort")).toBe("client:asc")
  })
})

describe("remembered view", () => {
  it("keeps what the list's parser accepts and drops page, size and junk", () => {
    expect(sanitizeView("activities", { date: "today", sales: "me", filter: "mine", sort: "client:desc", page: "3", size: "50", evil: "1" })).toBe(
      "sales=me&date=today&filter=mine&sort=client%3Adesc"
    )
    expect(sanitizeView("activities", { date: "yesterday", filter: "bogus", sort: "nope" })).toBe("")
    expect(sanitizeView("prospects", { due: "1", owner: "u1", page: "2" })).toBe("owner=u1&due=1")
    expect(sanitizeView("reports", { date: "week", sort: "submitted:desc" })).toBe("date=week")
  })

  it("reads a query string the same way", () => {
    expect(sanitizeViewString("activities", "date=week&page=4")).toBe("date=week")
    expect(sanitizeViewString("activities", "")).toBe("")
  })

  it("only a request with no query at all is bare", () => {
    expect(isBareRequest({})).toBe(true)
    expect(isBareRequest({ q: "" , page: undefined })).toBe(true)
    expect(isBareRequest({ page: "2" })).toBe(false)
  })
})
