"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileOption { id: string; full_name: string | null; role: string; department: string | null }

interface ProfileComboboxProps {
    value: string | null
    onChange: (id: string | null) => void
    filterTierBelow?: number
    placeholder?: string
    disabled?: boolean
}

export function ProfileCombobox({ value, onChange, filterTierBelow, placeholder = "Select person...", disabled }: ProfileComboboxProps) {
    const [open, setOpen] = useState(false)
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const supabase = createClient()

    useEffect(() => {
        const fetch = async () => {
            let q = supabase.from("profiles").select("id, full_name, role, department, role_tier").eq("is_active", true).order("full_name")
            if (filterTierBelow) q = q.lt("role_tier", filterTierBelow)
            const { data } = await q
            setProfiles((data as ProfileOption[]) || [])
        }
        fetch()
    }, [filterTierBelow])

    const selected = profiles.find((p) => p.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
                    className="w-full justify-between h-9 text-sm font-normal">
                    {selected ? (
                        <span className="flex items-center gap-2 truncate">
                            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {selected.full_name || selected.id.slice(0, 8)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search by name..." />
                    <CommandList>
                        <CommandEmpty>No profiles found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false) }}>
                                <span className="text-muted-foreground italic">Clear selection</span>
                            </CommandItem>
                            {profiles.map((p) => (
                                <CommandItem key={p.id} value={`${p.full_name} ${p.role} ${p.department}`}
                                    onSelect={() => { onChange(p.id); setOpen(false) }}>
                                    <Check className={cn("mr-2 h-3.5 w-3.5", value === p.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{p.full_name || "Unnamed"}</p>
                                        <p className="text-xs text-muted-foreground">{p.role}{p.department ? ` · ${p.department}` : ""}</p>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
