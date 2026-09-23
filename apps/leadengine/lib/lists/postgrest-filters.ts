import { isEffectiveFilter, type FilterOperator, type FilterValue } from "@/components/shared/filter-builder-types"
import { dateRangeOf } from "./list-state"

/**
 * The list filter vocabulary (FilterValue operators) as PostgREST logic
 * terms, so search, filters and "Has …" run in the database instead of over
 * a thousand rows in the browser. Every term is a complete logic expression
 * (`name.ilike."*maju*"`, `or(email.is.null,email.not.match."[^[:space:]]")`), and a
 * list's terms are ANDed into one `or=(and(…))` parameter, so a query never
 * depends on how PostgREST combines repeated `or` parameters.
 *
 * Text compares case-insensitively, as the browser filter did: "is" is an
 * ILIKE without wildcards, "contains" wraps the value in `*`. A negative
 * operator keeps rows with no value at all ("Sector is not Hotel" includes
 * companies with no sector), again as before. Dates are days in Western
 * Indonesia Time: "between 1 and 31 March" is from 1 March 00:00 WIB up to,
 * not including, 1 April 00:00 WIB.
 */

/** Wall-clock offset of the days a date filter names (WIB, the sales team's clock). */
export const DAY_OFFSET = "+07:00"
export const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

/**
 * A value inside a logic tree, in double quotes so the reserved characters
 * (`,` `.` `:` `(` `)`) are read as text; PostgREST unescapes `\x` to `x`
 * inside quotes, so a backslash and a quote are escaped with one.
 */
export function quoteValue(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * A value made literal for LIKE: `%` and `_` stop being wildcards. (`*` is
 * PostgREST's wildcard and cannot be escaped; a name holding one matches a
 * little more than typed, never less.)
 */
export function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/** Midnight WIB at the start of a YYYY-MM-DD day. */
export function dayStart(date: string): string {
    return `${date}T00:00:00${DAY_OFFSET}`
}

/** The day after a YYYY-MM-DD date. */
export function nextDay(date: string): string {
    const [y, m, d] = date.split("-").map(Number)
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    return next.toISOString().slice(0, 10)
}

const ilike = (column: string, pattern: string) => `${column}.ilike.${quoteValue(pattern)}`
const notIlike = (column: string, pattern: string) => `${column}.not.ilike.${quoteValue(pattern)}`
/**
 * Any character that is not white space: "has a value" the way `trim()`
 * meant it. A POSIX class rather than `\S`, so the pattern carries no
 * backslash through PostgREST's quoting.
 */
const HAS_TEXT = "[^[:space:]]"

/** A positive text comparison on one column, or null when the operator is not a text one. */
export function textTerm(column: string, operator: FilterOperator, value: FilterValue["value"]): string | null {
    const text = typeof value === "string" ? value : ""
    const list = Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === "string" && v !== "") : []
    switch (operator) {
        case "eq":
            return text ? ilike(column, escapeLike(text)) : null
        case "neq":
            return text ? `or(${column}.is.null,${notIlike(column, escapeLike(text))})` : null
        case "contains":
            return text ? ilike(column, `*${escapeLike(text)}*`) : null
        case "not_contains":
            return text ? `or(${column}.is.null,${notIlike(column, `*${escapeLike(text)}*`)})` : null
        case "starts_with":
            return text ? ilike(column, `${escapeLike(text)}*`) : null
        case "is_empty":
            return `or(${column}.is.null,${column}.eq."")`
        case "is_not_empty":
            return `and(${column}.not.is.null,${column}.neq."")`
        case "in":
            return list.length ? `or(${list.map((v) => ilike(column, escapeLike(v))).join(",")})` : null
        case "not_in":
            return list.length ? `or(${column}.is.null,and(${list.map((v) => notIlike(column, escapeLike(v))).join(",")}))` : null
        default:
            return null
    }
}

/** "Has email": true when the text column holds anything but white space. */
export function presenceTerm(column: string, operator: FilterOperator): string | null {
    switch (operator) {
        case "is_true":
        case "is_not_empty":
            return `${column}.match.${quoteValue(HAS_TEXT)}`
        case "is_false":
        case "is_empty":
            return `or(${column}.is.null,${column}.not.match.${quoteValue(HAS_TEXT)})`
        default:
            return null
    }
}

/** A true/false column ("Needs details"); a missing value reads as false. */
export function flagTerm(column: string, operator: FilterOperator): string | null {
    switch (operator) {
        case "is_true":
        case "is_not_empty":
            return `${column}.is.true`
        case "is_false":
        case "is_empty":
            return `${column}.not.is.true`
        default:
            return null
    }
}

/** A timestamp column against whole WIB days. */
export function dateTerm(column: string, operator: FilterOperator, value: FilterValue["value"]): string | null {
    const [from, to] = dateRangeOf(value)
    const since = (day: string) => `${column}.gte.${quoteValue(dayStart(day))}`
    const until = (day: string) => `${column}.lt.${quoteValue(dayStart(nextDay(day)))}`
    switch (operator) {
        case "between": {
            const parts = [from && since(from), to && until(to)].filter((p): p is string => Boolean(p))
            if (parts.length === 0) return null
            return parts.length === 1 ? parts[0] : `and(${parts.join(",")})`
        }
        case "before": {
            const day = to ?? from
            return day ? `${column}.lt.${quoteValue(dayStart(day))}` : null
        }
        case "after": {
            const day = from ?? to
            return day ? since(nextDay(day)) : null
        }
        default:
            return null
    }
}

/* ── Relations ───────────────────────────────────────────────────────────── */

/** Operators whose negation a relation filter resolves: the lookup finds the positive set. */
const NEGATED: Partial<Record<FilterOperator, FilterOperator>> = { neq: "eq", not_contains: "contains", not_in: "in" }

/**
 * How a filter on a related record's name (a contact's company, an owner)
 * runs against the base table, where the name is not a column: find the
 * matching related ids first (`lookup`), then keep the rows pointing at
 * them (`fk in (…)`), or, for a negative operator, the rows pointing
 * elsewhere or nowhere. "Is empty" needs no lookup.
 */
export type RelationFilterPlan =
    | { kind: "term"; term: string }
    | { kind: "lookup"; lookupTerm: string; negate: boolean }

export function relationFilterPlan(fk: string, column: string, filter: FilterValue): RelationFilterPlan | null {
    if (filter.operator === "is_empty") return { kind: "term", term: `${fk}.is.null` }
    if (filter.operator === "is_not_empty") return { kind: "term", term: `${fk}.not.is.null` }
    const positive = NEGATED[filter.operator] ?? filter.operator
    const lookupTerm = textTerm(column, positive, filter.value)
    return lookupTerm ? { kind: "lookup", lookupTerm, negate: positive !== filter.operator } : null
}

/** The row-side term once the related ids are known. */
export function relationIdsTerm(fk: string, ids: string[], negate: boolean): string | null {
    if (negate) return ids.length ? `or(${fk}.is.null,${fk}.not.in.(${ids.join(",")}))` : null
    // Nothing matched: keep no rows. The zero uuid is never a record's id.
    return `${fk}.in.(${(ids.length ? ids : [ZERO_UUID]).join(",")})`
}

/* ── Search ──────────────────────────────────────────────────────────────── */

/** The search as one OR across the list's text columns, plus any extra branches (related ids). */
export function searchTerm(columns: readonly string[], q: string, extra: readonly string[] = []): string | null {
    const text = q.trim()
    if (!text) return null
    const pattern = `*${escapeLike(text)}*`
    const branches = [...columns.map((column) => ilike(column, pattern)), ...extra]
    return branches.length ? `or(${branches.join(",")})` : null
}

/** A search's pattern against one related name column (for the lookup of matching ids). */
export function searchLookupTerm(column: string, q: string): string | null {
    const text = q.trim()
    return text ? ilike(column, `*${escapeLike(text)}*`) : null
}

/** All terms ANDed into the body of one `or=(…)` parameter; null when there is nothing to filter. */
export function combineTerms(terms: ReadonlyArray<string | null | undefined>): string | null {
    const kept = terms.filter((t): t is string => Boolean(t))
    return kept.length ? `and(${kept.join(",")})` : null
}

/** The filters that narrow the list, one per field (the first one wins, as the URL parser keeps them). */
export function effectiveFilters(filters: readonly FilterValue[]): FilterValue[] {
    const byField = new Map<string, FilterValue>()
    for (const f of filters) if (isEffectiveFilter(f) && !byField.has(f.field)) byField.set(f.field, f)
    return [...byField.values()]
}
