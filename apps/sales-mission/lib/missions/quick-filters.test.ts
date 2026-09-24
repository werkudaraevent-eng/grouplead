import { describe, expect, it } from "vitest"
import { DATE_PRESET_LABELS, EMPTY_QUERY, parseMissionQuery, resolveMissionFilter, serializeMissionQuery } from "./mission-filter"
import {
  activityListParams,
  countNarrowing,
  hasMe,
  resolveSales,
  salesOthers,
  SALES_ME,
  toggleLens,
  toggleMe,
  withSalesOthers,
} from "./quick-filters"
import { isBareRequest, resolveRememberedView, sanitizeView, sanitizeViewString } from "@/lib/view-cookies"
import { canonicalQuery } from "@/lib/lists/list-views"

const query = { ...EMPTY_QUERY, q: "aruna", status: ["ACCEPTED"] }

describe("the activity list's filter row", () => {
  it("adds and removes 'me' without touching other people or the rest of the query", () => {
    const withPerson = { ...query, sales: ["u1"] }
    const me = toggleMe(withPerson)
    expect(hasMe(me)).toBe(true)
    expect(me.sales).toEqual(["u1", SALES_ME])
    expect(me.q).toBe("aruna")
    expect(me.status).toEqual(["ACCEPTED"])
    expect(toggleMe(me).sales).toEqual(["u1"])
  })

  it("the Sales facet shows the other people and keeps 'Saya' when it changes", () => {
    const me = { ...query, sales: ["u1", SALES_ME] }
    expect(salesOthers(me)).toEqual(["u1"])
    expect(withSalesOthers(me, ["u1", "u2"]).sales).toEqual(["u1", "u2", SALES_ME])
    expect(withSalesOthers(me, []).sales).toEqual([SALES_ME])
    // Without Saya on, the facet's choice is the whole of the sales filter.
    expect(withSalesOthers({ ...query, sales: ["u1"] }, ["u2"]).sales).toEqual(["u2"])
    // "me" can never be picked twice through the facet.
    expect(withSalesOthers(me, [SALES_ME, "u3"]).sales).toEqual(["u3", SALES_ME])
  })

  it("resolves 'me' to the viewer once", () => {
    expect(resolveSales(["u1", "me", "u2"], "u2")).toEqual(["u1", "u2"])
    expect(resolveSales([], "u2")).toEqual([])
  })

  it("'me' survives the URL", () => {
    const withMe = { ...EMPTY_QUERY, sales: ["me", "u1"] }
    expect(parseMissionQuery(Object.fromEntries(serializeMissionQuery(withMe))).sales).toEqual(["me", "u1"])
  })

  it("an answer lens is a toggle: on, off, or swapped for the other", () => {
    expect(toggleLens("all", "mine")).toBe("mine")
    expect(toggleLens("mine", "mine")).toBe("all")
    expect(toggleLens("mine", "team")).toBe("team")
  })

  it("counts the lens as a narrowing, so Bersihkan semua shows while only a lens is on", () => {
    expect(countNarrowing(EMPTY_QUERY, "all")).toBe(0)
    expect(countNarrowing(EMPTY_QUERY, "mine")).toBe(1)
    expect(countNarrowing({ ...EMPTY_QUERY, date: "today", sales: [SALES_ME] }, "team")).toBe(3)
  })

  it("builds the list's query with the lens, and carries the sort and the size", () => {
    const params = activityListParams({ ...query, date: "today" }, "mine", { sort: "client:asc", size: "50" })
    expect(params.get("date")).toBe("today")
    expect(params.get("filter")).toBe("mine")
    expect(params.get("sort")).toBe("client:asc")
    expect(params.get("size")).toBe("50")
    expect(params.has("page")).toBe(false)
    const plain = activityListParams(EMPTY_QUERY, "all")
    expect(plain.toString()).toBe("")
  })
})

describe("old quick-chip links", () => {
  // What the chips row wrote: Saya (sales=me), Hari ini / Minggu ini /
  // Mendatang (date=…), Butuh jawaban / Menunggu tim (filter=…), and Semua
  // (none of them). Each must open the same state in the new row.
  const old = {
    saya: "sales=me",
    hariIni: "date=today",
    mingguIni: "date=week",
    mendatang: "date=upcoming",
    butuhJawaban: "filter=mine",
    menungguTim: "filter=team",
    together: "q=aruna&sales=me&date=today&filter=mine&sort=client%3Adesc",
  }
  const read = (qs: string) => {
    const params = Object.fromEntries(new URLSearchParams(qs))
    return { query: parseMissionQuery(params), lens: resolveMissionFilter(params.filter) }
  }

  it("turns Saya into the Saya toggle and each date chip into the Tanggal facet's value", () => {
    expect(hasMe(read(old.saya).query)).toBe(true)
    expect(salesOthers(read(old.saya).query)).toEqual([])
    expect(read(old.hariIni).query.date).toBe("today")
    expect(DATE_PRESET_LABELS[read(old.hariIni).query.date!]).toBe("Hari ini")
    expect(read(old.mingguIni).query.date).toBe("week")
    expect(read(old.mendatang).query.date).toBe("upcoming")
  })

  it("keeps the answer lenses", () => {
    expect(read(old.butuhJawaban).lens).toBe("mine")
    expect(read(old.menungguTim).lens).toBe("team")
    expect(read("filter=bogus").lens).toBe("all")
  })

  it("writes back exactly what it read, so a saved view stays marked and a remembered view reopens", () => {
    const { query: parsed, lens } = read(old.together)
    const written = activityListParams(parsed, lens, { sort: "client:desc" })
    expect(canonicalQuery("activities", written.toString())).toBe(canonicalQuery("activities", old.together))
    expect(sanitizeViewString("activities", old.together)).toBe("q=aruna&sales=me&date=today&filter=mine&sort=client%3Adesc")
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

  it("a bare open goes to the remembered view, and only a browser with no memory at all is fresh", () => {
    expect(resolveRememberedView("activities", {}, "date%3Dweek%26page%3D2")).toEqual({ query: "date=week", fresh: false })
    // "Bersihkan semua" and the list's first visit leave an empty memory: the plain list, not a first open.
    expect(resolveRememberedView("activities", {}, "")).toEqual({ query: null, fresh: false })
    expect(resolveRememberedView("activities", {}, undefined)).toEqual({ query: null, fresh: true })
    // A link or any query wins over both the memory and a default view.
    expect(resolveRememberedView("activities", { date: "today" }, "date=week")).toEqual({ query: null, fresh: false })
    expect(resolveRememberedView("activities", { date: "today" }, undefined)).toEqual({ query: null, fresh: false })
    expect(resolveRememberedView("prospects", {}, "%E0%A4%A")).toEqual({ query: null, fresh: false })
  })
})
