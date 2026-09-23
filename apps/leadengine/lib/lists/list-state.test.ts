import { describe, expect, it } from "vitest"
import {
    EMPTY_LIST_STATE,
    clearedState,
    countActive,
    decodeFilterValue,
    encodeFilterValue,
    isBareRequest,
    lastPage,
    loadMoreStep,
    pageRange,
    parseListState,
    rememberedQuery,
    serializeListState,
    stateFromViewConfig,
    viewConfigKey,
    withFilters,
    withPage,
    withSearch,
    withSize,
    withSort,
    type ListState,
    type ListUrlSpec,
} from "./list-state"

const spec: ListUrlSpec = {
    fields: [
        { field: "client_company.name", param: "company", type: "select" },
        { field: "email", param: "email", type: "boolean" },
        { field: "job_title", param: "job_title", type: "text" },
        { field: "created_at", param: "created", type: "date-range" },
        { field: "tags", param: "tags", type: "multi-select" },
    ],
    sortKeys: ["full_name", "client_company", "owner"],
}

const state = (patch: Partial<ListState>): ListState => ({ ...EMPTY_LIST_STATE, ...patch })

describe("filter values in the URL", () => {
    it("writes the operator and the value, and reads them back", () => {
        const cases = [
            { field: "client_company.name", operator: "eq", value: "PT Maju: Jaya, Tbk" },
            { field: "email", operator: "is_true", value: null },
            { field: "job_title", operator: "contains", value: "manager" },
            { field: "created_at", operator: "between", value: ["2026-01-01", "2026-03-31"] },
            { field: "created_at", operator: "before", value: [null, "2026-03-31"] },
            { field: "tags", operator: "in", value: ["vip", "new, hot"] },
        ] as const
        for (const filter of cases) {
            const type = spec.fields.find((f) => f.field === filter.field)!.type
            const encoded = encodeFilterValue({ ...filter, value: filter.value as never }, type)
            expect(encoded).not.toBeNull()
            expect(decodeFilterValue(encoded!, filter.field, type)).toEqual(filter)
        }
    })

    it("writes nothing for a filter that compares against nothing", () => {
        expect(encodeFilterValue({ field: "job_title", operator: "contains", value: "" }, "text")).toBeNull()
        expect(encodeFilterValue({ field: "created_at", operator: "between", value: [null, null] }, "date-range")).toBeNull()
        expect(encodeFilterValue({ field: "tags", operator: "in", value: [] }, "multi-select")).toBeNull()
    })

    it("refuses an operator the field does not take, and reads a bad date as nothing", () => {
        expect(decodeFilterValue("drop_table:x", "job_title", "text")).toBeNull()
        expect(decodeFilterValue("is_true", "job_title", "text")).toBeNull()
        expect(decodeFilterValue("between:yesterday..", "created_at", "date-range")).toBeNull()
    })

    it("still reads a saved Has-email filter written with is_not_empty", () => {
        expect(decodeFilterValue("is_not_empty", "email", "boolean")).toEqual({ field: "email", operator: "is_not_empty", value: null })
    })
})

describe("parseListState / serializeListState", () => {
    it("reads search, filters, sort, page and size", () => {
        const parsed = parseListState(
            new URLSearchParams("q=+acme+&company=eq:PT%20Maju&email=is_true&sort=owner:desc&page=2&size=50"),
            spec,
        )
        expect(parsed).toEqual({
            q: "acme",
            filters: [
                { field: "client_company.name", operator: "eq", value: "PT Maju" },
                { field: "email", operator: "is_true", value: null },
            ],
            sort: { key: "owner", direction: "desc" },
            page: 2,
            size: 50,
        })
    })

    it("falls back to the defaults for anything it does not know", () => {
        const parsed = parseListState({ sort: "password:asc", page: "-3", size: "20", nope: "1" }, spec)
        expect(parsed).toEqual(EMPTY_LIST_STATE)
    })

    it("keeps filters in the order they were added, one per field", () => {
        const parsed = parseListState(new URLSearchParams("email=is_true&company=eq:A&company=eq:B"), spec)
        expect(parsed.filters.map((f) => f.field)).toEqual(["email", "client_company.name"])
        expect(parsed.filters[1].value).toBe("A")
    })

    it("leaves the defaults out, so the plain list is a bare URL", () => {
        expect(serializeListState(EMPTY_LIST_STATE, spec).toString()).toBe("")
        const qs = serializeListState(state({ q: "a", sort: { key: "full_name", direction: "asc" }, page: 1, size: 100 }), spec).toString()
        expect(qs).toBe("q=a&sort=full_name%3Aasc&page=1&size=100")
    })

    it("round-trips through the URL", () => {
        const original = state({
            q: "budi",
            filters: [{ field: "created_at", operator: "after", value: ["2026-02-01", null] }],
            sort: { key: "client_company", direction: "desc" },
            page: 3,
            size: 50,
        })
        expect(parseListState(serializeListState(original, spec), spec)).toEqual(original)
    })

    it("accepts the server's searchParams object", () => {
        expect(parseListState({ q: ["x", "y"], company: "eq:A" }, spec)).toMatchObject({ q: "x", filters: [{ field: "client_company.name", value: "A" }] })
    })
})

describe("transitions", () => {
    const busy = state({ q: "a", filters: [{ field: "email", operator: "is_true", value: null }], sort: { key: "owner", direction: "asc" }, page: 4, size: 50 })

    it("a new search, filter or sort goes back to the first page and keeps the rest", () => {
        expect(withSearch(busy, " b ")).toEqual({ ...busy, q: "b", page: 0 })
        expect(withFilters(busy, [])).toEqual({ ...busy, filters: [], page: 0 })
        expect(withSort(busy, null)).toEqual({ ...busy, sort: null, page: 0 })
        expect(withSize(busy, 100)).toEqual({ ...busy, size: 100, page: 0 })
        expect(withPage(busy, 5)).toEqual({ ...busy, page: 5 })
    })

    it("Clear all drops the search and the filters, keeps the sort and the size", () => {
        expect(clearedState(busy)).toEqual({ ...busy, q: "", filters: [], page: 0 })
        expect(countActive(busy)).toBe(2)
        expect(countActive(clearedState(busy))).toBe(0)
    })
})

describe("remembered view", () => {
    it("remembers the view without page or size", () => {
        const s = state({ q: "a", sort: { key: "owner", direction: "asc" }, page: 3, size: 100 })
        expect(rememberedQuery(s, spec)).toBe("q=a&sort=owner%3Aasc")
    })

    it("knows a bare request", () => {
        expect(isBareRequest({})).toBe(true)
        expect(isBareRequest({ q: "" })).toBe(true)
        expect(isBareRequest({ page: "1" })).toBe(false)
        expect(isBareRequest(new URLSearchParams(""))).toBe(true)
    })
})

describe("paging arithmetic", () => {
    it("names the rows a page shows", () => {
        expect(pageRange(0, 25, 1196)).toEqual({ first: 1, last: 25 })
        expect(pageRange(47, 25, 1196)).toEqual({ first: 1176, last: 1196 })
        expect(pageRange(0, 25, 0)).toEqual({ first: 0, last: 0 })
        expect(lastPage(1196, 25)).toBe(47)
        expect(lastPage(0, 25)).toBe(0)
    })

    it("Load more widens the first page to 100, then steps pages", () => {
        expect(loadMoreStep(0, 25, 1196)).toEqual({ page: 0, size: 50 })
        expect(loadMoreStep(0, 50, 1196)).toEqual({ page: 0, size: 100 })
        expect(loadMoreStep(0, 100, 1196)).toEqual({ page: 1, size: 100 })
        expect(loadMoreStep(11, 100, 1196)).toBeNull()
        expect(loadMoreStep(0, 25, 20)).toBeNull()
    })
})

describe("saved views", () => {
    const columns = [{ id: "full_name", visible: true }, { id: "owner", visible: false }]

    it("turns an old view config into a list state, dropping what no longer exists", () => {
        const s = stateFromViewConfig({
            searchQuery: "acme",
            filters: [{ field: "email", operator: "is_not_empty", value: null }, { field: "gone", operator: "eq", value: "x" }],
            sort: { key: "socials", direction: "asc" },
            itemsPerPage: 20,
            columns,
        }, spec)
        expect(s).toEqual(state({ q: "acme", filters: [{ field: "email", operator: "is_not_empty", value: null }] }))
    })

    it("compares views regardless of filter order and legacy sizes", () => {
        const a = { filters: [{ field: "email", operator: "is_true", value: null }, { field: "job_title", operator: "contains", value: "x" }], sort: null, itemsPerPage: 20, searchQuery: "", columns }
        const b = { ...a, filters: [...a.filters].reverse(), itemsPerPage: 25 }
        expect(viewConfigKey(a, spec)).toBe(viewConfigKey(b, spec))
        expect(viewConfigKey(a, spec)).not.toBe(viewConfigKey({ ...a, columns: [...columns].reverse() }, spec))
        expect(viewConfigKey(a, spec)).not.toBe(viewConfigKey({ ...a, itemsPerPage: 50 }, spec))
    })
})
