import type { FilterFieldType, FilterOperator, FilterValue } from "@/components/shared/filter-builder-types"
import type { ListFieldParam, ListState, ListUrlSpec } from "./list-state"
import {
    combineTerms,
    dateTerm,
    effectiveFilters,
    flagTerm,
    presenceTerm,
    relationFilterPlan,
    relationIdsTerm,
    searchLookupTerm,
    searchTerm,
    textTerm,
} from "./postgrest-filters"

/**
 * How a list page's view (see list-state.ts) becomes one PostgREST query.
 *
 * Each list has two sources. The first is a flat view
 * (`contact_list_rows`, `client_company_list_rows`, migration
 * 20260923150000) that carries the related names a person searches, filters
 * and sorts by (the contact's company, the owner, the parent company) as
 * plain columns, so every one of those is a column operation in the
 * database. The second is the base table with its embeds, for a database
 * the migration has not reached yet: there a filter on a related name first
 * looks up the matching ids, a search on one does the same for up to
 * LOOKUP_LIMIT related records, and a sort on one asks PostgREST for a
 * related order, falling back to the default order if it is refused. The
 * page never breaks for a missing view; it only gets less exact.
 */

export type ListKey = "contacts" | "companies"
export type ListMode = "view" | "table"

/** A related record's name, as the view flattens it and as the base table reaches it. */
export interface RelationTarget {
    /** The flattened name column on the list view. */
    viewColumn: string
    /** The row's foreign key on the base table. */
    fk: string
    /** The related table and its name column, for the id lookup without the view. */
    table: string
    column: string
    /** The related table soft-deletes: only live rows count. */
    softDelete?: boolean
    /** The embed's alias in the base select, for a related order. */
    embed: string
}

export type FieldTarget =
    | { kind: "text"; column: string }
    | { kind: "presence"; column: string }
    | { kind: "flag"; column: string }
    | { kind: "date"; column: string }
    | { kind: "relation"; relation: RelationTarget }

/** One filter a list offers: its URL parameter, its label in the filter bar, and what it filters. */
export interface ListField extends ListFieldParam {
    label: string
    type: FilterFieldType
    pinned?: boolean
    defaultOperator?: FilterOperator
    target: FieldTarget
}

export type SortTarget = { kind: "column"; column: string } | { kind: "relation"; relation: RelationTarget }

export interface ListSpec<Row> {
    key: ListKey
    table: string
    view: string
    tableSelect: string
    viewSelect: string
    /** The default order, A to Z, and every sort's tiebreak. */
    nameColumn: string
    fields: readonly ListField[]
    sorts: Readonly<Record<string, SortTarget>>
    search: { columns: readonly string[]; relations: readonly RelationTarget[] }
    fromView: (row: Record<string, unknown>) => Row
    fromTable: (row: Record<string, unknown>) => Row
    /** The select-type fields whose choices come from the rows, and how to read each from a row. */
    options: {
        viewSelect: string
        tableSelect: string
        fields: Readonly<Record<string, (row: Row) => string | null | undefined>>
    }
}

const urlSpecs = new WeakMap<object, ListUrlSpec>()

/** The URL half of a list spec (parameters and sort keys), memoised so hooks can depend on it. */
export function urlSpecOf(spec: Pick<ListSpec<unknown>, "fields" | "sorts">): ListUrlSpec {
    let found = urlSpecs.get(spec)
    if (!found) {
        found = {
            fields: spec.fields.map(({ field, param, type }) => ({ field, param, type })),
            sortKeys: Object.keys(spec.sorts),
        }
        urlSpecs.set(spec, found)
    }
    return found
}

export interface OrderPlan {
    column: string
    ascending: boolean
    nullsFirst: boolean
}

/** Related records whose ids a term needs before it can be written (base table only). */
export interface Lookup {
    table: string
    column: string
    term: string
    softDelete: boolean
    limit: number
}

export interface DeferredTerm {
    lookups: Lookup[]
    /** The term, given each lookup's ids in order; null when it narrows nothing. */
    build: (ids: string[][]) => string | null
}

export interface ListPlan {
    mode: ListMode
    source: string
    select: string
    /** Terms known up front, ANDed. */
    terms: string[]
    /** Terms that need related ids first. */
    deferred: DeferredTerm[]
    order: OrderPlan[]
    /** A plainer order to retry with when the database refuses `order` (a related order on the base table). */
    fallbackOrder: OrderPlan[] | null
}

/** How many related ids a lookup may return; more would make the request URL too long to send. */
export const LOOKUP_LIMIT = 100

function fieldTerm(target: Exclude<FieldTarget, { kind: "relation" }>, filter: FilterValue): string | null {
    switch (target.kind) {
        case "text":
            return textTerm(target.column, filter.operator, filter.value)
        case "presence":
            return presenceTerm(target.column, filter.operator)
        case "flag":
            return flagTerm(target.column, filter.operator)
        case "date":
            return dateTerm(target.column, filter.operator, filter.value)
    }
}

function lookupOf(relation: RelationTarget, term: string): Lookup {
    return { table: relation.table, column: relation.column, term, softDelete: relation.softDelete === true, limit: LOOKUP_LIMIT }
}

function orderFor<Row>(spec: ListSpec<Row>, state: ListState, mode: ListMode): { order: OrderPlan[]; fallbackOrder: OrderPlan[] | null } {
    const byName: OrderPlan = { column: spec.nameColumn, ascending: true, nullsFirst: false }
    const byId: OrderPlan = { column: "id", ascending: true, nullsFirst: false }
    const fallback = [byName, byId]
    const target = state.sort ? spec.sorts[state.sort.key] : undefined
    if (!state.sort || !target) return { order: fallback, fallbackOrder: null }
    const ascending = state.sort.direction === "asc"
    let column: string
    let related = false
    if (target.kind === "column") column = target.column
    else if (mode === "view") column = target.relation.viewColumn
    else {
        column = `${target.relation.embed}(${target.relation.column})`
        related = true
    }
    // Empty values sort last either way, so a descending sort opens on
    // names rather than on a screen of blanks; the name then the id break
    // ties, so a page boundary never shuffles rows between two pages.
    const primary: OrderPlan = { column, ascending, nullsFirst: false }
    const order = column === spec.nameColumn ? [primary, byId] : [primary, byName, byId]
    return { order, fallbackOrder: related ? fallback : null }
}

/**
 * The query for one list view. `scopeTerm` narrows to the active business
 * unit (see `sharedScopeTerm` in utils/supabase/scoped-query.ts) and is null
 * in the holding view.
 */
export function planList<Row>(spec: ListSpec<Row>, state: ListState, mode: ListMode, scopeTerm: string | null): ListPlan {
    const terms: string[] = []
    const deferred: DeferredTerm[] = []
    if (scopeTerm) terms.push(scopeTerm)

    const q = state.q.trim()
    if (q) {
        if (mode === "view") {
            const term = searchTerm([...spec.search.columns, ...spec.search.relations.map((r) => r.viewColumn)], q)
            if (term) terms.push(term)
        } else if (spec.search.relations.length === 0) {
            const term = searchTerm(spec.search.columns, q)
            if (term) terms.push(term)
        } else {
            const relations = spec.search.relations
            deferred.push({
                lookups: relations.map((r) => lookupOf(r, searchLookupTerm(r.column, q) ?? "")),
                build: (ids) =>
                    searchTerm(
                        spec.search.columns,
                        q,
                        relations.flatMap((r, i) => ((ids[i] ?? []).length ? [`${r.fk}.in.(${ids[i].join(",")})`] : [])),
                    ),
            })
        }
    }

    const byField = new Map(spec.fields.map((f) => [f.field, f]))
    for (const filter of effectiveFilters(state.filters)) {
        const field = byField.get(filter.field)
        if (!field) continue
        const target = field.target
        if (target.kind !== "relation") {
            const term = fieldTerm(target, filter)
            if (term) terms.push(term)
            continue
        }
        const relation = target.relation
        if (mode === "view") {
            const term = textTerm(relation.viewColumn, filter.operator, filter.value)
            if (term) terms.push(term)
            continue
        }
        const plan = relationFilterPlan(relation.fk, relation.column, filter)
        if (!plan) continue
        if (plan.kind === "term") terms.push(plan.term)
        else deferred.push({ lookups: [lookupOf(relation, plan.lookupTerm)], build: (ids) => relationIdsTerm(relation.fk, ids[0] ?? [], plan.negate) })
    }

    const { order, fallbackOrder } = orderFor(spec, state, mode)
    return {
        mode,
        source: mode === "view" ? spec.view : spec.table,
        select: mode === "view" ? spec.viewSelect : spec.tableSelect,
        terms,
        deferred,
        order,
        fallbackOrder,
    }
}

/** The plan's terms once every deferred one is resolved, as the body of one `or=(…)`. */
export function resolvedFilter(plan: ListPlan, resolved: ReadonlyArray<string | null>): string | null {
    return combineTerms([...plan.terms, ...resolved])
}

/** The rows a page asks for, as PostgREST's inclusive range. */
export function rangeOf(page: number, size: number): { from: number; to: number } {
    const from = page * size
    return { from, to: from + size - 1 }
}

/** Distinct, non-empty values, compared without case and kept in the first spelling seen, sorted A to Z. */
export function distinctValues(values: Iterable<string | null | undefined>): string[] {
    const seen = new Map<string, string>()
    for (const value of values) {
        const text = typeof value === "string" ? value.trim() : ""
        if (!text) continue
        const key = text.toLocaleLowerCase("en")
        if (!seen.has(key)) seen.set(key, text)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}
