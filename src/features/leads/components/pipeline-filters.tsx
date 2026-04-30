import { useState, useMemo, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import {
    Filter, X, Plus, Trash2, Check, ChevronDown,
    User, Tags, Building, DollarSign, Calendar, FileText,
    MapPin, Globe, Briefcase, Hash, Layers, Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Lead } from "@/types"

// ════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════

export type FilterRule = {
    id: string
    field: string
    operator: string
    value: string[]   // always array: for multi-select, numbers stored as ["500000"]
}

export type PipelineFilterState = {
    rules: FilterRule[]
}

export const INITIAL_FILTER_STATE: PipelineFilterState = {
    rules: []
}

type FieldType = 'enum' | 'person' | 'number' | 'date' | 'text'

type FilterFieldConfig = {
    key: string
    label: string
    icon: typeof Filter
    type: FieldType
    getOptions?: (leads: Lead[]) => string[]
}

// ════════════════════════════════════════════════════════════════════
//  FIELD REGISTRY — all filterable lead columns
// ════════════════════════════════════════════════════════════════════

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        key: 'pic_sales',
        label: 'PIC Sales',
        icon: User,
        type: 'person',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.pic_sales_profile?.full_name) set.add(l.pic_sales_profile.full_name) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'account_manager',
        label: 'Account Manager',
        icon: User,
        type: 'person',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.account_manager_profile?.full_name) set.add(l.account_manager_profile.full_name) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'category',
        label: 'Category',
        icon: Tags,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.category) set.add(l.category) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'grade_lead',
        label: 'Grade',
        icon: Tags,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.grade_lead) set.add(l.grade_lead) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'pipeline_stage',
        label: 'Stage',
        icon: Layers,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => {
                const name = l.pipeline_stage?.name || l.status
                if (name) set.add(name)
            })
            return Array.from(set).sort()
        }
    },
    {
        key: 'main_stream',
        label: 'Main Stream',
        icon: Building,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.main_stream) set.add(l.main_stream) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'stream_type',
        label: 'Stream Type',
        icon: Building,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.stream_type) set.add(l.stream_type) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'event_format',
        label: 'Event Format',
        icon: Globe,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.event_format) set.add(l.event_format) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'subsidiary',
        label: 'Subsidiary',
        icon: Building,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.company?.name) set.add(l.company.name) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'lead_source',
        label: 'Lead Source',
        icon: MapPin,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.lead_source) set.add(l.lead_source) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'business_purpose',
        label: 'Business Purpose',
        icon: Briefcase,
        type: 'enum',
        getOptions: (leads) => {
            const set = new Set<string>()
            leads.forEach(l => { if (l.business_purpose) set.add(l.business_purpose) })
            return Array.from(set).sort()
        }
    },
    {
        key: 'estimated_value',
        label: 'Estimated Value',
        icon: DollarSign,
        type: 'number',
    },
    {
        key: 'actual_value',
        label: 'Actual Value',
        icon: DollarSign,
        type: 'number',
    },
    {
        key: 'pax_count',
        label: 'Pax Count',
        icon: Hash,
        type: 'number',
    },
    {
        key: 'target_close_date',
        label: 'Target Close Date',
        icon: Calendar,
        type: 'date',
    },
    {
        key: 'client_company',
        label: 'Client',
        icon: Building,
        type: 'text',
    },
    {
        key: 'project_name',
        label: 'Project',
        icon: FileText,
        type: 'text',
    },
    {
        key: 'referral_source',
        label: 'Referral Source',
        icon: User,
        type: 'text',
    },
]

// ── Operators per field type ──
const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
    enum: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_none_of', label: 'is none of' },
    ],
    person: [
        { value: 'is_any_of', label: 'is any of' },
        { value: 'is_none_of', label: 'is none of' },
    ],
    number: [
        { value: 'eq', label: '=' },
        { value: 'gt', label: '>' },
        { value: 'gte', label: '≥' },
        { value: 'lt', label: '<' },
        { value: 'lte', label: '≤' },
    ],
    date: [
        { value: 'after', label: 'after' },
        { value: 'before', label: 'before' },
        { value: 'on', label: 'on' },
    ],
    text: [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'eq', label: 'is' },
    ],
}

// ────────────────────────────────────────────────────────────────────
//  HELPER COMPONENTS
// ────────────────────────────────────────────────────────────────────

function SmallDropdown({
    value,
    options,
    onChange,
    placeholder = "Select...",
    className = "",
    searchable = false,
}: {
    value: string
    options: { value: string; label: string }[]
    onChange: (v: string) => void
    placeholder?: string
    className?: string
    searchable?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ top: 0, left: 0 })

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return
            if (menuRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + 4, left: rect.left })
        }
        setOpen(!open)
    }

    const filtered = search
        ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : options

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder

    return (
        <div className={`${className}`}>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors text-slate-700 whitespace-nowrap min-w-0"
            >
                <span className="truncate max-w-[100px]">{selectedLabel}</span>
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl min-w-[180px] max-h-[260px] overflow-hidden flex flex-col"
                    style={{ top: pos.top, left: pos.left }}
                >
                    {searchable && (
                        <div className="p-1.5 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded border border-slate-200">
                                <Search className="h-3 w-3 text-slate-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="text-[11px] bg-transparent outline-none w-full text-slate-700 placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-slate-400">No options</div>
                        )}
                        {filtered.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false); setSearch("") }}
                                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                                    opt.value === value ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-600'
                                }`}
                            >
                                {opt.label}
                                {opt.value === value && <Check className="h-3 w-3 ml-auto" />}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

/** Multi-select chip picker for enum/person fields */
function ChipPicker({
    selected,
    options,
    onChange,
}: {
    selected: string[]
    options: string[]
    onChange: (val: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return
            if (menuRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) })
        }
        setOpen(!open)
    }

    const filtered = search
        ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
        : options

    const toggle = (val: string) => {
        if (selected.includes(val)) onChange(selected.filter(v => v !== val))
        else onChange([...selected, val])
    }

    return (
        <div className="flex-1 min-w-0">
            <button
                ref={btnRef}
                onClick={handleOpen}
                className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors w-full min-h-[28px]"
            >
                {selected.length === 0 ? (
                    <span className="text-slate-400">Select values...</span>
                ) : (
                    <div className="flex flex-wrap gap-1 min-w-0">
                        {selected.slice(0, 2).map(v => (
                            <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-200 max-w-[80px] truncate">
                                {v}
                                <X
                                    className="h-2.5 w-2.5 shrink-0 cursor-pointer hover:text-blue-900"
                                    onClick={(e) => { e.stopPropagation(); toggle(v) }}
                                />
                            </span>
                        ))}
                        {selected.length > 2 && (
                            <span className="text-[10px] text-slate-500 font-medium">+{selected.length - 2}</span>
                        )}
                    </div>
                )}
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-auto" />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl max-h-[280px] overflow-hidden flex flex-col"
                    style={{ top: pos.top, left: pos.left, width: pos.width }}
                >
                    <div className="p-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded border border-slate-200">
                            <Search className="h-3 w-3 text-slate-400 shrink-0" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="text-[11px] bg-transparent outline-none w-full text-slate-700 placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-slate-400">No options found</div>
                        )}
                        {filtered.map(opt => {
                            const isActive = selected.includes(opt)
                            return (
                                <button
                                    key={opt}
                                    onClick={() => toggle(opt)}
                                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                                        isActive ? 'text-blue-700 font-medium' : 'text-slate-600'
                                    }`}
                                >
                                    <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        isActive ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                    }`}>
                                        {isActive && <Check className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                    <span className="truncate">{opt}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════
//  FILTER ROW COMPONENT
// ════════════════════════════════════════════════════════════════════

function FilterRow({
    rule,
    leads,
    onUpdate,
    onRemove,
}: {
    rule: FilterRule
    leads: Lead[]
    onUpdate: (rule: FilterRule) => void
    onRemove: () => void
}) {
    const fieldConfig = FILTER_FIELDS.find(f => f.key === rule.field)
    if (!fieldConfig) return null

    const operators = OPERATORS[fieldConfig.type]
    const options = fieldConfig.getOptions ? fieldConfig.getOptions(leads) : []
    const FieldIcon = fieldConfig.icon

    return (
        <div className="flex items-start gap-1.5 group animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {/* Field icon */}
            <div className="flex items-center justify-center h-[28px] w-5 shrink-0">
                <FieldIcon className="h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Field selector */}
            <SmallDropdown
                value={rule.field}
                options={FILTER_FIELDS.map(f => ({ value: f.key, label: f.label }))}
                onChange={(v) => {
                    const newConfig = FILTER_FIELDS.find(f => f.key === v)
                    const newOps = newConfig ? OPERATORS[newConfig.type] : []
                    onUpdate({
                        ...rule,
                        field: v,
                        operator: newOps[0]?.value || 'is_any_of',
                        value: []
                    })
                }}
                searchable
            />

            {/* Operator */}
            <SmallDropdown
                value={rule.operator}
                options={operators}
                onChange={(v) => onUpdate({ ...rule, operator: v })}
            />

            {/* Value input — context-aware */}
            {(fieldConfig.type === 'enum' || fieldConfig.type === 'person') && (
                <ChipPicker
                    selected={rule.value}
                    options={options}
                    onChange={(val) => onUpdate({ ...rule, value: val })}
                />
            )}

            {fieldConfig.type === 'number' && (
                <Input
                    type="text"
                    placeholder="0"
                    className="h-[28px] text-[11px] px-2 w-[110px] bg-white border-slate-200"
                    value={rule.value[0] || ''}
                    onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9]/g, '')
                        onUpdate({ ...rule, value: cleaned ? [cleaned] : [] })
                    }}
                />
            )}

            {fieldConfig.type === 'date' && (
                <Input
                    type="date"
                    className="h-[28px] text-[11px] px-2 w-[130px] bg-white border-slate-200"
                    value={rule.value[0] || ''}
                    onChange={(e) => onUpdate({ ...rule, value: e.target.value ? [e.target.value] : [] })}
                />
            )}

            {fieldConfig.type === 'text' && (
                <Input
                    type="text"
                    placeholder="Type value..."
                    className="h-[28px] text-[11px] px-2 flex-1 min-w-[100px] bg-white border-slate-200"
                    value={rule.value[0] || ''}
                    onChange={(e) => onUpdate({ ...rule, value: e.target.value ? [e.target.value] : [] })}
                />
            )}

            {/* Remove */}
            <button
                onClick={onRemove}
                className="flex items-center justify-center h-[28px] w-6 shrink-0 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE FILTERS COMPONENT
// ════════════════════════════════════════════════════════════════════

interface PipelineFiltersProps {
    leads: Lead[]
    filters: PipelineFilterState
    setFilters: React.Dispatch<React.SetStateAction<PipelineFilterState>>
}

export function PipelineFilters({ leads, filters, setFilters }: PipelineFiltersProps) {
    const [open, setOpen] = useState(false)

    const activeCount = filters.rules.filter(r => r.value.length > 0).length

    const addFilter = () => {
        // pick first field not already used, or allow duplicate
        const usedFields = filters.rules.map(r => r.field)
        const nextField = FILTER_FIELDS.find(f => !usedFields.includes(f.key)) || FILTER_FIELDS[0]
        const ops = OPERATORS[nextField.type]

        setFilters(prev => ({
            rules: [...prev.rules, {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                field: nextField.key,
                operator: ops[0]?.value || 'is_any_of',
                value: [],
            }]
        }))
    }

    const updateRule = (id: string, updated: FilterRule) => {
        setFilters(prev => ({
            rules: prev.rules.map(r => r.id === id ? updated : r)
        }))
    }

    const removeRule = (id: string) => {
        setFilters(prev => ({
            rules: prev.rules.filter(r => r.id !== id)
        }))
    }

    const clearAll = () => {
        setFilters({ rules: [] })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={activeCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 gap-y-0 gap-x-1.5 px-2.5 font-medium relative text-xs overflow-visible"
                >
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <span>Filter</span>
                    {activeCount > 0 && (
                        <span className="ml-1 px-1.5 py-0 min-w-[18px] h-4 text-[10px] flex items-center justify-center pointer-events-none absolute -top-1.5 -right-1.5 rounded-full bg-slate-900 text-slate-50 font-medium shadow-sm">
                            {activeCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="end" sideOffset={8}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                        <h4 className="text-[12px] font-semibold text-slate-700">Filters</h4>
                        {activeCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
                                {activeCount} active
                            </span>
                        )}
                    </div>
                    {filters.rules.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="text-[11px] text-slate-400 hover:text-slate-700 font-medium transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* Filter rows */}
                <div className="p-3 space-y-2 max-h-[380px] overflow-y-auto">
                    {filters.rules.length === 0 && (
                        <div className="flex flex-col items-center py-6 text-slate-400">
                            <Filter className="h-6 w-6 text-slate-200 mb-2" />
                            <span className="text-[12px] font-medium">No filters applied</span>
                            <span className="text-[11px] text-slate-300">Add a filter to refine results</span>
                        </div>
                    )}

                    {filters.rules.map((rule) => (
                        <FilterRow
                            key={rule.id}
                            rule={rule}
                            leads={leads}
                            onUpdate={(updated) => updateRule(rule.id, updated)}
                            onRemove={() => removeRule(rule.id)}
                        />
                    ))}
                </div>

                {/* Add filter button */}
                <div className="px-3 pb-3 pt-0">
                    <button
                        onClick={addFilter}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors w-full"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add filter
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ════════════════════════════════════════════════════════════════════
//  ACTIVE FILTER PILLS — displayed above table
// ════════════════════════════════════════════════════════════════════

export function ActiveFilterPills({
    filters,
    setFilters,
}: {
    filters: PipelineFilterState
    setFilters: React.Dispatch<React.SetStateAction<PipelineFilterState>>
}) {
    const activeRules = filters.rules.filter(r => r.value.length > 0)
    if (activeRules.length === 0) return null

    const removeRule = (id: string) => {
        setFilters(prev => ({
            rules: prev.rules.filter(r => r.id !== id)
        }))
    }

    const clearAll = () => setFilters({ rules: [] })

    return (
        <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 border-b border-slate-100 bg-slate-50/30">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Filters:</span>
            {activeRules.map(rule => {
                const field = FILTER_FIELDS.find(f => f.key === rule.field)
                const operator = OPERATORS[field?.type || 'enum'].find(o => o.value === rule.operator)
                const displayValue = rule.value.length > 2
                    ? `${rule.value.slice(0, 2).join(', ')} +${rule.value.length - 2}`
                    : rule.value.join(', ')

                return (
                    <span
                        key={rule.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-white border border-slate-200 rounded-full text-slate-600 hover:border-slate-300 transition-colors"
                    >
                        <span className="text-slate-400">{field?.label}</span>
                        <span className="text-slate-300">{operator?.label}</span>
                        <span className="text-slate-800 font-semibold max-w-[120px] truncate">{displayValue}</span>
                        <X
                            className="h-3 w-3 text-slate-300 hover:text-rose-500 cursor-pointer shrink-0"
                            onClick={() => removeRule(rule.id)}
                        />
                    </span>
                )
            })}
            <button
                onClick={clearAll}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-medium ml-1 transition-colors"
            >
                Clear all
            </button>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════
//  FILTER APPLICATION LOGIC — used by lead-dashboard
// ════════════════════════════════════════════════════════════════════

export function applyFilters(leads: Lead[], filters: PipelineFilterState): Lead[] {
    let result = leads

    for (const rule of filters.rules) {
        if (rule.value.length === 0) continue

        const field = FILTER_FIELDS.find(f => f.key === rule.field)
        if (!field) continue

        result = result.filter(lead => {
            // Get the lead's value for this field
            let leadValue: string | number | null = null

            switch (rule.field) {
                case 'pic_sales':
                    leadValue = lead.pic_sales_profile?.full_name || null
                    break
                case 'account_manager':
                    leadValue = lead.account_manager_profile?.full_name || null
                    break
                case 'category':
                    leadValue = lead.category
                    break
                case 'grade_lead':
                    leadValue = lead.grade_lead
                    break
                case 'pipeline_stage':
                    leadValue = lead.pipeline_stage?.name || lead.status || null
                    break
                case 'main_stream':
                    leadValue = lead.main_stream
                    break
                case 'stream_type':
                    leadValue = lead.stream_type
                    break
                case 'event_format':
                    leadValue = lead.event_format
                    break
                case 'subsidiary':
                    leadValue = lead.company?.name || null
                    break
                case 'lead_source':
                    leadValue = lead.lead_source
                    break
                case 'business_purpose':
                    leadValue = lead.business_purpose
                    break
                case 'estimated_value':
                    leadValue = lead.estimated_value
                    break
                case 'actual_value':
                    leadValue = lead.actual_value
                    break
                case 'pax_count':
                    leadValue = lead.pax_count
                    break
                case 'target_close_date':
                    leadValue = lead.target_close_date
                    break
                case 'client_company':
                    leadValue = lead.client_company?.name || null
                    break
                case 'project_name':
                    leadValue = lead.project_name
                    break
                case 'referral_source':
                    leadValue = lead.referral_source
                    break
                default:
                    return true
            }

            // Apply operator logic
            switch (rule.operator) {
                case 'is_any_of':
                    return leadValue != null && rule.value.includes(String(leadValue))
                case 'is_none_of':
                    return leadValue == null || !rule.value.includes(String(leadValue))
                case 'eq':
                    if (field.type === 'number') {
                        return (leadValue as number || 0) === parseFloat(rule.value[0])
                    }
                    return String(leadValue || '').toLowerCase() === rule.value[0].toLowerCase()
                case 'gt':
                    return (leadValue as number || 0) > parseFloat(rule.value[0])
                case 'gte':
                    return (leadValue as number || 0) >= parseFloat(rule.value[0])
                case 'lt':
                    return (leadValue as number || 0) < parseFloat(rule.value[0])
                case 'lte':
                    return (leadValue as number || 0) <= parseFloat(rule.value[0])
                case 'contains':
                    return String(leadValue || '').toLowerCase().includes(rule.value[0].toLowerCase())
                case 'not_contains':
                    return !String(leadValue || '').toLowerCase().includes(rule.value[0].toLowerCase())
                case 'after':
                    return leadValue != null && new Date(leadValue as string) > new Date(rule.value[0])
                case 'before':
                    return leadValue != null && new Date(leadValue as string) < new Date(rule.value[0])
                case 'on':
                    return leadValue != null && (leadValue as string).startsWith(rule.value[0])
                default:
                    return true
            }
        })
    }

    return result
}
