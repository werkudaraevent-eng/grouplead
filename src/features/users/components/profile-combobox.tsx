"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileOption {
    value: string
    label: string
}

interface ProfileComboboxProps {
    value?: string | null
    onChange: (id: string | null) => void
    filterTierBelow?: number
    filterRoles?: string[]
    placeholder?: string
    disabled?: boolean
}

export function ProfileCombobox({ value, onChange, filterTierBelow, filterRoles, placeholder = "Select user...", disabled }: ProfileComboboxProps) {
    const [open, setOpen] = useState(false)
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        const fetchProfiles = async () => {
            setIsLoading(true)

            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, role_tier, role")

            if (error) {
                console.error("Supabase Fetch Error:", error.message)
                toast.error(error.message)
                setProfiles([])
                setIsLoading(false)
                return
            }

            const filtered = (data ?? []).filter((p) => {
                if (filterTierBelow && (p.role_tier == null || p.role_tier >= filterTierBelow)) return false
                if (filterRoles && !filterRoles.includes(p.role)) return false
                return true
            })

            setProfiles(
                filtered.map((p) => ({
                    value: p.id,
                    label: p.full_name || "Unnamed User",
                }))
            )
            setIsLoading(false)
        }

        fetchProfiles()
    }, [filterTierBelow, filterRoles])

    const selected = profiles.find((p) => p.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled || isLoading}
                    className="w-full justify-between h-9 text-sm font-normal overflow-hidden">
                    {isLoading ? (
                        <span className="text-muted-foreground truncate flex-1 text-left">Loading users...</span>
                    ) : selected ? (
                        <span className="flex items-center gap-2 truncate flex-1 text-left">
                            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{selected.label}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground truncate flex-1 text-left">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 pointer-events-auto" align="start">
                <Command>
                    <CommandInput placeholder="Search by name..." />
                    <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
                        <CommandEmpty>No profiles found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false) }}>
                                <span className="text-muted-foreground italic">Clear selection</span>
                            </CommandItem>
                            {profiles.map((p) => (
                                <CommandItem key={p.value} value={p.label}
                                    onSelect={() => { onChange(p.value); setOpen(false) }}>
                                    <Check className={cn("mr-2 h-3.5 w-3.5", value === p.value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{p.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
