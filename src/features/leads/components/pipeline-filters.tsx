import { useState, useMemo } from "react"
import { Filter, X, Check, Users, Tags, Building, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Lead } from "@/types"

export type PipelineFilterState = {
    pics: string[];
    categories: string[];
    streams: string[];
    minValue: string;
    maxValue: string;
}

export const INITIAL_FILTER_STATE: PipelineFilterState = {
    pics: [],
    categories: [],
    streams: [],
    minValue: "",
    maxValue: ""
}

interface PipelineFiltersProps {
    leads: Lead[]
    filters: PipelineFilterState
    setFilters: React.Dispatch<React.SetStateAction<PipelineFilterState>>
}

export function PipelineFilters({ leads, filters, setFilters }: PipelineFiltersProps) {
    const [open, setOpen] = useState(false)

    // Compute dynamic options based on available leads in the current pipeline
    const uniquePics = useMemo(() => {
        const map = new Map<string, string>()
        leads.forEach(l => {
            const id = l.pic_sales_id || "unassigned"
            const name = l.pic_sales_profile?.full_name || "Unassigned"
            if (!map.has(id)) map.set(id, name)
        })
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name))
    }, [leads])

    const uniqueCategories = useMemo(() => {
        const set = new Set<string>()
        leads.forEach(l => {
            set.add(l.category || "Uncategorized")
        })
        return Array.from(set).sort()
    }, [leads])

    const uniqueStreams = useMemo(() => {
        const set = new Set<string>()
        leads.forEach(l => {
            set.add(l.main_stream || "Uncategorized")
        })
        return Array.from(set).sort()
    }, [leads])

    const activeCount = 
        filters.pics.length + 
        filters.categories.length + 
        filters.streams.length + 
        (filters.minValue ? 1 : 0) + 
        (filters.maxValue ? 1 : 0)

    const handleClear = () => {
        setFilters(INITIAL_FILTER_STATE)
    }

    const togglePic = (id: string) => {
        setFilters(p => ({
            ...p,
            pics: p.pics.includes(id) ? p.pics.filter(x => x !== id) : [...p.pics, id]
        }))
    }

    const toggleCategory = (cat: string) => {
        setFilters(p => ({
            ...p,
            categories: p.categories.includes(cat) ? p.categories.filter(x => x !== cat) : [...p.categories, cat]
        }))
    }

    const toggleStream = (stream: string) => {
        setFilters(p => ({
            ...p,
            streams: p.streams.includes(stream) ? p.streams.filter(x => x !== stream) : [...p.streams, stream]
        }))
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant={activeCount > 0 ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-8 gap-y-0 gap-x-1.5 px-2.5 font-medium relative text-xs"
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
            <PopoverContent className="w-[340px] p-0" align="end" sideOffset={8}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h4 className="text-[13px] font-bold text-slate-800">Advanced Filters</h4>
                        <p className="text-[11px] text-slate-500">Refine pipeline results</p>
                    </div>
                    {activeCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-[11px] px-2 text-slate-500 hover:text-slate-900">
                            Clear all
                        </Button>
                    )}
                </div>

                <div className="p-4 space-y-5 max-h-[460px] overflow-y-auto">
                    {/* PIC filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[12px] font-semibold text-slate-700">PIC / Owner</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {uniquePics.map(pic => {
                                const active = filters.pics.includes(pic.id)
                                return (
                                    <button
                                        key={pic.id}
                                        onClick={() => togglePic(pic.id)}
                                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
                                            active 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {pic.name}
                                        {active && <Check className="h-3 w-3 ml-0.5" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100/80 w-full shrink-0" />

                    {/* Category Filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Tags className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[12px] font-semibold text-slate-700">Category / Grade</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {uniqueCategories.map(cat => {
                                const active = filters.categories.includes(cat)
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
                                            active 
                                            ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {cat}
                                        {active && <Check className="h-3 w-3 ml-0.5" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100/80 w-full shrink-0" />

                    {/* Stream Filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Building className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[12px] font-semibold text-slate-700">Main Stream</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {uniqueStreams.map(stream => {
                                const active = filters.streams.includes(stream)
                                return (
                                    <button
                                        key={stream}
                                        onClick={() => toggleStream(stream)}
                                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
                                            active 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {stream}
                                        {active && <Check className="h-3 w-3 ml-0.5" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100/80 w-full shrink-0" />

                    {/* Value Filter */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 mb-2">
                            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[12px] font-semibold text-slate-700">Est. Pipeline Value</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-medium">Min</label>
                                <Input 
                                    placeholder="Rp 0" 
                                    className="h-8 text-xs px-2 bg-slate-50 border-slate-200" 
                                    value={filters.minValue}
                                    onChange={(e) => setFilters(p => ({ ...p, minValue: e.target.value.replace(/[^0-9]/g, '') }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-medium">Max</label>
                                <Input 
                                    placeholder="No limit" 
                                    className="h-8 text-xs px-2 bg-slate-50 border-slate-200" 
                                    value={filters.maxValue}
                                    onChange={(e) => setFilters(p => ({ ...p, maxValue: e.target.value.replace(/[^0-9]/g, '') }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
