/**
 * The dashboard's own filters (pipeline, business unit, date range) against
 * how it opens: the default pipeline, every business unit, This Quarter.
 * The phone's Filter button counts what differs, its sheet lists them as
 * rows that say what each is set to, and its applied chips are those
 * filters (`DashboardPhoneFilters`).
 */
import { DEFAULT_DASHBOARD_PERIOD, dateRangeLabel } from "@/lib/date-range-presets"

export interface DashboardFilterState {
    pipelineId: string | null | undefined
    /** A business unit's id, or "all". */
    companyFilter: string
    period: string
}

export interface DashboardFilterContext {
    /** The pipeline the dashboard opens on: the one marked default, else the first. */
    defaultPipelineId: string | null | undefined
    /** Whether the business unit narrows anything (a holding view with more than one unit). */
    unitsApply: boolean
}

export interface DashboardFilterDiff {
    pipeline: boolean
    unit: boolean
    dateRange: boolean
}

/** The pipeline the dashboard opens on, as the page picks it: the default one, else the first. */
export function defaultPipelineId(pipelines: ReadonlyArray<{ id: string; is_default?: boolean | null }>): string | null {
    return (pipelines.find((p) => p.is_default) ?? pipelines[0])?.id ?? null
}

/** Which filters differ from how the dashboard opens. */
export function dashboardFilterDiff(state: DashboardFilterState, context: DashboardFilterContext): DashboardFilterDiff {
    return {
        pipeline: Boolean(context.defaultPipelineId && state.pipelineId && state.pipelineId !== context.defaultPipelineId),
        unit: context.unitsApply && state.companyFilter !== "all",
        dateRange: state.period !== DEFAULT_DASHBOARD_PERIOD,
    }
}

/** How many filters differ from how the dashboard opens: the number on the phone's Filter button. */
export function dashboardFilterCount(state: DashboardFilterState, context: DashboardFilterContext): number {
    const diff = dashboardFilterDiff(state, context)
    return Number(diff.pipeline) + Number(diff.unit) + Number(diff.dateRange)
}

export type DashboardFilterKey = "pipeline" | "unit" | "dateRange"

/** One row of the phone's Filter sheet. */
export interface DashboardFilterRow {
    key: DashboardFilterKey
    label: string
    /** What it is set to: "Group Lead 2026 · Default", "All business units", "This Quarter". */
    value: string | undefined
    /** It differs from how the dashboard opens. */
    applied: boolean
}

export interface DashboardFilterRowsInput {
    pipelines: ReadonlyArray<{ id: string; name: string }>
    activePipelineId: string | null | undefined
    defaultPipelineId: string | null | undefined
    /** The business units (not the holding). */
    units: ReadonlyArray<{ id: string; name: string }>
    unitsApply: boolean
    companyFilter: string
    period: string
    customStart: string
    customEnd: string
}

/**
 * The rows of the phone's Filter sheet, in order: Pipeline (with two
 * pipelines or more), Business unit (in a holding view with more than one
 * unit), Date range (always).
 */
export function dashboardFilterRows(input: DashboardFilterRowsInput): DashboardFilterRow[] {
    const diff = dashboardFilterDiff(
        { pipelineId: input.activePipelineId, companyFilter: input.companyFilter, period: input.period },
        { defaultPipelineId: input.defaultPipelineId, unitsApply: input.unitsApply },
    )
    const rows: DashboardFilterRow[] = []
    if (input.pipelines.length > 1) {
        const name = input.pipelines.find((p) => p.id === input.activePipelineId)?.name
        rows.push({
            key: "pipeline",
            label: "Pipeline",
            value: name && input.activePipelineId === input.defaultPipelineId ? `${name} · Default` : name,
            applied: diff.pipeline,
        })
    }
    if (input.unitsApply) {
        rows.push({
            key: "unit",
            label: "Business unit",
            value: input.companyFilter === "all" ? "All business units" : input.units.find((u) => u.id === input.companyFilter)?.name,
            applied: diff.unit,
        })
    }
    rows.push({
        key: "dateRange",
        label: "Date range",
        value: dateRangeLabel(input.period, input.customStart, input.customEnd),
        applied: diff.dateRange,
    })
    return rows
}

/** The units whose name holds the query, ignoring case and the spaces around it; every unit for an empty one. */
export function unitsMatching<T extends { name: string }>(units: ReadonlyArray<T>, query: string): T[] {
    const needle = query.trim().toLowerCase()
    return needle ? units.filter((u) => u.name.toLowerCase().includes(needle)) : [...units]
}
