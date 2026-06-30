"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/avatar"

interface ProfileOption {
    value: string
    label: string
    role: string | null
    isActive: boolean
    avatarUrl: string | null
}

interface ProfileComboboxProps {
    value?: string | null
    onChange: (id: string | null) => void
    filterTierBelow?: number
    filterRoles?: string[]
    placeholder?: string
    disabled?: boolean
}

// Human-readable role labels
const ROLE_LABELS: Record<string, string> = {
    sales: "Sales",
    bu_manager: "BU Manager",
    admin: "Admin",
    super_admin: "Super Admin",
    staff: "Staff",
    leader: "Leader",
    executive: "Executive",
}

export function ProfileCombobox({ value, onChange, filterTierBelow, filterRoles, placeholder = "Select user...", disabled }: ProfileComboboxProps) {
    const [open, setOpen] = useState(false)
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Serialize array prop to a stable key so useEffect doesn't fire on
    // every parent render (e.g. typing in another form field). Without this
    // the combobox refetches profiles continuously and "flickers" between
    // its loading and ready states.
    const filterRolesKey = filterRoles ? filterRoles.join(",") : ""

    useEffect(() => {
        const supabase = createClient()

        const fetchProfiles = async () => {
            setIsLoading(true)

            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, role_tier, role, is_active, avatar_url")
                .order("full_name", { ascending: true })

            if (error) {
                console.error("Supabase Fetch Error:", error.message)
                toast.error(error.message)
                setProfiles([])
                setIsLoading(false)
                return
            }

            const allowedRoles = filterRolesKey ? filterRolesKey.split(",") : null
            const filtered = (data ?? []).filter((p) => {
                // Always keep the currently-selected value, even if it falls
                // outside the role/tier/active filters (e.g. a contact owned by
                // a super_admin while the picker only lists sales/bu_manager).
                // Otherwise the field renders empty despite having a value.
                if (p.id === value) return true
                if (filterTierBelow && (p.role_tier == null || p.role_tier >= filterTierBelow)) return false
                if (allowedRoles && !allowedRoles.includes(p.role)) return false
                // Hide deactivated users so they can't be assigned to new leads.
                if (p.is_active === false) return false
                return true
            })

            setProfiles(
                filtered.map((p) => ({
                    value: p.id,
                    label: p.full_name || "Unnamed User",
                    role: p.role,
                    isActive: p.is_active !== false,
                    avatarUrl: (p as { avatar_url?: string | null }).avatar_url ?? null,
                }))
            )
            setIsLoading(false)
        }

        fetchProfiles()
    }, [filterTierBelow, filterRolesKey, value])

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
                            {selected.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selected.avatarUrl} alt={selected.label} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                                <span className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
                                    getAvatarColor(selected.label)
                                )}>
                                    {getInitials(selected.label)}
                                </span>
                            )}
                            <span className="truncate">{selected.label}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground truncate flex-1 text-left">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 pointer-events-auto" align="start">
                <Command>
                    <CommandInput placeholder="Search by name..." className="h-9" />
                    <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No profiles found.</CommandEmpty>
                        <CommandGroup>
                            {profiles.map((p) => {
                                const isSelected = value === p.value
                                return (
                                    <CommandItem
                                        key={p.value}
                                        value={p.label}
                                        onSelect={() => { onChange(p.value); setOpen(false) }}
                                        className="flex items-center gap-2.5 py-2"
                                    >
                                        {p.avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={p.avatarUrl} alt={p.label} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <span className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                                getAvatarColor(p.label)
                                            )}>
                                                {getInitials(p.label)}
                                            </span>
                                        )}
                                        <span className="flex-1 min-w-0 flex flex-col">
                                            <span className="text-[13px] text-foreground truncate">
                                                {p.label}
                                                {!p.isActive && (
                                                    <span className="ml-1.5 text-[10px] text-amber-600">(inactive)</span>
                                                )}
                                            </span>
                                            {p.role && (
                                                <span className="text-[10.5px] text-muted-foreground truncate">
                                                    {ROLE_LABELS[p.role] ?? p.role}
                                                </span>
                                            )}
                                        </span>
                                        <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        {value && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        value="__clear__"
                                        onSelect={() => { onChange(null); setOpen(false) }}
                                        className="flex items-center gap-2.5 py-2 text-muted-foreground"
                                    >
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-muted shrink-0">
                                            <X className="h-3 w-3" />
                                        </span>
                                        <span className="text-[13px]">Clear selection</span>
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
