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
    value: string | null
    onChange: (id: string | null) => void
    placeholder?: string
    disabled?: boolean
}

export function ProfileCombobox({ value, onChange, placeholder = "Select person...", disabled }: ProfileComboboxProps) {
    const [open, setOpen] = useState(false)
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()

        const fetchProfiles = async () => {
            setIsLoading(true)

            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name")

            if (error) {
                console.error("Supabase Fetch Error:", error.message)
                toast.error(error.message)
                setProfiles([])
                setIsLoading(false)
                return
            }

            console.log("Profiles fetched:", data?.length ?? 0, data)

            setProfiles(
                (data ?? []).map((p) => ({
                    value: p.id,
                    label: p.full_name || "Unnamed User",
                }))
            )
            setIsLoading(false)
        }

        fetchProfiles()
    }, [])

    const selected = profiles.find((p) => p.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled || isLoading}
                    className="w-full justify-between h-9 text-sm font-normal">
                    {isLoading ? (
                        <span className="text-muted-foreground">Loading users...</span>
                    ) : selected ? (
                        <span className="flex items-center gap-2 truncate">
                            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {selected.label}
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
