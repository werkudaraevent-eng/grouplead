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
import { ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ClientCompany, Contact } from "@/types"
import { AddCompanyModal } from "@/features/companies/components/add-company-modal"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"

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

    // Build display name with parent context
    const displayName = (c: ClientCompany) => {
        if (c.parent?.name) return `${c.name} — ${c.parent.name}`
        return c.name
    }

    // Parent companies = those with no parent_id (top-level)
    const parentOptions = companies.filter(c => !c.parent_id)

    return (
        <>
            <Popover open={open} onOpenChange={setOpen} modal={true}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between h-9 text-sm font-normal overflow-hidden">
                        <span className="truncate flex-1 text-left">{selected ? displayName(selected) : "Select company..."}</span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                    <Command>
                        <CommandInput placeholder="Search companies..." />
                        <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : (
                                <>
                                    <CommandEmpty>No companies found.</CommandEmpty>
                                    {/* Parent companies group */}
                                    {parentOptions.length > 0 && (
                                        <CommandGroup heading="Parent Companies">
                                            {parentOptions.filter(c => c.id !== excludeId).map(c => (
                                                <CommandItem key={c.id} value={c.name} onSelect={() => { onChange(c.id); setOpen(false) }}>
                                                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                                                    <span className="font-medium">{c.name}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}
                                    {/* Child / division companies */}
                                    {companies.filter(c => c.parent_id && c.id !== excludeId).length > 0 && (
                                        <CommandGroup heading="Divisions / Subsidiaries">
                                            {companies.filter(c => c.parent_id && c.id !== excludeId).map(c => (
                                                <CommandItem key={c.id} value={`${c.name} ${c.parent?.name ?? ""}`} onSelect={() => { onChange(c.id); setOpen(false) }}>
                                                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                                                    <div>
                                                        <span>{c.name}</span>
                                                        {c.parent?.name && <span className="ml-2 text-xs text-muted-foreground">↳ {c.parent.name}</span>}
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true) }} className="text-primary">
                                            <Plus className="mr-2 h-4 w-4" /> Create New Company
                                        </CommandItem>
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
                        <span className="truncate flex-1 text-left">{selected ? selected.full_name : isDisabled ? "Select a company first" : "Select contact..."}</span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                    <Command>
                        <CommandInput placeholder="Search contacts..." />
                        <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : (
                                <>
                                    <CommandEmpty>No contacts found.</CommandEmpty>
                                    <CommandGroup>
                                        {contacts.map(c => (
                                            <CommandItem key={c.id} value={c.full_name} onSelect={() => { onChange(c.id); setOpen(false) }}>
                                                <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                                                <div>
                                                    <span>{c.full_name}</span>
                                                    {c.email && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true) }} className="text-primary">
                                            <Plus className="mr-2 h-4 w-4" /> New Contact{clientCompanyName ? ` for ${clientCompanyName}` : ""}
                                        </CommandItem>
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
