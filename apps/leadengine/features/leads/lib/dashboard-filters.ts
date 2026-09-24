/**
 * The dashboard's own filters (pipeline, business unit, date range) against
 * how it opens: the default pipeline, every business unit, This Quarter.
 * The phone's Filter button counts what differs, and its applied chips are
 * those filters (`DashboardPhoneFilters`).
 */
import { DEFAULT_DASHBOARD_PERIOD } from "@/lib/date-range-presets"

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
