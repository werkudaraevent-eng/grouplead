import type { SupabaseClient } from "@supabase/supabase-js"
import { sharedScopeTerm } from "@/utils/supabase/scoped-query"
import {
    distinctValues,
    planList,
    rangeOf,
    resolvedFilter,
    type ListMode,
    type ListPlan,
    type ListSpec,
    type Lookup,
    type OrderPlan,
} from "./list-plan"
import type { ListState } from "./list-state"
import { combineTerms } from "./postgrest-filters"

/**
 * Runs a list plan (list-plan.ts) with the caller's own session client, so
 * row security stays the boundary: nothing here uses the service role. The
 * flat view is tried first; when the database does not have it yet (the
 * deploy went out before the migration), the base table answers instead and
 * the view is not asked again for a minute.
 */

export interface ListPageResult<Row> {
    rows: Row[]
    total: number
    source: ListMode
}

/** The most rows an export writes. */
export const EXPORT_CAP = 5000
/** PostgREST's default page cap; anything longer is read in windows of this size. */
const WINDOW = 1000

type PgError = { code?: string; message?: string }
type Client = SupabaseClient

const MISSING_CODES = new Set(["PGRST205", "PGRST204", "PGRST200", "42P01", "42703"])
const missingUntil = new Map<string, number>()
const MISSING_TTL_MS = 60_000

function isMissingView(error: PgError, view: string): boolean {
    if (MISSING_CODES.has(error.code ?? "")) return true
    const message = (error.message ?? "").toLowerCase()
    return message.includes(view) && (message.includes("does not exist") || message.includes("could not find") || message.includes("schema cache"))
}

/** A page past the last one: PostgREST answers 416 rather than an empty page. */
function isRangeError(error: PgError): boolean {
    return error.code === "PGRST103"
}

function viewUsable(view: string): boolean {
    return (missingUntil.get(view) ?? 0) < Date.now()
}

/** Forget which views were missing (tests, and nothing else). */
export function forgetMissingViews() {
    missingUntil.clear()
}

function toError(error: PgError): Error {
    return new Error(error.message || "The list could not be loaded")
}

async function lookupIds(supabase: Client, lookup: Lookup): Promise<string[]> {
    let query = supabase.from(lookup.table).select("id").or(combineTerms([lookup.term])!)
    if (lookup.softDelete) query = query.is("deleted_at", null)
    const { data, error } = await query.order(lookup.column, { ascending: true }).limit(lookup.limit)
    if (error) throw toError(error)
    return ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
}

interface Prepared<Row> {
    plan: ListPlan
    filter: string | null
    order: OrderPlan[]
    map: (row: Record<string, unknown>) => Row
}

async function prepare<Row>(supabase: Client, spec: ListSpec<Row>, state: ListState, scopeTerm: string | null, mode: ListMode): Promise<Prepared<Row>> {
    const plan = planList(spec, state, mode, scopeTerm)
    const resolved = await Promise.all(
        plan.deferred.map(async (deferred) => deferred.build(await Promise.all(deferred.lookups.map((lookup) => lookupIds(supabase, lookup))))),
    )
    return { plan, filter: resolvedFilter(plan, resolved), order: plan.order, map: mode === "view" ? spec.fromView : spec.fromTable }
}

function select(supabase: Client, prepared: Prepared<unknown>, from: number, to: number, count: boolean) {
    let query = supabase
        .from(prepared.plan.source)
        .select(prepared.plan.select, count ? { count: "exact" } : undefined)
        .is("deleted_at", null)
    if (prepared.filter) query = query.or(prepared.filter)
    for (const o of prepared.order) query = query.order(o.column, { ascending: o.ascending, nullsFirst: o.nullsFirst })
    return query.range(from, to)
}

/**
 * A reader over one list view: the first call settles which source answers
 * (view, or the base table when the view is missing) and whether a related
 * order is accepted; later windows reuse that.
 */
function openList<Row>(supabase: Client, spec: ListSpec<Row>, state: ListState, scopeCompanyId: string | null) {
    const scopeTerm = sharedScopeTerm(scopeCompanyId)
    let prepared: Prepared<Row> | null = null
    let source: ListMode = viewUsable(spec.view) ? "view" : "table"

    const read = async (from: number, to: number, count: boolean): Promise<{ rows: Row[]; total: number | null }> => {
        for (;;) {
            if (!prepared) prepared = await prepare(supabase, spec, state, scopeTerm, source)
            const { data, error, count: total } = await select(supabase, prepared as Prepared<unknown>, from, to, count)
            if (!error) return { rows: ((data ?? []) as unknown as Record<string, unknown>[]).map(prepared.map), total: total ?? null }
            if (isRangeError(error)) {
                if (!count) return { rows: [], total: null }
                const head = supabase.from(prepared.plan.source).select("id", { count: "exact", head: true }).is("deleted_at", null)
                const counted = prepared.filter ? await head.or(prepared.filter) : await head
                return { rows: [], total: counted.count ?? 0 }
            }
            if (source === "view" && isMissingView(error, spec.view)) {
                console.warn(`[lists] ${spec.view} is not available (${error.code ?? error.message}); reading ${spec.table} instead until the migration is applied.`)
                missingUntil.set(spec.view, Date.now() + MISSING_TTL_MS)
                source = "table"
                prepared = null
                continue
            }
            if (prepared.plan.fallbackOrder && prepared.order !== prepared.plan.fallbackOrder) {
                console.warn(`[lists] ${spec.table}: related order refused (${error.code ?? error.message}); using the default order.`)
                prepared.order = prepared.plan.fallbackOrder
                continue
            }
            throw toError(error)
        }
    }
    return { read, source: () => source }
}

/** One page of a list, with the number of rows that match across every page. */
export async function runListPage<Row>(supabase: Client, spec: ListSpec<Row>, state: ListState, scopeCompanyId: string | null): Promise<ListPageResult<Row>> {
    const list = openList(supabase, spec, state, scopeCompanyId)
    const { from, to } = rangeOf(state.page, state.size)
    const { rows, total } = await list.read(from, to, true)
    return { rows, total: total ?? rows.length, source: list.source() }
}

/** Every row that matches, in the list's order, up to `cap`; `total` is the full match count. */
export async function runListExport<Row>(
    supabase: Client,
    spec: ListSpec<Row>,
    state: ListState,
    scopeCompanyId: string | null,
    cap = EXPORT_CAP,
): Promise<{ rows: Row[]; total: number }> {
    const list = openList(supabase, spec, state, scopeCompanyId)
    const rows: Row[] = []
    let total: number | null = null
    for (let from = 0; from < cap; from += WINDOW) {
        const to = Math.min(from + WINDOW, cap) - 1
        const window = await list.read(from, to, from === 0)
        if (from === 0) total = window.total
        rows.push(...window.rows)
        if (window.rows.length < to - from + 1) break
    }
    return { rows, total: total ?? rows.length }
}

/**
 * The choices for the list's select filters (Sector, Owner, Company, …),
 * read from the rows the person can see in this unit, one column set in
 * windows, then made distinct: PostgREST has no DISTINCT, and these lists
 * are a few hundred values at most.
 */
export async function runListOptions<Row>(supabase: Client, spec: ListSpec<Row>, scopeCompanyId: string | null, cap = EXPORT_CAP): Promise<Record<string, string[]>> {
    const scopeTerm = sharedScopeTerm(scopeCompanyId)
    const read = async (mode: ListMode) => {
        const rows: Row[] = []
        for (let from = 0; from < cap; from += WINDOW) {
            let query = supabase
                .from(mode === "view" ? spec.view : spec.table)
                .select(mode === "view" ? spec.options.viewSelect : spec.options.tableSelect)
                .is("deleted_at", null)
            if (scopeTerm) query = query.or(combineTerms([scopeTerm])!)
            const { data, error } = await query.order("id", { ascending: true }).range(from, from + WINDOW - 1)
            if (error) return { rows, error: error as PgError }
            const batch = ((data ?? []) as unknown as Record<string, unknown>[]).map(mode === "view" ? spec.fromView : spec.fromTable)
            rows.push(...batch)
            if (batch.length < WINDOW) break
        }
        return { rows, error: null }
    }
    let result = viewUsable(spec.view) ? await read("view") : null
    if (!result || (result.error && isMissingView(result.error, spec.view))) {
        if (result) missingUntil.set(spec.view, Date.now() + MISSING_TTL_MS)
        result = await read("table")
    }
    if (result.error) throw toError(result.error)
    const rows = result.rows
    return Object.fromEntries(Object.entries(spec.options.fields).map(([field, pick]) => [field, distinctValues(rows.map(pick))]))
}
