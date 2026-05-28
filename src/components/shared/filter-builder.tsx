"use client"

/**
 * Filter Builder UI — pill row + add-filter popover.
 *
 * Hybrid pattern (Linear + Attio):
 *   • `pinned` filters always rendered as pills, even when empty
 *   • Active filters render as colored pills with quick-edit popover
 *   • "+ Add filter" button opens picker for less-common fields
 *   • Single "Clear all" link when ≥1 filter active
 *
 * The component is **stateless** — parent owns the filter array.
 *
 * Visual:
 *   [Owner: John ✕]  [Company: ▾]  [Has email ✕]   [+ Add filter]   Clear all
 */

import * as React from "react"
import { ChevronDown, Plus, X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    type FilterDefinition,
    type FilterValue,
    type FilterOperator,
    type FilterOption,
    DEFAULT_OPERATOR,
    ALLOWED_OPERATORS,
    OPERATOR_LABELS,
} from "./filter-builder-types"

interface FilterBuilderProps {
    definitions: FilterDefinition[]
    value: FilterValue[]
    onChange: (filters: FilterValue[]) => void
    className?: string
}

const resolveOptions = (def: FilterDefinition): FilterOption[] =>
    typeof def.options === "function" ? def.options() : def.options ?? []

export function FilterBuilder({ definitions, value, onChange, className }: FilterBuilderProps) {
    const filtersByField = React.useMemo(() => {
        const m = new Map<string, FilterValue>()
        for (const f of value) m.set(f.field, f)
        return m
    }, [value])

    const pinned = definitions.filter(d => d.pinned)
    const hasActive = value.length > 0

    // Pinned defs that are NOT yet active become "ghost" pills (placeholder
    // value, opens picker on click).
    // Active filters that are NOT pinned still render as solid pills.
    // Active pinned filters render as solid pills (replace ghost).
    const activeNonPinned = value.filter(v => !pinned.some(d => d.field === v.field))

    const upsertFilter = (next: FilterValue) => {
        const without = value.filter(v => v.field !== next.field)
        onChange([...without, next])
    }

    const removeFilter = (field: string) => {
        onChange(value.filter(v => v.field !== field))
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            {/* Pinned filters — always shown */}
            {pinned.map((def) => {
                const active = filtersByField.get(def.field)
                return (
                    <FilterPill
                        key={def.field}
                        def={def}
                        active={active}
                        onApply={upsertFilter}
                        onClear={() => removeFilter(def.field)}
                    />
                )
            })}

            {/* Active non-pinned filters */}
            {activeNonPinned.map((f) => {
                const def = definitions.find(d => d.field === f.field)
                if (!def) return null
                return (
                    <FilterPill
                        key={def.field}
                        def={def}
                        active={f}
                        onApply={upsertFilter}
                        onClear={() => removeFilter(def.field)}
                    />
                )
            })}

            {/* Add filter button */}
            <AddFilterPicker
                definitions={definitions}
                excludeFields={new Set(value.map(v => v.field))}
                onPick={(def) => {
                    const op = def.defaultOperator ?? DEFAULT_OPERATOR[def.type]
                    upsertFilter({ field: def.field, operator: op, value: defaultValueFor(def.type) })
                }}
            />

            {hasActive && (
                <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Clear all
                </button>
            )}
        </div>
    )
}

function defaultValueFor(type: FilterDefinition["type"]): FilterValue["value"] {
    switch (type) {
        case "multi-select": return []
        case "boolean": return true
        case "date-range": return [null, null]
        default: return ""
    }
}

/* ────────────────────────────────────────────────────────────────── */
/* FilterPill — single filter chip                                     */
/* ────────────────────────────────────────────────────────────────── */

interface FilterPillProps {
    def: FilterDefinition
    active?: FilterValue
    onApply: (next: FilterValue) => void
    onClear: () => void
}

function FilterPill({ def, active, onApply, onClear }: FilterPillProps) {
    const [open, setOpen] = React.useState(false)

    const isActive = active != null && !isEmptyValue(active.value)
    const labelValue = isActive ? renderActiveLabel(def, active!) : null

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-medium transition-all",
                        isActive
                            ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
                            : "bg-muted/60 text-muted-foreground border border-border hover:bg-muted hover:text-foreground border-dashed",
                    )}
                >
                    <Filter className={cn("h-3 w-3", !isActive && "opacity-60")} />
                    <span>
                        {def.label}
                        {isActive && <span className="text-foreground/70 font-normal">: </span>}
                        {isActive && <span className="text-foreground font-semibold">{labelValue}</span>}
                    </span>
                    {isActive && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear() }}
                            className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                            aria-label={`Remove ${def.label} filter`}
                        >
                            <X className="h-3 w-3" />
                        </span>
                    )}
                    {!isActive && <ChevronDown className="h-3 w-3 opacity-60" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
                <FilterEditor
                    def={def}
                    current={active}
                    onApply={(next) => { onApply(next); setOpen(false) }}
                    onClear={() => { onClear(); setOpen(false) }}
                />
            </PopoverContent>
        </Popover>
    )
}

function isEmptyValue(v: FilterValue["value"]): boolean {
    if (v == null) return true
    if (typeof v === "string") return v === ""
    if (Array.isArray(v)) return v.length === 0 || v.every(x => x == null || x === "")
    if (typeof v === "boolean") return false // boolean is always meaningful
    return false
}

function renderActiveLabel(def: FilterDefinition, f: FilterValue): string {
    if (f.operator === "is_empty") return "is empty"
    if (f.operator === "is_not_empty") return "is set"
    if (f.operator === "is_true") return "yes"
    if (f.operator === "is_false") return "no"
    if (def.type === "select" || def.type === "multi-select") {
        const opts = resolveOptions(def)
        if (Array.isArray(f.value)) {
            const labels = (f.value as string[]).map(v => opts.find(o => o.value === v)?.label ?? v)
            return labels.length <= 2 ? labels.join(", ") : `${labels.length} selected`
        }
        const opt = opts.find(o => o.value === f.value)
        return opt?.label ?? String(f.value)
    }
    if (def.type === "date-range") {
        const [from, to] = (f.value as [string | null, string | null]) ?? [null, null]
        if (from && to) return `${from} → ${to}`
        if (from) return `from ${from}`
        if (to) return `until ${to}`
        return "any date"
    }
    return String(f.value ?? "")
}

/* ────────────────────────────────────────────────────────────────── */
/* FilterEditor — popover content                                      */
/* ────────────────────────────────────────────────────────────────── */

interface FilterEditorProps {
    def: FilterDefinition
    current?: FilterValue
    onApply: (next: FilterValue) => void
    onClear: () => void
}

function FilterEditor({ def, current, onApply, onClear }: FilterEditorProps) {
    const [op, setOp] = React.useState<FilterOperator>(current?.operator ?? def.defaultOperator ?? DEFAULT_OPERATOR[def.type])
    const [val, setVal] = React.useState<FilterValue["value"]>(current?.value ?? defaultValueFor(def.type))
    const operators = ALLOWED_OPERATORS[def.type]

    const requiresValue = !["is_empty", "is_not_empty", "is_true", "is_false"].includes(op)

    return (
        <div className="space-y-3">
            <div className="text-[11px] font-semibold text-muted-foreground tracking-wide">{def.label}</div>

            {operators.length > 1 && (
                <SearchableSelect
                    value={op}
                    onChange={(v) => v && setOp(v as FilterOperator)}
                    options={operators.map(o => ({ value: o, label: OPERATOR_LABELS[o] }))}
                    clearable={false}
                    placeholder="Operator"
                />
            )}

            {requiresValue && def.type === "text" && (
                <Input
                    autoFocus
                    placeholder="Value…"
                    value={(val as string) ?? ""}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onApply({ field: def.field, operator: op, value: val }) }}
                    className="h-9 text-sm"
                />
            )}

            {requiresValue && def.type === "select" && (
                <SearchableSelect
                    value={(val as string) || null}
                    onChange={(v) => setVal(v ?? "")}
                    options={resolveOptions(def)}
                    placeholder="Choose…"
                />
            )}

            {requiresValue && def.type === "multi-select" && (
                <MultiSelectChips
                    options={resolveOptions(def)}
                    value={(val as string[]) ?? []}
                    onChange={(v) => setVal(v)}
                />
            )}

            {requiresValue && def.type === "date-range" && (
                <DateRangeFields
                    value={(val as [string | null, string | null]) ?? [null, null]}
                    onChange={(v) => setVal(v)}
                    operator={op}
                />
            )}

            <div className="flex items-center justify-between pt-1">
                {current && (
                    <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive">
                        Remove
                    </button>
                )}
                <Button
                    type="button"
                    size="sm"
                    onClick={() => onApply({ field: def.field, operator: op, value: requiresValue ? val : null })}
                    className="ml-auto h-7 text-xs"
                >
                    Apply
                </Button>
            </div>
        </div>
    )
}

function MultiSelectChips({
    options,
    value,
    onChange,
}: {
    options: FilterOption[]
    value: string[]
    onChange: (v: string[]) => void
}) {
    const toggle = (v: string) => {
        if (value.includes(v)) onChange(value.filter(x => x !== v))
        else onChange([...value, v])
    }
    return (
        <div className="max-h-44 overflow-y-auto border border-border rounded-md p-1 space-y-0.5">
            {options.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No options</p>
            ) : (
                options.map((opt) => {
                    const checked = value.includes(opt.value)
                    return (
                        <label
                            key={opt.value}
                            className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors",
                                checked ? "bg-primary/10 text-primary" : "hover:bg-muted",
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(opt.value)}
                                className="h-3.5 w-3.5 rounded border-border accent-primary"
                            />
                            <span className="truncate">{opt.label}</span>
                        </label>
                    )
                })
            )}
        </div>
    )
}

function DateRangeFields({
    value,
    onChange,
    operator,
}: {
    value: [string | null, string | null]
    onChange: (v: [string | null, string | null]) => void
    operator: FilterOperator
}) {
    const [from, to] = value
    if (operator === "before") {
        return <Input type="date" value={to ?? ""} onChange={(e) => onChange([from, e.target.value || null])} className="h-9 text-sm" />
    }
    if (operator === "after") {
        return <Input type="date" value={from ?? ""} onChange={(e) => onChange([e.target.value || null, to])} className="h-9 text-sm" />
    }
    return (
        <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from ?? ""} onChange={(e) => onChange([e.target.value || null, to])} className="h-9 text-sm" />
            <Input type="date" value={to ?? ""} onChange={(e) => onChange([from, e.target.value || null])} className="h-9 text-sm" />
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────── */
/* AddFilterPicker — opens list of remaining (non-active) defs         */
/* ────────────────────────────────────────────────────────────────── */

interface AddFilterPickerProps {
    definitions: FilterDefinition[]
    excludeFields: Set<string>
    onPick: (def: FilterDefinition) => void
}

function AddFilterPicker({ definitions, excludeFields, onPick }: AddFilterPickerProps) {
    const [open, setOpen] = React.useState(false)
    const remaining = definitions.filter(d => !excludeFields.has(d.field))

    if (remaining.length === 0) return null

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-full"
                >
                    <Plus className="h-3 w-3" />
                    Add filter
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search filters…" />
                    <CommandList>
                        <CommandEmpty>No filters available</CommandEmpty>
                        <CommandGroup>
                            {remaining.map((d) => (
                                <CommandItem
                                    key={d.field}
                                    value={d.label}
                                    onSelect={() => { onPick(d); setOpen(false) }}
                                >
                                    <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                    {d.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
