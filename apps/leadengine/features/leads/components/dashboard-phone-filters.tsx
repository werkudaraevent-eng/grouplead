"use client"

import { DateRangeChoices } from "@/components/shared/date-range-filter"
import { FilterChip } from "@/components/shared/filter-chip"
import { FilterSheetSection, PhoneFilterFrame } from "@/components/shared/phone-filter-frame"
import { DEFAULT_DASHBOARD_PERIOD, dateRangeLabel } from "@/lib/date-range-presets"
import { dashboardFilterCount, dashboardFilterDiff } from "@/features/leads/lib/dashboard-filters"
import { SheetChoice } from "./sheet-choice"

export interface DashboardExtraChip {
    key: string
    label: string
    onRemove: () => void
}

/**
 * The dashboard's filters on a phone (below `md`), the lists' pattern
 * (`PhoneFilterFrame`): under the factual line one outlined "Filter"
 * button, carrying how many of the dashboard's filters differ from how it
 * opens (the default pipeline, every business unit, This Quarter), opens a
 * bottom sheet with a section per filter. Pipeline and Business unit are
 * radio lists of 56dp rows (`SheetChoice`, the Switch pipeline sheet's
 * rows), the date range is the date sheet's own panel (the quick ranges as
 * choice chips, then a month of 40px days). Every choice applies at once,
 * as in the lists; "Done" closes the sheet. What is applied repeats under
 * the button as input chips with an ✕ (a chart pick, "Exploring" on a desk,
 * among them), then "Clear all".
 */
export function DashboardPhoneFilters({
    pipelines,
    activePipelineId,
    defaultPipelineId,
    onPipelineChange,
    units,
    unitsApply,
    companyFilter,
    onCompanyChange,
    period,
    customStart,
    customEnd,
    onDateRangeChange,
    dateRangeNote,
    extraChips,
    onClearAll,
    className,
}: {
    pipelines: { id: string; name: string }[]
    activePipelineId: string | undefined
    defaultPipelineId: string | null
    onPipelineChange: (id: string) => void
    /** The business units (not the holding). */
    units: { id: string; name: string }[]
    /** A holding view with more than one unit: the unit narrows the dashboard. */
    unitsApply: boolean
    companyFilter: string
    onCompanyChange: (id: string) => void
    period: string
    customStart: string
    customEnd: string
    onDateRangeChange: (period: string, customStart: string, customEnd: string) => void
    /** Said under Date range while it is set aside (a chart month is picked). */
    dateRangeNote?: string
    /** Filters picked on a chart, after the dashboard's own. */
    extraChips: DashboardExtraChip[]
    onClearAll: () => void
    className?: string
}) {
    const context = { defaultPipelineId, unitsApply }
    const state = { pipelineId: activePipelineId, companyFilter, period }
    const diff = dashboardFilterDiff(state, context)
    const count = dashboardFilterCount(state, context)
    const pipelineName = pipelines.find((p) => p.id === activePipelineId)?.name
    const unitName = units.find((u) => u.id === companyFilter)?.name

    const chips = [
        diff.pipeline && defaultPipelineId && pipelineName ? (
            <FilterChip key="pipeline" label={`Pipeline: ${pipelineName}`} onRemove={() => onPipelineChange(defaultPipelineId)} />
        ) : null,
        diff.unit && unitName ? <FilterChip key="unit" label={`Business unit: ${unitName}`} onRemove={() => onCompanyChange("all")} /> : null,
        diff.dateRange ? (
            <FilterChip
                key="date"
                label={`Date range: ${dateRangeLabel(period, customStart, customEnd)}`}
                onRemove={() => onDateRangeChange(DEFAULT_DASHBOARD_PERIOD, "", "")}
            />
        ) : null,
        ...extraChips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />),
    ].filter(Boolean)

    return (
        <PhoneFilterFrame
            count={count}
            chips={chips}
            onClearAll={onClearAll}
            description="The dashboard updates as you choose."
            className={className}
        >
            {pipelines.length > 1 && (
                <FilterSheetSection title="Pipeline">
                    <div role="radiogroup" aria-label="Pipeline" className="space-y-1">
                        {pipelines.map((p) => (
                            <SheetChoice
                                key={p.id}
                                label={p.name}
                                hint={p.id === defaultPipelineId ? "Default" : undefined}
                                checked={p.id === activePipelineId}
                                onChoose={() => {
                                    if (p.id !== activePipelineId) onPipelineChange(p.id)
                                }}
                            />
                        ))}
                    </div>
                </FilterSheetSection>
            )}
            {unitsApply && (
                <FilterSheetSection title="Business unit">
                    <div role="radiogroup" aria-label="Business unit" className="space-y-1">
                        <SheetChoice label="All business units" checked={companyFilter === "all"} onChoose={() => onCompanyChange("all")} />
                        {units.map((unit) => (
                            <SheetChoice key={unit.id} label={unit.name} checked={companyFilter === unit.id} onChoose={() => onCompanyChange(unit.id)} />
                        ))}
                    </div>
                </FilterSheetSection>
            )}
            <FilterSheetSection title="Date range" hint={dateRangeNote}>
                <DateRangeChoices
                    period={period}
                    customStart={customStart}
                    customEnd={customEnd}
                    onSelect={onDateRangeChange}
                    className="px-4"
                />
            </FilterSheetSection>
        </PhoneFilterFrame>
    )
}
