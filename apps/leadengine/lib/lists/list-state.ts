import {
    ALLOWED_OPERATORS,
    isEffectiveFilter,
    operatorNeedsValue,
    type FilterFieldType,
    type FilterOperator,
    type FilterValue,
} from "@/components/shared/filter-builder-types"
import type { SortState } from "@/lib/list-sort"

/**
 * A list page's view (search, filters, sort, page, rows per page) as a URL
 * query, so a filtered page can be linked, survives a refresh, and is the
 * one thing the remembered view and a saved view both write. Pure, so the
 * server action that runs the query and the page that draws it read the
 * same values. The shapes follow Sales Activity's lists
 * (`lib/missions/mission-paging.ts`, `lib/prospects/prospect-filter.ts`):
 * `page` counts from 0 and is left out on the first page, `size` is left
 * out at 25, and changing a filter, the search or the sort goes back to the
 * first page while keeping the sort and the size.
 *
 * A filter is one parameter named after its field, holding the operator and
 * the value: `company=eq:PT Maju`, `email=is_true`,
 * `created=between:2026-01-01..2026-03-31`.
 */

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 25

/** The URL-facing half of a list's fields: which parameter carries a filter, and how its value reads. */
export interface ListFieldParam {
    /** `FilterValue.field`, as the page's filter definitions name it. */
    field: string
    /** Its query parameter. */
    param: string
    type: FilterFieldType
}

export interface ListUrlSpec {
    fields: readonly ListFieldParam[]
    /** The sort keys a header may set; anything else in `sort=` is ignored. */
    sortKeys: readonly string[]
}

export interface ListState {
    q: string
    filters: FilterValue[]
    sort: SortState
    /** 0-based; the first page is 0. */
    page: number
    size: PageSize
}

export const EMPTY_LIST_STATE: ListState = { q: "", filters: [], sort: null, page: 0, size: DEFAULT_PAGE_SIZE }

export const RESERVED_PARAMS = ["q", "sort", "page", "size"] as const

/** Longest search the list accepts; anything longer is cut, never refused. */
export const MAX_SEARCH_LENGTH = 120

type Params = URLSearchParams | Record<string, string | string[] | undefined>

function entriesOf(params: Params): Array<[string, string]> {
    if (params instanceof URLSearchParams) return [...params.entries()]
    const out: Array<[string, string]> = []
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) value.forEach((v) => out.push([key, v]))
        else if (value !== undefined) out.push([key, value])
    }
    return out
}

function firstValue(params: Params, key: string): string {
    const found = entriesOf(params).find(([k]) => k === key)
    return found?.[1] ?? ""
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const ALL_OPERATORS: readonly FilterOperator[] = [
    "eq", "neq", "contains", "not_contains", "starts_with", "is_empty", "is_not_empty",
    "in", "not_in", "is_true", "is_false", "before", "after", "between",
]

/**
 * Operators a field of this type accepts from a URL or a saved view. A
 * boolean also takes the old is_empty / is_not_empty, which saved "Has
 * email" views still carry (read as false / true).
 */
export function acceptedOperators(type: FilterFieldType): readonly FilterOperator[] {
    return type === "boolean" ? [...ALLOWED_OPERATORS.boolean, "is_empty", "is_not_empty"] : ALLOWED_OPERATORS[type]
}

/** A date-range value as [from, to]; a bare date string (older saved views) counts as both sides. */
export function dateRangeOf(value: FilterValue["value"]): [string | null, string | null] {
    if (Array.isArray(value)) {
        const from = typeof value[0] === "string" && DATE.test(value[0]) ? value[0] : null
        const to = typeof value[1] === "string" && DATE.test(value[1]) ? value[1] : null
        return [from, to]
    }
    if (typeof value === "string" && DATE.test(value)) return [value, value]
    return [null, null]
}

/** `op` or `op:value`, or null when the filter compares against nothing (it is not a filter yet). */
export function encodeFilterValue(filter: FilterValue, type: FilterFieldType): string | null {
    if (!ALL_OPERATORS.includes(filter.operator)) return null
    if (!isEffectiveFilter(filter)) return null
    if (!operatorNeedsValue(filter.operator)) return filter.operator
    const value = filter.value
    switch (type) {
        case "date-range": {
            const [from, to] = dateRangeOf(value)
            if (!from && !to) return null
            return `${filter.operator}:${from ?? ""}..${to ?? ""}`
        }
        case "multi-select": {
            if (!Array.isArray(value)) return null
            const list = (value as unknown[]).filter((v): v is string => typeof v === "string" && v !== "")
            return list.length > 0 ? `${filter.operator}:${JSON.stringify(list)}` : null
        }
        case "boolean":
            return null
        default:
            return typeof value === "string" && value !== "" ? `${filter.operator}:${value}` : null
    }
}

/** The reverse of `encodeFilterValue`; null for anything it would not have written. */
export function decodeFilterValue(raw: string, field: string, type: FilterFieldType): FilterValue | null {
    const colon = raw.indexOf(":")
    const operator = (colon === -1 ? raw : raw.slice(0, colon)) as FilterOperator
    const payload = colon === -1 ? "" : raw.slice(colon + 1)
    if (!acceptedOperators(type).includes(operator)) return null
    if (!operatorNeedsValue(operator)) return { field, operator, value: null }
    switch (type) {
        case "date-range": {
            const [fromRaw, toRaw] = payload.includes("..") ? payload.split("..", 2) : operator === "before" ? ["", payload] : [payload, ""]
            const from = DATE.test(fromRaw) ? fromRaw : null
            const to = DATE.test(toRaw) ? toRaw : null
            return from || to ? { field, operator, value: [from, to] } : null
        }
        case "multi-select": {
            try {
                const parsed: unknown = JSON.parse(payload)
                if (!Array.isArray(parsed)) return null
                const list = parsed.filter((v): v is string => typeof v === "string" && v !== "")
                return list.length > 0 ? { field, operator, value: list } : null
            } catch {
                return null
            }
        }
        case "boolean":
            return null
        default:
            return payload !== "" ? { field, operator, value: payload } : null
    }
}

export function parseSortParam(raw: string, sortKeys: readonly string[]): SortState {
    const colon = raw.lastIndexOf(":")
    if (colon <= 0) return null
    const key = raw.slice(0, colon)
    const direction = raw.slice(colon + 1)
    if (!sortKeys.includes(key) || (direction !== "asc" && direction !== "desc")) return null
    return { key, direction }
}

export function parsePageSize(raw: unknown): PageSize {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10)
    return PAGE_SIZES.includes(n as PageSize) ? (n as PageSize) : DEFAULT_PAGE_SIZE
}

/**
 * Read a list's view from a query. Filters keep the order their parameters
 * came in (the order they were added); an unknown parameter, an operator
 * the field does not take, or a filter with nothing to compare is dropped.
 */
export function parseListState(params: Params, spec: ListUrlSpec): ListState {
    const byParam = new Map(spec.fields.map((f) => [f.param, f]))
    const seen = new Set<string>()
    const filters: FilterValue[] = []
    for (const [key, raw] of entriesOf(params)) {
        const field = byParam.get(key)
        if (!field || seen.has(field.field)) continue
        const decoded = decodeFilterValue(raw, field.field, field.type)
        if (decoded) {
            seen.add(field.field)
            filters.push(decoded)
        }
    }
    const page = Number.parseInt(firstValue(params, "page"), 10)
    return {
        q: firstValue(params, "q").trim().slice(0, MAX_SEARCH_LENGTH),
        filters,
        sort: parseSortParam(firstValue(params, "sort"), spec.sortKeys),
        page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 0,
        size: parsePageSize(firstValue(params, "size")),
    }
}

/**
 * Write a list's view as a query: search, filters in their order, sort,
 * then page and size unless left out. Defaults are omitted, so the plain
 * list is a bare URL.
 */
export function serializeListState(state: ListState, spec: ListUrlSpec, options: { paging?: boolean } = {}): URLSearchParams {
    const { paging = true } = options
    const params = new URLSearchParams()
    const q = state.q.trim().slice(0, MAX_SEARCH_LENGTH)
    if (q) params.set("q", q)
    const byField = new Map(spec.fields.map((f) => [f.field, f]))
    for (const filter of state.filters) {
        const field = byField.get(filter.field)
        if (!field || params.has(field.param)) continue
        const encoded = encodeFilterValue(filter, field.type)
        if (encoded) params.set(field.param, encoded)
    }
    if (state.sort && spec.sortKeys.includes(state.sort.key)) params.set("sort", `${state.sort.key}:${state.sort.direction}`)
    if (paging) {
        if (state.page > 0) params.set("page", String(state.page))
        if (state.size !== DEFAULT_PAGE_SIZE) params.set("size", String(state.size))
    }
    return params
}

/** Round-trip through the URL form: the view exactly as a link would carry it. */
export function normalizeListState(state: ListState, spec: ListUrlSpec): ListState {
    return parseListState(serializeListState(state, spec), spec)
}

/** The part of a view a list remembers between visits: no page and no size, as in Sales Activity. */
export function rememberedQuery(state: ListState, spec: ListUrlSpec): string {
    return serializeListState(state, spec, { paging: false }).toString()
}

/** Whether a request carries no query at all (a bare open of the list). */
export function isBareRequest(params: Params): boolean {
    return entriesOf(params).every(([, value]) => value === "")
}

/* ── Transitions ─────────────────────────────────────────────────────────── */

/** A new search keeps the filters, the sort and the size, and starts from the first page. */
export function withSearch(state: ListState, q: string): ListState {
    return { ...state, q: q.trim().slice(0, MAX_SEARCH_LENGTH), page: 0 }
}

export function withFilters(state: ListState, filters: FilterValue[]): ListState {
    return { ...state, filters, page: 0 }
}

export function withSort(state: ListState, sort: SortState): ListState {
    return { ...state, sort, page: 0 }
}

export function withSize(state: ListState, size: PageSize): ListState {
    return { ...state, size, page: 0 }
}

export function withPage(state: ListState, page: number): ListState {
    return { ...state, page: Math.max(0, Math.floor(page)) }
}

/** "Clear all": no search, no filters; the sort and the size stay, as Sales Activity's "Bersihkan semua" does. */
export function clearedState(state: ListState): ListState {
    return { ...state, q: "", filters: [], page: 0 }
}

/** How many things narrow the list: the search counts as one, each applied filter as one. */
export function countActive(state: ListState): number {
    return (state.q.trim() ? 1 : 0) + state.filters.filter(isEffectiveFilter).length
}

/* ── Paging arithmetic ───────────────────────────────────────────────────── */

export function lastPage(total: number, size: number): number {
    return Math.max(0, Math.ceil(total / size) - 1)
}

/** The rows a page shows, 1-based for reading ("26–50 of 1,196"); 0–0 when there are none. */
export function pageRange(page: number, size: number, total: number): { first: number; last: number } {
    if (total <= 0) return { first: 0, last: 0 }
    const first = Math.min(page * size + 1, total)
    return { first, last: Math.min(total, (page + 1) * size) }
}

/**
 * What "Load more" does on a phone: widen the first page to the next size
 * while there is one, and only past the largest step to the next page
 * (Sales Activity's `MissionPagination`). Null when there is nothing more.
 */
export function loadMoreStep(page: number, size: PageSize, total: number): { page: number; size: PageSize } | null {
    if (total <= (page + 1) * size) return null
    const bigger = PAGE_SIZES.find((option) => option > size)
    if (page === 0 && bigger) return { page: 0, size: bigger }
    return { page: page + 1, size }
}

/* ── Saved views ─────────────────────────────────────────────────────────── */

/** A saved view's config, as `useListViews` stores it (the shape predates URL state and is kept). */
export interface ListViewConfig<Column = unknown> {
    filters?: unknown
    sort?: unknown
    columns?: Column[]
    itemsPerPage?: unknown
    searchQuery?: unknown
}

/** The list state a saved view asks for, cleaned through the URL form (unknown fields and sorts dropped). */
export function stateFromViewConfig(config: ListViewConfig, spec: ListUrlSpec): ListState {
    const filters = Array.isArray(config.filters) ? (config.filters as FilterValue[]).filter((f) => f && typeof f.field === "string") : []
    const sortRaw = config.sort as { key?: unknown; direction?: unknown } | null | undefined
    const sort: SortState =
        sortRaw && typeof sortRaw.key === "string" && (sortRaw.direction === "asc" || sortRaw.direction === "desc")
            ? { key: sortRaw.key, direction: sortRaw.direction }
            : null
    const raw: ListState = {
        q: typeof config.searchQuery === "string" ? config.searchQuery : "",
        filters,
        sort,
        page: 0,
        size: parsePageSize(config.itemsPerPage),
    }
    return normalizeListState(raw, spec)
}

/**
 * A comparable key for a saved view or the current screen: the view's query
 * with its filters in field order (so the order they were added in does not
 * make a view "changed"), its size, and which columns show in which order.
 */
export function viewConfigKey(config: ListViewConfig<{ id: string; visible: boolean }>, spec: ListUrlSpec): string {
    const state = stateFromViewConfig(config, spec)
    const sorted = { ...state, filters: [...state.filters].sort((a, b) => a.field.localeCompare(b.field)) }
    const params = serializeListState(sorted, spec, { paging: false })
    params.set("size", String(state.size))
    const columns = Array.isArray(config.columns)
        ? config.columns.filter((c) => c && typeof c.id === "string").map((c) => `${c.id}${c.visible ? "" : "-"}`).join(",")
        : ""
    return `${params.toString()}|${columns}`
}
