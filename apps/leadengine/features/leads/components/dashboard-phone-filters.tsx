"use client"

import { useState } from "react"
import { Building2, CalendarDays, Globe, KanbanSquare } from "@/components/icons"
import { DateRangeChoices } from "@/components/shared/date-range-filter"
import { FilterChip } from "@/components/shared/filter-chip"
import { FilterFieldRow, PhoneFilterFrame } from "@/components/shared/phone-filter-frame"
import { SearchField } from "@/components/shared/search-field"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { DEFAULT_DASHBOARD_PERIOD, dateRangeLabel } from "@/lib/date-range-presets"
import {
    dashboardFilterCount,
    dashboardFilterDiff,
    dashboardFilterRows,
    unitsMatching,
    type DashboardFilterKey,
} from "@/features/leads/lib/dashboard-filters"
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
 * bottom sheet that lists them as rows, the Pipeline's Filter sheet's
 * (`FilterFieldRow`: icon, name, what it is set to, a check while it
 * differs, a chevron): Pipeline, Business unit, Date range. A row opens
 * that filter's own sheet over it: the pipelines or the business units as
 * radio rows (`SheetChoice`; a search above more than eight units), or
 * the date sheet's panel (the quick ranges, then "Custom range…", which
 * opens the month). A choice applies at once and closes that sheet, back
 * to the list of filters; a custom range applies on its end day. The
 * sheet's footer has "Clear all" while anything is applied, then "Done".
 * What is applied repeats under the button as input chips with an ✕ (a
 * chart pick, "Exploring" on a desk, among them), then "Clear all".
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
    /** Said on the Date range sheet while the range is set aside (a chart month is picked). */
    dateRangeNote?: string
    /** Filters picked on a chart, after the dashboard's own. */
    extraChips: DashboardExtraChip[]
    onClearAll: () => void
    className?: string
}) {
    // The field whose sheet is up; kept while it closes, so its content stays for the exit.
    const [field, setField] = useState<DashboardFilterKey | null>(null)
    const [fieldOpen, setFieldOpen] = useState(false)
    const openField = (key: DashboardFilterKey) => {
        setField(key)
        setFieldOpen(true)
    }
    const closeField = () => setFieldOpen(false)

    const context = { defaultPipelineId, unitsApply }
    const state = { pipelineId: activePipelineId, companyFilter, period }
    const diff = dashboardFilterDiff(state, context)
    const count = dashboardFilterCount(state, context)
    const rows = dashboardFilterRows({
        pipelines,
        activePipelineId,
        defaultPipelineId,
        units,
        unitsApply,
        companyFilter,
        period,
        customStart,
        customEnd,
    })
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

    // The business unit's glyph is the More sheet's: the globe for every unit, a building for one.
    const rowIcon = (key: DashboardFilterKey) =>
        key === "pipeline" ? KanbanSquare : key === "unit" ? (companyFilter === "all" ? Globe : Building2) : CalendarDays

    return (
        <PhoneFilterFrame
            count={count}
            chips={chips}
            onClearAll={onClearAll}
            clearAllInSheet
            description="The dashboard updates as you choose."
            className={className}
        >
            <div className="space-y-1 px-2 pt-1 pb-2">
                {rows.map((row) => (
                    <FilterFieldRow
                        key={row.key}
                        icon={rowIcon(row.key)}
                        label={row.label}
                        value={row.value}
                        applied={row.applied}
                        onOpen={() => openField(row.key)}
                    />
                ))}
            </div>

            {field === "pipeline" && (
                <BottomSheet
                    open={fieldOpen}
                    onOpenChange={setFieldOpen}
                    title="Pipeline"
                    description="Choose one. A pipeline named for a year also sets the date range to that year."
                >
                    <div role="radiogroup" aria-label="Pipeline" className="space-y-1 px-2 pb-2">
                        {pipelines.map((p) => (
                            <SheetChoice
                                key={p.id}
                                label={p.name}
                                hint={p.id === defaultPipelineId ? "Default" : undefined}
                                checked={p.id === activePipelineId}
                                onChoose={() => {
                                    if (p.id !== activePipelineId) onPipelineChange(p.id)
                                    closeField()
                                }}
                            />
                        ))}
                    </div>
                </BottomSheet>
            )}

            {field === "unit" && (
                <BottomSheet open={fieldOpen} onOpenChange={setFieldOpen} title="Business unit" description="Choose one; the dashboard updates at once.">
                    <UnitChoices
                        units={units}
                        companyFilter={companyFilter}
                        onChoose={(id) => {
                            if (id !== companyFilter) onCompanyChange(id)
                            closeField()
                        }}
                    />
                </BottomSheet>
            )}

            {field === "dateRange" && (
                <BottomSheet
                    open={fieldOpen}
                    onOpenChange={setFieldOpen}
                    title="Date range"
                    description={dateRangeNote ?? "Choose one; the dashboard updates at once."}
                >
                    <DateRangeChoices
                        period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        onSelect={(p, s, e) => {
                            onDateRangeChange(p, s, e)
                            closeField()
                        }}
                    />
                </BottomSheet>
            )}
        </PhoneFilterFrame>
    )
}

/**
 * The business units as radio rows, "All business units" first, with a
 * search above more than eight (the Pipeline's value checklist does the
 * same). Inside the sheet's content, so the search starts empty with each
 * opening.
 */
function UnitChoices({
    units,
    companyFilter,
    onChoose,
}: {
    units: { id: string; name: string }[]
    companyFilter: string
    onChoose: (id: string) => void
}) {
    const [query, setQuery] = useState("")
    const shown = unitsMatching(units, query)
    const searching = query.trim() !== ""

    return (
        <>
            {units.length > 8 && (
                <div className="px-4 pt-1 pb-2">
                    <SearchField
                        value={query}
                        onChange={setQuery}
                        placeholder="Search business units"
                        aria-label="Search business units"
                        debounceMs={0}
                        className="h-11 w-full max-w-none"
                    />
                </div>
            )}
            <div role="radiogroup" aria-label="Business unit" className="space-y-1 px-2 pb-2">
                {!searching && <SheetChoice label="All business units" checked={companyFilter === "all"} onChoose={() => onChoose("all")} />}
                {shown.map((unit) => (
                    <SheetChoice key={unit.id} label={unit.name} checked={companyFilter === unit.id} onChoose={() => onChoose(unit.id)} />
                ))}
                {shown.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">No business unit matches “{query.trim()}”.</p>}
            </div>
        </>
    )
}
