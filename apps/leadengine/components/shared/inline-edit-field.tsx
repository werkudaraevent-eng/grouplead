"use client"

import { useState, useRef, useEffect, type ComponentProps, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Pencil, Loader2, Check, X } from "@/components/icons"
import { cn } from "@/lib/utils"
import { sentenceCaseLabel } from "@/lib/label-case"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { useCascadedOptions } from "@/hooks/use-cascaded-options"
import type { LucideIcon } from "@/components/icons"
import { usePermissions } from "@/contexts/permissions-context"

/** Map a DB table to its permission module so inline edits respect the matrix. */
function moduleForTable(table: string): string {
    if (table === "client_companies") return "companies"
    if (table === "contacts") return "contacts"
    if (table === "leads") return "leads"
    return table
}

/**
 * Generic, table-agnostic inline editors for a record's page.
 *
 * Unlike the lead-specific `HeaderMetricPopover` / `InlineSelectPopover`
 * (hardcoded to `leads` + numeric `leadId`), these accept an explicit
 * `table` + string/number `id`, so the same component edits
 * `client_companies`, `contacts`, etc. A value the person may change is a
 * button that opens its editor in a popover, with a pencil on hover or
 * keyboard focus (always shown to a finger, which has no hover).
 *
 * Two layouts of one property:
 *   • `stacked` (the default): an icon, the label above the value; the
 *     Company page's card.
 *   • `row`: the label beside the value from `md`, above it on a phone, no
 *     icon; a record's details grid (Zoho's label : value, M3 list). The
 *     caller wraps the rows in a `<dl>`.
 * The label is always sentence case in the muted ink (M3's type scale has
 * no all-caps label): "Segment Tier" reads "Segment tier". It used to be
 * 11px tracked capitals.
 */

export type FieldLayout = "stacked" | "row"

interface InlineRowBaseProps {
    /** Supabase table to update, e.g. "client_companies" | "contacts". */
    table: string
    /** Primary key value of the row to update. */
    id: string | number
    /** Column to write. */
    fieldPath: string
    /** The leading icon of the `stacked` layout; `row` draws none. */
    icon?: LucideIcon
    label: string
    /** Current raw stored value (null when unset). */
    rawValue: string | null | undefined
    /** Pre-formatted display text. Falls back to rawValue. */
    displayValue?: string | null
    layout?: FieldLayout
    /** Shown when there is no value; "—" by default. */
    emptyText?: string
}

async function persist(table: string, id: string | number, payload: Record<string, unknown>) {
    const supabase = createClient()
    return supabase.from(table).update(payload).eq("id", id)
}

/** One property: its label and, as children, its value. */
export function FieldShell({ icon: Icon, label, layout = "stacked", children }: {
    icon?: LucideIcon
    label: string
    layout?: FieldLayout
    children: ReactNode
}) {
    const text = sentenceCaseLabel(label)
    if (layout === "row") {
        return (
            <div className="grid min-w-0 gap-0.5 py-1 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:gap-4 md:py-0.5">
                <dt className="text-sm leading-5 text-muted-foreground md:py-2">{text}</dt>
                <dd className="min-w-0">{children}</dd>
            </div>
        )
    }
    return (
        <div className="flex items-start gap-3 py-1.5">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{text}</p>
                <div className="mt-0.5">{children}</div>
            </div>
        </div>
    )
}

/** A value nobody changes here, in the layout's type. */
export function FieldValue({ layout = "stacked", empty, children }: { layout?: FieldLayout; empty?: boolean; children: ReactNode }) {
    return (
        <div className={cn(
            "break-words",
            layout === "row" ? "py-2 text-sm leading-5" : "text-[13px]",
            empty ? "text-muted-foreground" : "text-foreground",
        )}>
            {children}
        </div>
    )
}

/**
 * The value as the button that edits it. Its name says so ("Edit Email:
 * ana@x.co"); the pencil is decoration. `ref` and the popover's props
 * arrive through `...props` (React 19 passes a ref as a prop).
 */
export function EditTrigger({ layout = "stacked", label, saving, empty, children, className, ...props }: ComponentProps<"button"> & {
    layout?: FieldLayout
    label: string
    saving?: boolean
    empty?: boolean
}) {
    const row = layout === "row"
    return (
        <button
            type="button"
            disabled={saving}
            {...props}
            className={cn(
                "group/inline text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                row
                    ? "-mx-2 flex min-h-9 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-2 hover:bg-muted"
                    : "-mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-primary/5",
                className,
            )}
        >
            <span className="sr-only">Edit {sentenceCaseLabel(label)}: </span>
            <span className={cn(
                "min-w-0 break-words",
                row ? "flex-1 text-sm leading-5" : "text-[13px]",
                empty ? "text-muted-foreground" : "text-foreground",
            )}>
                {children}
            </span>
            {saving ? (
                <Loader2 className={cn("shrink-0 animate-spin text-primary", row ? "h-4 w-4" : "h-3 w-3")} aria-hidden="true" />
            ) : (
                <Pencil
                    aria-hidden="true"
                    className={cn(
                        "shrink-0 transition-opacity",
                        row
                            ? "h-4 w-4 text-muted-foreground opacity-0 group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100 pointer-coarse:opacity-100"
                            : "order-2 h-3 w-3 text-primary opacity-0 group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100 pointer-coarse:opacity-100",
                    )}
                />
            )}
        </button>
    )
}

/**
 * A property this page shows but edits elsewhere (a list of phones, social
 * links, a custom field): the value, and for whoever may change it a
 * pencil that opens the record's Edit form. A plain value is itself the
 * button, as an inline field's is; a value made of links (`links`) keeps
 * them working and puts the pencil beside them as its own button.
 */
export function FieldRow({ label, icon, layout = "row", empty, onEdit, links = false, children }: {
    label: string
    icon?: LucideIcon
    layout?: FieldLayout
    empty?: boolean
    /** Opens the form that edits it; left out, the value is read only. */
    onEdit?: () => void
    /** The value holds links, so it cannot be the button. */
    links?: boolean
    children: ReactNode
}) {
    let value: ReactNode
    if (!onEdit) {
        value = <FieldValue layout={layout} empty={empty}>{children}</FieldValue>
    } else if (links && !empty) {
        value = (
            <div className={cn(
                "group/inline flex min-w-0 items-start gap-2",
                layout === "row" && "-mx-2 w-[calc(100%+1rem)] rounded-md px-2 transition-colors hover:bg-muted",
            )}>
                <div className="min-w-0 flex-1"><FieldValue layout={layout}>{children}</FieldValue></div>
                <button
                    type="button"
                    onClick={onEdit}
                    aria-haspopup="dialog"
                    aria-label={`Edit ${sentenceCaseLabel(label)}`}
                    className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/inline:opacity-100 pointer-coarse:opacity-100"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        )
    } else {
        value = (
            <EditTrigger layout={layout} label={label} empty={empty} onClick={onEdit} aria-haspopup="dialog">
                {children}
            </EditTrigger>
        )
    }
    return <FieldShell icon={icon} label={label} layout={layout}>{value}</FieldShell>
}

// ─────────────────────────────────────────────────────────────
//  InlineTextField — text / number / url / phone / date
// ─────────────────────────────────────────────────────────────
interface InlineTextFieldProps extends InlineRowBaseProps {
    inputType?: "text" | "number" | "url" | "phone" | "date"
    placeholder?: string
    /** Refuses an empty value (a name). */
    required?: boolean
}

export function InlineTextField({
    table, id, fieldPath, icon, label, rawValue, displayValue,
    inputType = "text", placeholder, layout = "stacked", emptyText = "—", required = false,
}: InlineTextFieldProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const canEdit = can(moduleForTable(table), "update")
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState(rawValue?.toString() ?? "")
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const text = sentenceCaseLabel(label)

    useEffect(() => {
        if (open) {
            setValue(rawValue?.toString() ?? "")
            // The popover is portalled and placed fixed, so this moves no scroller.
            setTimeout(() => { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select() }, 50)
        }
    }, [open, rawValue])

    const handleSave = async () => {
        const trimmed = value.trim()
        if (required && !trimmed) {
            toast.error(`${text} can't be empty`)
            return
        }
        let next: string | number | null = trimmed || null
        if (inputType === "number") next = trimmed ? Number(trimmed) : null
        else if (inputType === "phone" && trimmed) next = normalizePhoneToE164(trimmed) ?? trimmed

        if ((next ?? null) === (rawValue ?? null)) { setOpen(false); return }

        setSaving(true)
        const { error } = await persist(table, id, { [fieldPath]: next })
        if (error) toast.error(`Update failed: ${error.message}`)
        else { toast.success(`${text} updated`); router.refresh() }
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
            <FieldShell icon={icon} label={label} layout={layout}>
                <FieldValue layout={layout} empty={!shown}>{shown || emptyText}</FieldValue>
            </FieldShell>
        )
    }

    return (
        <FieldShell icon={icon} label={label} layout={layout}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <EditTrigger layout={layout} label={label} saving={saving} empty={!shown}>
                        {shown || emptyText}
                    </EditTrigger>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start" sideOffset={8} collisionPadding={16}>
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`inline-${fieldPath}`} className="text-xs font-medium text-muted-foreground">{text}</label>
                        <Input
                            id={`inline-${fieldPath}`}
                            ref={inputRef}
                            type={inputType === "phone" ? "tel" : inputType === "url" ? "text" : inputType}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-9 text-sm"
                            placeholder={placeholder ?? `Enter ${text.toLowerCase()}`}
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setOpen(false)} disabled={saving}>
                                <X className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" className="h-8 text-xs px-3" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                Save
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </FieldShell>
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
    optionType, parentValue, clearable = true, layout = "stacked", emptyText = "—",
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
    const text = sentenceCaseLabel(label)

    const shown = displayValue ?? rawValue ?? null

    if (!canEdit) {
        return (
            <FieldShell icon={icon} label={label} layout={layout}>
                <FieldValue layout={layout} empty={!shown}>{shown || emptyText}</FieldValue>
            </FieldShell>
        )
    }

    const handleSelect = async (next: string | null) => {
        if ((next ?? null) === (rawValue ?? null)) { setOpen(false); return }
        setSaving(true)
        const { error } = await persist(table, id, { [fieldPath]: next })
        if (error) toast.error(`Update failed: ${error.message}`)
        else { toast.success(`${text} updated`); router.refresh() }
        setSaving(false)
        setOpen(false)
    }

    return (
        <FieldShell icon={icon} label={label} layout={layout}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <EditTrigger layout={layout} label={label} saving={saving} empty={!shown}>
                        {shown || emptyText}
                    </EditTrigger>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start" sideOffset={8} collisionPadding={16}>
                    <Command>
                        <CommandInput placeholder={`Search ${text.toLowerCase()}…`} className="h-9 text-sm" />
                        <CommandList>
                            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                                {loading ? "Loading…" : isDisabledByParent ? "Select the parent field first" : "No options"}
                            </CommandEmpty>
                            <CommandGroup>
                                {clearable && (
                                    <CommandItem value="__clear__" onSelect={() => handleSelect(null)} className="text-[13px] text-muted-foreground">
                                        <X className="mr-2 h-3.5 w-3.5" /> Clear
                                    </CommandItem>
                                )}
                                {options.map(opt => (
                                    <CommandItem key={opt.id} value={opt.label} onSelect={() => handleSelect(opt.value)} className="text-[13px]">
                                        <Check className={cn("mr-2 h-3.5 w-3.5", (rawValue ?? null) === opt.value ? "opacity-100 text-primary" : "opacity-0")} />
                                        {opt.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}

// ─────────────────────────────────────────────────────────────
//  InlineCustomSelectField — master_options dropdown backed by a
//  key inside a JSONB `custom_data` column (per-tenant custom
//  fields like "Segment"). Reads/writes custom_data[customKey]
//  while preserving the rest of the object.
// ─────────────────────────────────────────────────────────────
interface InlineCustomSelectFieldProps {
    /** Supabase table to update, e.g. "client_companies". */
    table: string
    /** Primary key value of the row to update. */
    id: string | number
    /** Current full custom_data object (null when unset). */
    customData: Record<string, unknown> | null | undefined
    /** Key inside custom_data to read/write, e.g. "segment". */
    customKey: string
    icon?: LucideIcon
    label: string
    /** master_options option_type to load choices from. */
    optionType: string
    /** Current value of the cascade parent field, when this option_type cascades. */
    parentValue?: string | null
    /** Allow clearing back to null. Default true. */
    clearable?: boolean
    /** Other custom_data keys to clear when this value changes (cascade children). */
    alsoClearCustomKeys?: string[]
    /** Native columns to set null when this value changes (cascade children). */
    alsoClearColumns?: string[]
    layout?: FieldLayout
    emptyText?: string
}

export function InlineCustomSelectField({
    table, id, customData, customKey, icon, label,
    optionType, parentValue, clearable = true,
    alsoClearCustomKeys, alsoClearColumns, layout = "stacked", emptyText = "—",
}: InlineCustomSelectFieldProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const canEdit = can(moduleForTable(table), "update")
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const { options, loading, isDisabledByParent } = useCascadedOptions(
        open ? optionType : "",
        parentValue,
    )
    const text = sentenceCaseLabel(label)

    const rawValue = (customData?.[customKey] as string | null | undefined) ?? null
    const shown = rawValue

    if (!canEdit) {
        return (
            <FieldShell icon={icon} label={label} layout={layout}>
                <FieldValue layout={layout} empty={!shown}>{shown || emptyText}</FieldValue>
            </FieldShell>
        )
    }

    const handleSelect = async (next: string | null) => {
        if ((next ?? null) === (rawValue ?? null)) { setOpen(false); return }
        setSaving(true)
        const merged: Record<string, unknown> = { ...(customData ?? {}) }
        if (next === null) delete merged[customKey]
        else merged[customKey] = next
        // Cascade: a change here invalidates dependent children (each child
        // value belongs to exactly one parent), so clear them in the same write.
        for (const k of alsoClearCustomKeys ?? []) delete merged[k]
        const payload: Record<string, unknown> = { custom_data: merged }
        for (const col of alsoClearColumns ?? []) payload[col] = null
        const { error } = await persist(table, id, payload)
        if (error) toast.error(`Update failed: ${error.message}`)
        else { toast.success(`${text} updated`); router.refresh() }
        setSaving(false)
        setOpen(false)
    }

    return (
        <FieldShell icon={icon} label={label} layout={layout}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <EditTrigger layout={layout} label={label} saving={saving} empty={!shown}>
                        {shown || emptyText}
                    </EditTrigger>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start" sideOffset={8} collisionPadding={16}>
                    <Command>
                        <CommandInput placeholder={`Search ${text.toLowerCase()}…`} className="h-9 text-sm" />
                        <CommandList>
                            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                                {loading ? "Loading…" : isDisabledByParent ? "Select the parent field first" : "No options"}
                            </CommandEmpty>
                            <CommandGroup>
                                {clearable && (
                                    <CommandItem value="__clear__" onSelect={() => handleSelect(null)} className="text-[13px] text-muted-foreground">
                                        <X className="mr-2 h-3.5 w-3.5" /> Clear
                                    </CommandItem>
                                )}
                                {options.map(opt => (
                                    <CommandItem key={opt.id} value={opt.label} onSelect={() => handleSelect(opt.value)} className="text-[13px]">
                                        <Check className={cn("mr-2 h-3.5 w-3.5", (rawValue ?? null) === opt.value ? "opacity-100 text-primary" : "opacity-0")} />
                                        {opt.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}

// ─────────────────────────────────────────────────────────────
//  InlineChoiceField — one of a list the page supplies (a record's
//  owner, its client company), saved through the page's own action.
// ─────────────────────────────────────────────────────────────
export interface ChoiceOption {
    value: string
    label: string
    /** An avatar or icon before the label. */
    leading?: ReactNode
}

interface InlineChoiceFieldProps {
    label: string
    icon?: LucideIcon
    layout?: FieldLayout
    /** The chosen option's value, null when none. */
    value: string | null
    /** What the row shows for the current value. */
    display: ReactNode
    /** The row reads as empty (muted). */
    empty?: boolean
    /** The choices; null while they load. */
    options: ChoiceOption[] | null
    /** Called when the picker opens, to load the choices on demand. */
    onOpen?: () => void
    /** Saves the choice; true when it was saved. */
    onSave: (next: string | null) => Promise<boolean>
    canEdit: boolean
    /** The first row, which clears the choice ("No owner"). */
    clearLabel: string
}

export function InlineChoiceField({
    label, icon, layout = "stacked", value, display, empty, options, onOpen, onSave, canEdit, clearLabel,
}: InlineChoiceFieldProps) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const text = sentenceCaseLabel(label)

    if (!canEdit) {
        return (
            <FieldShell icon={icon} label={label} layout={layout}>
                <FieldValue layout={layout} empty={empty}>{display}</FieldValue>
            </FieldShell>
        )
    }

    const choose = async (next: string | null) => {
        setOpen(false)
        if ((next ?? null) === (value ?? null)) return
        setSaving(true)
        await onSave(next)
        setSaving(false)
    }

    return (
        <FieldShell icon={icon} label={label} layout={layout}>
            <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) onOpen?.() }}>
                <PopoverTrigger asChild>
                    <EditTrigger layout={layout} label={label} saving={saving} empty={empty}>
                        {display}
                    </EditTrigger>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start" sideOffset={8} collisionPadding={16}>
                    {/* Matched on the names only: an id holds letters too. */}
                    <Command filter={(_, search, keywords) => ((keywords ?? []).join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
                        <CommandInput placeholder={`Search ${text.toLowerCase()}…`} className="h-9 text-sm" />
                        <CommandList>
                            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">No matches</CommandEmpty>
                            {options === null && (
                                <p className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
                                </p>
                            )}
                            <CommandGroup>
                                <CommandItem value="__clear__" keywords={[clearLabel]} onSelect={() => choose(null)} className="text-[13px] text-muted-foreground">
                                    <Check className={cn("mr-2 h-3.5 w-3.5", value === null ? "opacity-100 text-primary" : "opacity-0")} />
                                    {clearLabel}
                                </CommandItem>
                                {(options ?? []).map((option) => (
                                    <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => choose(option.value)} className="text-[13px]">
                                        <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === option.value ? "opacity-100 text-primary" : "opacity-0")} />
                                        {option.leading}
                                        <span className="truncate">{option.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}
