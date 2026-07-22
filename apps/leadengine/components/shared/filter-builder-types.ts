/**
 * Filter builder — generic filter engine for list pages.
 *
 * Two parts:
 *   1. `FilterBuilder` UI component (pill row + popover for advanced)
 *   2. `applyFilters` helper to execute a filter array against rows
 *
 * Schema:
 *   FilterDefinition  — defines what filters are available (per page)
 *   FilterValue       — the actual filter the user applied
 *   FilterOperator    — how to compare (varies by field type)
 */

import type { ReactNode } from "react"

/* ────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ────────────────────────────────────────────────────────────────── */

export type FilterFieldType = "text" | "select" | "multi-select" | "boolean" | "date-range"

export type FilterOperator =
    | "eq" | "neq"
    | "contains" | "not_contains"
    | "starts_with"
    | "is_empty" | "is_not_empty"
    | "in" | "not_in"
    | "is_true" | "is_false"
    | "before" | "after" | "between"

export interface FilterOption {
    value: string
    label: string
    /** Optional icon for the option. */
    icon?: ReactNode
}

/**
 * Definition of a filter the user can pick from. Provided by each page.
 */
export interface FilterDefinition {
    field: string
    label: string
    type: FilterFieldType
    /** Show as quick pill in the always-visible row. */
    pinned?: boolean
    /** For select / multi-select. Resolved lazily so we can lookup live data. */
    options?: FilterOption[] | (() => FilterOption[])
    /** Default operator when picking via UI. */
    defaultOperator?: FilterOperator
    /** Override the row resolver — return the cell's value for this field. */
    accessor?: (row: unknown) => unknown
}

/**
 * One concrete filter applied by the user.
 */
export interface FilterValue {
    field: string
    operator: FilterOperator
    /** string for text/select, string[] for multi-select, [from,to] for date-range, boolean for boolean. */
    value: string | string[] | boolean | [string | null, string | null] | null
}

/* ────────────────────────────────────────────────────────────────── */
/* Apply filters (pure)                                                */
/* ────────────────────────────────────────────────────────────────── */

const getValue = (row: unknown, def: FilterDefinition): unknown => {
    if (def.accessor) return def.accessor(row)
    if (typeof row !== "object" || row === null) return undefined
    // Support dot-paths like "client_company.name"
    const parts = def.field.split(".")
    let cur: unknown = row
    for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[p]
        } else {
            return undefined
        }
    }
    return cur
}

const cmp = (a: unknown, b: unknown) => {
    const sa = a == null ? "" : String(a).toLowerCase()
    const sb = b == null ? "" : String(b).toLowerCase()
    return { sa, sb }
}

export function applyFilters<T>(rows: T[], filters: FilterValue[], defs: FilterDefinition[]): T[] {
    if (filters.length === 0) return rows
    const defByField = new Map(defs.map(d => [d.field, d]))
    return rows.filter((row) => {
        for (const f of filters) {
            const def = defByField.get(f.field)
            if (!def) continue
            const v = getValue(row, def)
            if (!matchOne(v, f)) return false
        }
        return true
    })
}

function matchOne(rowValue: unknown, f: FilterValue): boolean {
    switch (f.operator) {
        case "is_empty":
            return rowValue == null || rowValue === "" || (Array.isArray(rowValue) && rowValue.length === 0)
        case "is_not_empty":
            return !(rowValue == null || rowValue === "" || (Array.isArray(rowValue) && rowValue.length === 0))
        case "is_true":
            return rowValue === true
        case "is_false":
            return rowValue === false || rowValue == null
        case "eq": {
            const { sa, sb } = cmp(rowValue, f.value as string)
            return sa === sb
        }
        case "neq": {
            const { sa, sb } = cmp(rowValue, f.value as string)
            return sa !== sb
        }
        case "contains": {
            const { sa, sb } = cmp(rowValue, f.value as string)
            return sa.includes(sb)
        }
        case "not_contains": {
            const { sa, sb } = cmp(rowValue, f.value as string)
            return !sa.includes(sb)
        }
        case "starts_with": {
            const { sa, sb } = cmp(rowValue, f.value as string)
            return sa.startsWith(sb)
        }
        case "in": {
            const arr = (f.value as string[]) ?? []
            if (arr.length === 0) return true
            const sa = rowValue == null ? "" : String(rowValue).toLowerCase()
            return arr.some(v => v.toLowerCase() === sa)
        }
        case "not_in": {
            const arr = (f.value as string[]) ?? []
            if (arr.length === 0) return true
            const sa = rowValue == null ? "" : String(rowValue).toLowerCase()
            return !arr.some(v => v.toLowerCase() === sa)
        }
        case "before": {
            const t = rowValue ? new Date(String(rowValue)).getTime() : NaN
            const x = f.value ? new Date(String(f.value)).getTime() : NaN
            return Number.isFinite(t) && Number.isFinite(x) && t < x
        }
        case "after": {
            const t = rowValue ? new Date(String(rowValue)).getTime() : NaN
            const x = f.value ? new Date(String(f.value)).getTime() : NaN
            return Number.isFinite(t) && Number.isFinite(x) && t > x
        }
        case "between": {
            const range = f.value as [string | null, string | null] | null
            if (!range) return true
            const [from, to] = range
            const t = rowValue ? new Date(String(rowValue)).getTime() : NaN
            if (!Number.isFinite(t)) return false
            const fromMs = from ? new Date(from).getTime() : -Infinity
            const toMs = to ? new Date(to).getTime() : Infinity
            return t >= fromMs && t <= toMs
        }
        default:
            return true
    }
}

/**
 * Default operator for a filter type when user adds one via UI.
 */
export const DEFAULT_OPERATOR: Record<FilterFieldType, FilterOperator> = {
    text: "contains",
    select: "eq",
    "multi-select": "in",
    boolean: "is_true",
    "date-range": "between",
}

/**
 * Operators allowed for each filter type, in display order.
 */
export const ALLOWED_OPERATORS: Record<FilterFieldType, FilterOperator[]> = {
    text: ["contains", "not_contains", "eq", "starts_with", "is_empty", "is_not_empty"],
    select: ["eq", "neq", "is_empty", "is_not_empty"],
    "multi-select": ["in", "not_in", "is_empty", "is_not_empty"],
    boolean: ["is_true", "is_false"],
    "date-range": ["between", "before", "after"],
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
    eq: "is",
    neq: "is not",
    contains: "contains",
    not_contains: "doesn’t contain",
    starts_with: "starts with",
    is_empty: "is empty",
    is_not_empty: "is not empty",
    in: "is any of",
    not_in: "is none of",
    is_true: "is true",
    is_false: "is false",
    before: "before",
    after: "after",
    between: "between",
}
