"use client"

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { Check, ChevronRight } from "@/components/icons"
import { FilterChip } from "@/components/shared/filter-chip"
import { FilterSheetSection, PhoneFilterFrame, type PhoneFilterSearch } from "@/components/shared/phone-filter-frame"
import { SearchField } from "@/components/shared/search-field"
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Lead } from "@/types"
import {
    FACET_GROUPS,
    appliedRules,
    clearField,
    facetGroup,
    isAppliedRule,
    removeRule,
    ruleForField,
    ruleValueLabel,
    setFieldRule,
    type FacetRule,
} from "@/features/leads/lib/pipeline-filter-facets"
import { FILTER_FIELDS, OPERATORS, type FieldType, type FilterFieldConfig, type PipelineFilterState } from "./pipeline-filters"
import { SheetCheck, SheetChoiceChip } from "./sheet-choice"

const FIELD_BY_KEY = new Map(FILTER_FIELDS.map((field) => [field.key, field]))

function operatorLabel(type: FieldType, operator: string): string {
    return OPERATORS[type].find((o) => o.value === operator)?.label ?? operator
}

/** "is any of" → "Is any of"; "≥" stays. */
function sentence(label: string): string {
    return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "Grade: A, B", the chip of an applied rule. */
function ruleChipLabel(rule: FacetRule): string | null {
    const field = FIELD_BY_KEY.get(rule.field)
    if (!field) return null
    return `${field.label}: ${ruleValueLabel(rule, field.type, operatorLabel(field.type, rule.operator))}`
}

const newRuleId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * The Pipeline's search and filters on a phone (below `md`), under the
 * stage tabs: the lists' pattern (`PhoneFilterFrame`), the search then one
 * "Filter" button with the count of what narrows the leads, the applied
 * filters under them as input chips with an ✕, then "Clear all".
 *
 * The sheet lists every field the desk's Filter can use as a 56dp row
 * (`SheetRow`: the field's icon, its name, what it is set to), grouped
 * under M3 subheaders (People, Details, Amounts, Dates, Text). A row opens
 * that field's own sheet over it (Sales Activity opens a facet's checklist
 * the same way): how it compares as choice chips ("Is any of" / "Is none
 * of", "After" / "Before" / "On", …), then the values as a checklist of
 * 56dp rows (with a search above more than eight), or one 44px field for
 * an amount, a day or text. Every change applies at once; "Clear" drops
 * the field, "Done" goes back. The rules are the desk's own
 * (`PipelineFilterState`, `applyFilters`), so a filter set on either shows
 * on the other.
 */
export function PipelinePhoneFilters({
    leads,
    filters,
    setFilters,
    search,
    className,
}: {
    /** Every lead of the pipeline, for the values each field offers (as the desk's Filter). */
    leads: Lead[]
    filters: PipelineFilterState
    setFilters: Dispatch<SetStateAction<PipelineFilterState>>
    search: PhoneFilterSearch
    className?: string
}) {
    const [facetKey, setFacetKey] = useState<string | null>(null)
    const [facetOpen, setFacetOpen] = useState(false)
    const q = search.value.trim()
    const applied = appliedRules(filters)

    const chips: ReactNode[] = []
    if (q) chips.push(<FilterChip key="search" label={`“${q}”`} onRemove={() => search.onChange("")} />)
    for (const rule of applied) {
        const label = ruleChipLabel(rule)
        if (label) chips.push(<FilterChip key={rule.id} label={label} onRemove={() => setFilters((prev) => removeRule(prev, rule.id))} />)
    }

    const groups = FACET_GROUPS.map((title) => ({ title, fields: FILTER_FIELDS.filter((field) => facetGroup(field) === title) })).filter(
        (group) => group.fields.length > 0,
    )
    const facetField = facetKey ? FIELD_BY_KEY.get(facetKey) ?? null : null

    return (
        <PhoneFilterFrame
            search={search}
            count={applied.length + (q ? 1 : 0)}
            chips={chips}
            onClearAll={() => {
                search.onChange("")
                setFilters({ rules: [] })
            }}
            description="Tap a field to narrow the leads; the tabs and cards update as you go."
            bleedClassName="-mx-4 px-4"
            className={className}
        >
            {groups.map((group) => (
                <FilterSheetSection key={group.title} title={group.title}>
                    <div className="space-y-1">
                        {group.fields.map((field) => {
                            const rule = ruleForField(filters, field.key)
                            const on = rule !== undefined && isAppliedRule(rule)
                            return (
                                <SheetRow
                                    key={field.key}
                                    icon={field.icon}
                                    label={field.label}
                                    hint={on ? ruleValueLabel(rule, field.type, operatorLabel(field.type, rule.operator)) : undefined}
                                    aria-haspopup="dialog"
                                    onClick={() => {
                                        setFacetKey(field.key)
                                        setFacetOpen(true)
                                    }}
                                    trailing={
                                        <span className="flex shrink-0 items-center gap-1">
                                            {on && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                                            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                        </span>
                                    }
                                />
                            )
                        })}
                    </div>
                </FilterSheetSection>
            ))}
            {facetField && (
                <FacetSheet
                    field={facetField}
                    rule={ruleForField(filters, facetField.key)}
                    leads={leads}
                    open={facetOpen}
                    onOpenChange={setFacetOpen}
                    onChange={(operator, value) => setFilters((prev) => setFieldRule(prev, facetField.key, operator, value, newRuleId()))}
                    onClear={() => setFilters((prev) => clearField(prev, facetField.key))}
                />
            )}
        </PhoneFilterFrame>
    )
}

const FACET_DESCRIPTION: Record<FieldType, string> = {
    enum: "Tick one or more; the leads update as you go.",
    person: "Tick one or more; the leads update as you go.",
    number: "Type an amount; the leads update as you go.",
    date: "Pick a day; the leads update as you go.",
    text: "Type a few letters; the leads update as you go.",
}

/** One field's sheet, over the Filter sheet. */
function FacetSheet({
    field,
    rule,
    leads,
    open,
    onOpenChange,
    onChange,
    onClear,
}: {
    field: FilterFieldConfig
    rule: FacetRule | undefined
    leads: Lead[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onChange: (operator: string, value: string[]) => void
    onClear: () => void
}) {
    const applied = rule !== undefined && isAppliedRule(rule)
    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title={field.label}
            description={FACET_DESCRIPTION[field.type]}
            footer={
                <div className="flex gap-2">
                    {applied && (
                        <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClear}>
                            Clear
                        </Button>
                    )}
                    <Button type="button" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            }
        >
            {/* Remounts with each opening, so how it compares starts from the rule. */}
            <FacetBody key={field.key} field={field} rule={rule} leads={leads} onChange={onChange} />
        </BottomSheet>
    )
}

function FacetBody({
    field,
    rule,
    leads,
    onChange,
}: {
    field: FilterFieldConfig
    rule: FacetRule | undefined
    leads: Lead[]
    onChange: (operator: string, value: string[]) => void
}) {
    const operators = OPERATORS[field.type]
    const [operator, setOperator] = useState(rule?.operator ?? operators[0]?.value ?? "is_any_of")
    const [query, setQuery] = useState("")
    const values = rule?.value ?? []

    const chooseOperator = (next: string) => {
        setOperator(next)
        if (values.length > 0) onChange(next, values)
    }

    return (
        <div className="pb-2">
            {operators.length > 1 && (
                <div role="radiogroup" aria-label={`How ${field.label} compares`} className="flex flex-wrap gap-2 px-4 pb-3">
                    {operators.map((o) => (
                        <SheetChoiceChip key={o.value} label={sentence(o.label)} checked={operator === o.value} onChoose={() => chooseOperator(o.value)} />
                    ))}
                </div>
            )}

            {(field.type === "enum" || field.type === "person") && (
                <ValueChecklist
                    field={field}
                    leads={leads}
                    values={values}
                    query={query}
                    onQuery={setQuery}
                    onChange={(next) => onChange(operator, next)}
                />
            )}

            {field.type === "number" && (
                <div className="px-4">
                    <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={field.label}
                        value={values[0] ?? ""}
                        onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, "")
                            onChange(operator, digits ? [digits] : [])
                        }}
                        className="h-11 text-base"
                    />
                </div>
            )}

            {field.type === "date" && (
                <div className="px-4">
                    <Input
                        type="date"
                        aria-label={field.label}
                        value={values[0] ?? ""}
                        onChange={(e) => onChange(operator, e.target.value ? [e.target.value] : [])}
                        className="h-11 text-base"
                    />
                </div>
            )}

            {field.type === "text" && (
                <div className="px-4">
                    <Input
                        type="text"
                        placeholder="Type a value"
                        aria-label={field.label}
                        value={values[0] ?? ""}
                        onChange={(e) => onChange(operator, e.target.value ? [e.target.value] : [])}
                        className="h-11 text-base"
                    />
                </div>
            )}
        </div>
    )
}

function ValueChecklist({
    field,
    leads,
    values,
    query,
    onQuery,
    onChange,
}: {
    field: FilterFieldConfig
    leads: Lead[]
    values: string[]
    query: string
    onQuery: (query: string) => void
    onChange: (values: string[]) => void
}) {
    // What the pipeline's leads hold, and anything ticked that no lead holds any more.
    const offered = field.getOptions ? field.getOptions(leads) : []
    const options = [...values.filter((v) => !offered.includes(v)), ...offered]
    const needle = query.trim().toLowerCase()
    const shown = needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options
    const toggle = (value: string) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])

    if (options.length === 0) {
        return <p className="px-6 py-4 text-sm text-muted-foreground">Nothing to choose yet: no lead in this pipeline has one set.</p>
    }

    return (
        <>
            {options.length > 8 && (
                <div className="px-4 pb-2">
                    <SearchField
                        value={query}
                        onChange={onQuery}
                        placeholder={`Search ${field.label}`}
                        aria-label={`Search ${field.label}`}
                        debounceMs={0}
                        className="h-11 w-full max-w-none"
                    />
                </div>
            )}
            <div role="group" aria-label={field.label} className="space-y-1 px-2">
                {shown.map((option) => (
                    <SheetCheck key={option} label={option} checked={values.includes(option)} onToggle={() => toggle(option)} />
                ))}
                {shown.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">No value matches “{query.trim()}”.</p>}
            </div>
        </>
    )
}
