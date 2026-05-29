"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileOption {
    value: string
    label: string
    role: string | null
}

interface ProfileComboboxProps {
    value?: string | null
    onChange: (id: string | null) => void
    filterTierBelow?: number
    filterRoles?: string[]
    placeholder?: string
    disabled?: boolean
}

// Get initials from full name — e.g. "Hanung Sastria" → "HS"
function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? "")
        .join("")
}

// Deterministic avatar color from name hash
function getAvatarColor(name: string): string {
    const colors = [
        "bg-blue-100 text-blue-700",
        "bg-emerald-100 text-emerald-700",
        "bg-amber-100 text-amber-700",
        "bg-violet-100 text-violet-700",
        "bg-rose-100 text-rose-700",
        "bg-cyan-100 text-cyan-700",
        "bg-orange-100 text-orange-700",
        "bg-pink-100 text-pink-700",
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
    return colors[Math.abs(hash) % colors.length]
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
                .select("id, full_name, role_tier, role")
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
                if (filterTierBelow && (p.role_tier == null || p.role_tier >= filterTierBelow)) return false
                if (allowedRoles && !allowedRoles.includes(p.role)) return false
                return true
            })

            setProfiles(
                filtered.map((p) => ({
                    value: p.id,
                    label: p.full_name || "Unnamed User",
                    role: p.role,
                }))
            )
            setIsLoading(false)
        }

        fetchProfiles()
    }, [filterTierBelow, filterRolesKey])

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
                            <span className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
                                getAvatarColor(selected.label)
                            )}>
                                {getInitials(selected.label)}
                            </span>
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
                                        <span className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                            getAvatarColor(p.label)
                                        )}>
                                            {getInitials(p.label)}
                                        </span>
                                        <span className="flex-1 min-w-0 flex flex-col">
                                            <span className="text-[13px] text-foreground truncate">{p.label}</span>
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
