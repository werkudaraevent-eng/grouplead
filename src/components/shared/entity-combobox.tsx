"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ClientCompany, Contact } from "@/types"

// ============================================================
// COMPANY COMBOBOX
// ============================================================

interface CompanyComboboxProps {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function CompanyCombobox({ value, onChange, disabled }: CompanyComboboxProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [companies, setCompanies] = useState<ClientCompany[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from("client_companies").select("*").order("name")
    setCompanies(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const selected = companies.find(c => c.id === value)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from("client_companies").insert({ name: newName.trim() }).select().single()
    if (error) { toast.error(error.message); setCreating(false); return }
    toast.success("Company created")
    setCreating(false)
    setCreateOpen(false)
    setNewName("")
    await load()
    onChange(data.id)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between h-9 text-sm font-normal">
            {selected ? selected.name : "Select company..."}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search companies..." />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (
                <>
                  <CommandEmpty>No companies found.</CommandEmpty>
                  <CommandGroup>
                    {companies.map(c => (
                      <CommandItem key={c.id} value={c.name} onSelect={() => { onChange(c.id); setOpen(false) }}>
                        <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                        {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>New Client Company</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-company-name">Company Name</Label>
            <Input id="new-company-name" placeholder="e.g. PT Telkom Indonesia" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!clientCompanyId) { setContacts([]); return }
    setLoading(true)
    const { data } = await supabase.from("contacts").select("*").eq("client_company_id", clientCompanyId).order("full_name")
    setContacts(data ?? [])
    setLoading(false)
  }, [supabase, clientCompanyId])

  useEffect(() => { load(); onChange(null) }, [clientCompanyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = contacts.find(c => c.id === value)
  const isDisabled = disabled || !clientCompanyId

  const handleCreate = async () => {
    if (!newName.trim() || !clientCompanyId) return
    setCreating(true)
    const { data, error } = await supabase.from("contacts").insert({ client_company_id: clientCompanyId, full_name: newName.trim(), email: newEmail || null, phone: newPhone || null }).select().single()
    if (error) { toast.error(error.message); setCreating(false); return }
    toast.success("Contact created")
    setCreating(false)
    setCreateOpen(false)
    setNewName(""); setNewEmail(""); setNewPhone("")
    await load()
    onChange(data.id)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} disabled={isDisabled} className="w-full justify-between h-9 text-sm font-normal">
            {selected ? selected.full_name : isDisabled ? "Select a company first" : "Select contact..."}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts..." />
            <CommandList>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>New Contact{clientCompanyName ? ` — ${clientCompanyName}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input placeholder="e.g. John Doe" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="john@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input placeholder="+62..." value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}