"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Pencil, Loader2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { useCascadedOptions } from "@/hooks/use-cascaded-options"
import type { LucideIcon } from "lucide-react"
import { usePermissions } from "@/contexts/permissions-context"

/** Map a DB table to its permission module so inline edits respect the matrix. */
function moduleForTable(table: string): string {
    if (table === "client_companies") return "companies"
    if (table === "contacts") return "contacts"
    if (table === "leads") return "leads"
    return table
}

/**
 * Generic, table-agnostic inline editors for entity detail pages.
 *
 * Unlike the lead-specific `HeaderMetricPopover` / `InlineSelectPopover`
 * (hardcoded to `leads` + numeric `leadId`), these accept an explicit
 * `table` + string/number `id`, so the same component edits
 * `client_companies`, `contacts`, etc. Both render the standard detail-card
 * "info row" (icon + uppercase label + value) used across the app, with a
 * faint pencil on hover and a popover editor on click.
 */

interface InlineRowBaseProps {
    /** Supabase table to update, e.g. "client_companies" | "contacts". */
    table: string
    /** Primary key value of the row to update. */
    id: string | number
    /** Column to write. */
    fieldPath: string
    icon: LucideIcon
    label: string
    /** Current raw stored value (null when unset). */
    rawValue: string | null | undefined
    /** Pre-formatted display text. Falls back to rawValue. */
    displayValue?: string | null
}

async function persist(table: string, id: string | number, payload: Record<string, unknown>) {
    const supabase = createClient()
    return supabase.from(table).update(payload).eq("id", id)
}

function RowShell({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-1.5">
            <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                <div className="mt-0.5">{children}</div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  InlineTextField — text / number / url / phone
// ─────────────────────────────────────────────────────────────
interface InlineTextFieldProps extends InlineRowBaseProps {
    inputType?: "text" | "number" | "url" | "phone"
    placeholder?: string
}

export function InlineTextField({
    table, id, fieldPath, icon, label, rawValue, displayValue,
    inputType = "text", placeholder,
}: InlineTextFieldProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const canEdit = can(moduleForTable(table), "update")
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState(rawValue?.toString() ?? "")
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            setValue(rawValue?.toString() ?? "")
            setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
        }
    }, [open, rawValue])

    const handleSave = async () => {
        const trimmed = value.trim()
        let next: string | number | null = trimmed || null
        if (inputType === "number") next = trimmed ? Number(trimmed) : null
        else if (inputType === "phone" && trimmed) next = normalizePhoneToE164(trimmed) ?? trimmed

        if ((next ?? null) === (rawValue ?? null)) { setOpen(false); return }

        setSaving(true)
        const { error } = await persist(table, id, { [fieldPath]: next })
        if (error) toast.error(`Update failed: ${error.message}`)
        else { toast.success(`${label} updated`); router.refresh() }
        setSaving(false)
        setOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") { e.preventDefault(); handleSave() }
        if (e.key === "Escape") setOpen(false)
    }

    const shown = displayValue ?? rawValue ?? null

    if (!canEdit) {
        return (
            <RowShell icon={icon} label={label}>
                <span className={cn("text-[13px] break-words", shown ? "text-slate-800" : "text-slate-300")}>
                    {shown || "—"}
                </span>
            </RowShell>
        )
    }

    return (
        <RowShell icon={icon} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={saving}
                        className="group/inline inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 max-w-full transition-colors hover:bg-blue-50 text-left"
                    >
                        {saving
                            ? <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                            : <Pencil className="h-3 w-3 text-transparent group-hover/inline:text-blue-500 shrink-0 transition-colors order-2" />}
                        <span className={cn("text-[13px] break-words", shown ? "text-slate-800" : "text-slate-300")}>
                            {shown || "—"}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start" sideOffset={8}>
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
                        <Input
                            ref={inputRef}
                            type={inputType === "phone" ? "tel" : inputType === "url" ? "text" : inputType}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-sm"
                            placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setOpen(false)} disabled={saving}>
                                <X className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" className="h-7 text-xs px-3" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                Save
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </RowShell>
    )
}

// ─────────────────────────────────────────────────────────────
//  InlineSelectField — master_options dropdown (cascade-aware)
// ─────────────────────────────────────────────────────────────
interface InlineSelectFieldProps extends InlineRowBaseProps {
    /** master_options option_type to load choices from. */
    optionType: string
    /** Current value of the cascade parent field, when this option_type cascades. */
    parentValue?: string | null
    /** Allow clearing back to null. Default true. */
    clearable?: boolean
}

export function InlineSelectField({
    table, id, fieldPath, icon, label, rawValue, displayValue,
    optionType, parentValue, clearable = true,
}: InlineSelectFieldProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const canEdit = can(moduleForTable(table), "update")
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const { options, loading, isDisabledByParent } = useCascadedOptions(
        open ? optionType : "",
        parentValue,
    )

    const shown = displayValue ?? rawValue ?? null

    if (!canEdit) {
        return (
            <RowShell icon={icon} label={label}>
                <span className={cn("text-[13px] break-words", shown ? "text-slate-800" : "text-slate-300")}>
                    {shown || "—"}
                </span>
            </RowShell>
        )
    }

    const handleSelect = async (next: string | null) => {
        if ((next ?? null) === (rawValue ?? null)) { setOpen(false); return }
        setSaving(true)
        const { error } = await persist(table, id, { [fieldPath]: next })
        if (error) toast.error(`Update failed: ${error.message}`)
        else { toast.success(`${label} updated`); router.refresh() }
        setSaving(false)
        setOpen(false)
    }

    return (
        <RowShell icon={icon} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={saving}
                        className="group/inline inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 max-w-full transition-colors hover:bg-blue-50 text-left"
                    >
                        {saving
                            ? <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                            : <Pencil className="h-3 w-3 text-transparent group-hover/inline:text-blue-500 shrink-0 transition-colors order-2" />}
                        <span className={cn("text-[13px] break-words", shown ? "text-slate-800" : "text-slate-300")}>
                            {shown || "—"}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0" align="start" sideOffset={8}>
                    <Command>
                        <CommandInput placeholder={`Search ${label.toLowerCase()}…`} className="h-9 text-sm" />
                        <CommandList>
                            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                                {loading ? "Loading…" : isDisabledByParent ? "Select the parent field first" : "No options"}
                            </CommandEmpty>
                            <CommandGroup>
                                {clearable && (
                                    <CommandItem value="__clear__" onSelect={() => handleSelect(null)} className="text-[12px] text-muted-foreground">
                                        <X className="mr-2 h-3.5 w-3.5" /> Clear
                                    </CommandItem>
                                )}
                                {options.map(opt => (
                                    <CommandItem key={opt.id} value={opt.label} onSelect={() => handleSelect(opt.value)} className="text-[12px]">
                                        <Check className={cn("mr-2 h-3.5 w-3.5", (rawValue ?? null) === opt.value ? "opacity-100 text-blue-600" : "opacity-0")} />
                                        {opt.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </RowShell>
    )
}
