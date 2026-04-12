"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Pencil, Loader2, Search } from "lucide-react"

interface Profile {
    id: string
    full_name: string
}

interface HeaderAssigneePopoverProps {
    leadId: number
    fieldPath: string
    label: string
    displayValue: string
    rawValue: string | null | undefined
}

export function HeaderAssigneePopover({
    leadId,
    fieldPath,
    label,
    displayValue,
    rawValue,
}: HeaderAssigneePopoverProps) {
    const supabase = createClient()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setSearch("")
            fetchProfiles()
        }
    }, [open])

    const fetchProfiles = async () => {
        setLoading(true)
        const { data } = await supabase.from("profiles").select("id, full_name").order("full_name")
        if (data) setProfiles(data)
        setLoading(false)
    }

    const handleSave = async (selectedId: string | null) => {
        setSavingId(selectedId || 'unassign')
        const payload: Record<string, unknown> = {}
        payload[fieldPath] = selectedId

        const { error } = await supabase
            .from("leads")
            .update(payload)
            .eq("id", leadId)

        if (error) {
            toast.error(`Update failed: ${error.message}`)
        } else {
            toast.success(`${label} updated`)
            router.refresh()
            setOpen(false)
        }
        setSavingId(null)
    }

    const filtered = profiles.filter(p => !search || p.full_name?.toLowerCase().includes(search.toLowerCase()))

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="group flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 hover:text-blue-600 transition-colors rounded px-1.5 py-0.5 -mx-1.5 hover:bg-blue-50">
                    <span className="truncate max-w-[150px] text-left block" title={displayValue}>{displayValue}</span>
                    <Pencil className="h-3 w-3 shrink-0 text-transparent group-hover:text-blue-500 transition-colors" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 p-0 shadow-lg"
                align="start"
                sideOffset={8}
            >
                <div className="flex flex-col">
                    <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <input 
                            className="text-[13px] flex-1 outline-none placeholder-slate-400 bg-transparent" 
                            placeholder="Search user..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                        {loading && <div className="p-3 text-center text-[12px] text-slate-400">Loading...</div>}
                        {!loading && filtered.length === 0 && <div className="p-3 text-center text-[12px] text-slate-400">No users found</div>}
                        {!loading && filtered.map(p => (
                            <button
                                key={p.id}
                                disabled={savingId !== null}
                                onClick={() => handleSave(p.id)}
                                className={`w-full flex items-center justify-between text-left px-3 py-2 text-[13px] hover:bg-slate-50 transition-colors ${p.id === rawValue ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                            >
                                <span className="truncate">{p.full_name || 'Unnamed User'}</span>
                                {savingId === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0 ml-2" />}
                            </button>
                        ))}
                        {!loading && !search && rawValue && (
                            <button
                                onClick={() => handleSave(null)}
                                disabled={savingId !== null}
                                className="w-full border-t border-slate-100 mt-1 flex items-center justify-between text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <span>Unassign</span>
                                {savingId === 'unassign' && <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600 shrink-0 ml-2" />}
                            </button>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
