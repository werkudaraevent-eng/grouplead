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

/** Operators that compare against a value; the rest ask only whether one exists. */
export const OPERATORS_WITHOUT_VALUE: readonly FilterOperator[] = ["is_empty", "is_not_empty", "is_true", "is_false"]

export function operatorNeedsValue(op: FilterOperator): boolean {
    return !OPERATORS_WITHOUT_VALUE.includes(op)
}

/** "" / [] / [null, null] / null: nothing to compare against. Booleans are always a value. */
export function isEmptyFilterValue(v: FilterValue["value"]): boolean {
    if (v == null) return true
    if (typeof v === "string") return v === ""
    if (Array.isArray(v)) return v.length === 0 || v.every(x => x == null || x === "")
    return false
}

/** A filter that would compare against nothing is not a filter yet; it must not blank the list. */
export function isEffectiveFilter(f: FilterValue): boolean {
    return !operatorNeedsValue(f.operator) || !isEmptyFilterValue(f.value)
}

export function applyFilters<T>(rows: T[], filters: FilterValue[], defs: FilterDefinition[]): T[] {
    const effective = filters.filter(isEffectiveFilter)
    if (effective.length === 0) return rows
    const defByField = new Map(defs.map(d => [d.field, d]))
    return rows.filter((row) => {
        for (const f of effective) {
            const def = defByField.get(f.field)
            if (!def) continue
            const v = getValue(row, def)
            if (!matchOne(v, f)) return false
        }
        return true
    })
}

function isEmptyValue(value: unknown): boolean {
    return value == null || value === "" || value === false || (Array.isArray(value) && value.length === 0)
}

function matchOne(rowValue: unknown, f: FilterValue): boolean {
    switch (f.operator) {
        // `false` reads as empty so a boolean filter saved with the old
        // is_not_empty operator ("Has email") still means what it did.
        case "is_empty":
            return isEmptyValue(rowValue)
        case "is_not_empty":
            return !isEmptyValue(rowValue)
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

/** A filter's options, whether given as a list or resolved lazily. */
export function resolveFilterOptions(def: FilterDefinition): FilterOption[] {
    return typeof def.options === "function" ? def.options() : def.options ?? []
}

/**
 * What an applied filter reads as after its label ("Sector: Hotel", "Has
 * email: yes", "Created date: 2026-01-01 → 2026-03-31"): the chip on a
 * desk and the applied-filter chip on a phone say the same thing.
 */
export function filterValueLabel(def: FilterDefinition, f: FilterValue): string {
    if (f.operator === "is_empty") return def.type === "boolean" ? "no" : "is empty"
    if (f.operator === "is_not_empty") return def.type === "boolean" ? "yes" : "is set"
    if (f.operator === "is_true") return "yes"
    if (f.operator === "is_false") return "no"
    const prefix = f.operator === "neq" || f.operator === "not_in" ? "not " : f.operator === "not_contains" ? "without " : f.operator === "starts_with" ? "starts with " : ""
    if (def.type === "select" || def.type === "multi-select") {
        const opts = resolveFilterOptions(def)
        if (Array.isArray(f.value)) {
            const labels = (f.value as string[]).map(v => opts.find(o => o.value === v)?.label ?? v)
            return prefix + (labels.length <= 2 ? labels.join(", ") : `${labels.length} selected`)
        }
        const opt = opts.find(o => o.value === f.value)
        return prefix + (opt?.label ?? String(f.value))
    }
    if (def.type === "date-range") {
        const raw = f.value
        const [from, to] = Array.isArray(raw) ? (raw as [string | null, string | null]) : [typeof raw === "string" ? raw : null, null]
        if (f.operator === "before") return `before ${to ?? from ?? ""}`.trim()
        if (f.operator === "after") return `after ${from ?? to ?? ""}`.trim()
        if (from && to) return `${from} → ${to}`
        if (from) return `from ${from}`
        if (to) return `until ${to}`
        return "any date"
    }
    return prefix + String(f.value ?? "")
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
