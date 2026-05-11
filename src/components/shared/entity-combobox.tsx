"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ChevronsUpDown, Check, Plus, Loader2, X, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ClientCompany, Contact } from "@/types"
import { AddCompanyModal } from "@/features/companies/components/add-company-modal"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"

// Get initials from name — e.g. "Bank Indonesia KP" → "BI"
function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? "")
        .join("") || "?"
}

// Deterministic color from name hash — same palette as ProfileCombobox
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

// ============================================================
// COMPANY COMBOBOX (with hierarchy support)
// ============================================================

interface CompanyComboboxProps {
    value: string | null
    onChange: (id: string | null) => void
    disabled?: boolean
    /** When editing, exclude this company from parent options to prevent self-reference */
    excludeId?: string
}

export function CompanyCombobox({ value, onChange, disabled, excludeId }: CompanyComboboxProps) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [companies, setCompanies] = useState<ClientCompany[]>([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from("client_companies")
            .select("*, parent:parent_id(id, name)")
            .order("name")
        setCompanies((data as ClientCompany[]) ?? [])
        setLoading(false)
    }, [supabase])

    useEffect(() => { load() }, [load])

    const selected = companies.find(c => c.id === value)

    // Parent companies = those with no parent_id (top-level)
    const parentOptions = companies.filter(c => !c.parent_id && c.id !== excludeId)
    const childOptions = companies.filter(c => c.parent_id && c.id !== excludeId)

    return (
        <>
            <Popover open={open} onOpenChange={setOpen} modal={true}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between h-9 text-sm font-normal overflow-hidden">
                        {selected ? (
                            <span className="flex items-center gap-2 truncate flex-1 text-left">
                                <span className={cn(
                                    "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-semibold shrink-0",
                                    getAvatarColor(selected.name)
                                )}>
                                    {getInitials(selected.name)}
                                </span>
                                <span className="truncate">{selected.name}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground truncate flex-1 text-left">Select company...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 pointer-events-auto" align="start">
                    <Command>
                        <CommandInput placeholder="Search companies..." className="h-9" />
                        <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <>
                                    <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No companies found.</CommandEmpty>
                                    {parentOptions.length > 0 && (
                                        <CommandGroup heading="Parent Companies">
                                            {parentOptions.map(c => {
                                                const isSelected = value === c.id
                                                return (
                                                    <CommandItem key={c.id} value={c.name} onSelect={() => { onChange(c.id); setOpen(false) }} className="flex items-center gap-2.5 py-2">
                                                        <span className={cn(
                                                            "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0",
                                                            getAvatarColor(c.name)
                                                        )}>
                                                            {getInitials(c.name)}
                                                        </span>
                                                        <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{c.name}</span>
                                                        <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                                    </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                    )}
                                    {childOptions.length > 0 && (
                                        <CommandGroup heading="Divisions / Subsidiaries">
                                            {childOptions.map(c => {
                                                const isSelected = value === c.id
                                                return (
                                                    <CommandItem key={c.id} value={`${c.name} ${c.parent?.name ?? ""}`} onSelect={() => { onChange(c.id); setOpen(false) }} className="flex items-center gap-2.5 py-2">
                                                        <span className={cn(
                                                            "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0",
                                                            getAvatarColor(c.name)
                                                        )}>
                                                            {getInitials(c.name)}
                                                        </span>
                                                        <span className="flex-1 min-w-0 flex flex-col">
                                                            <span className="text-[13px] text-foreground truncate">{c.name}</span>
                                                            {c.parent?.name && (
                                                                <span className="text-[10.5px] text-muted-foreground truncate">↳ {c.parent.name}</span>
                                                            )}
                                                        </span>
                                                        <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                                    </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                    )}
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true) }} className="flex items-center gap-2.5 py-2 text-primary">
                                            <span className="w-6 h-6 rounded-md flex items-center justify-center bg-primary/10 shrink-0">
                                                <Plus className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="text-[13px] font-medium">Create New Company</span>
                                        </CommandItem>
                                        {value && (
                                            <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false) }} className="flex items-center gap-2.5 py-2 text-muted-foreground">
                                                <span className="w-6 h-6 rounded-md flex items-center justify-center bg-muted shrink-0">
                                                    <X className="h-3 w-3" />
                                                </span>
                                                <span className="text-[13px]">Clear selection</span>
                                            </CommandItem>
                                        )}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <AddCompanyModal 
                open={createOpen} 
                onOpenChange={setCreateOpen} 
                onCreated={async (newId) => {
                    await load()
                    if (newId) onChange(newId)
                }} 
            />
        </>
    )
}

// ============================================================
// CONTACT COMBOBOX (cascading — depends on selected company)
// ============================================================

interface ContactComboboxProps {
    value: string | null
    onChange: (id: string | null) => void
    clientCompanyId: string | null
    clientCompanyName?: string
    disabled?: boolean
}

export function ContactCombobox({ value, onChange, clientCompanyId, clientCompanyName, disabled }: ContactComboboxProps) {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    const load = useCallback(async () => {
        if (!clientCompanyId) { setContacts([]); return }
        setLoading(true)
        const { data } = await supabase.from("contacts").select("*").eq("client_company_id", clientCompanyId).order("full_name")
        setContacts(data ?? [])
        setLoading(false)
    }, [supabase, clientCompanyId])

    useEffect(() => { 
        load()
    }, [clientCompanyId]) // eslint-disable-line react-hooks/exhaustive-deps 

    const selected = contacts.find(c => c.id === value)
    const isDisabled = disabled || !clientCompanyId

    return (
        <>
            <Popover open={open} onOpenChange={setOpen} modal={true}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} disabled={isDisabled} className="w-full justify-between h-9 text-sm font-normal overflow-hidden">
                        {selected ? (
                            <span className="flex items-center gap-2 truncate flex-1 text-left">
                                <span className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
                                    getAvatarColor(selected.full_name)
                                )}>
                                    {getInitials(selected.full_name)}
                                </span>
                                <span className="truncate">{selected.full_name}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground truncate flex-1 text-left">{isDisabled ? "Select a company first" : "Select contact..."}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 pointer-events-auto" align="start">
                    <Command>
                        <CommandInput placeholder="Search contacts..." className="h-9" />
                        <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <>
                                    <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No contacts found.</CommandEmpty>
                                    <CommandGroup>
                                        {contacts.map(c => {
                                            const isSelected = value === c.id
                                            return (
                                                <CommandItem key={c.id} value={c.full_name} onSelect={() => { onChange(c.id); setOpen(false) }} className="flex items-center gap-2.5 py-2">
                                                    <span className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                                                        getAvatarColor(c.full_name)
                                                    )}>
                                                        {getInitials(c.full_name)}
                                                    </span>
                                                    <span className="flex-1 min-w-0 flex flex-col">
                                                        <span className="text-[13px] text-foreground truncate">{c.full_name}</span>
                                                        {c.email && (
                                                            <span className="text-[10.5px] text-muted-foreground truncate">{c.email}</span>
                                                        )}
                                                    </span>
                                                    <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true) }} className="flex items-center gap-2.5 py-2 text-primary">
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 shrink-0">
                                                <Plus className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="text-[13px] font-medium">New Contact{clientCompanyName ? ` for ${clientCompanyName}` : ""}</span>
                                        </CommandItem>
                                        {value && (
                                            <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false) }} className="flex items-center gap-2.5 py-2 text-muted-foreground">
                                                <span className="w-6 h-6 rounded-full flex items-center justify-center bg-muted shrink-0">
                                                    <X className="h-3 w-3" />
                                                </span>
                                                <span className="text-[13px]">Clear selection</span>
                                            </CommandItem>
                                        )}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <AddContactModal 
                isOpen={createOpen} 
                onOpenChange={setCreateOpen}
                preselectedCompanyId={clientCompanyId} 
                onSuccess={async (newId) => {
                    await load()
                    if (newId) onChange(newId)
                }} 
            />
        </>
    )
}
