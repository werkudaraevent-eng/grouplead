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
 * keyboard focus (always shown to a finger, which has no hover); the whole
 * row is its target, so a finger gets at least 48dp.
 *
 * One layout, a record page's About card (DESIGN.md, "Record pages"):
 * from `lg` the label (13px, muted, a 112px column) beside the value
 * (13px); below `lg` the label (12px) above the value (14px). The label is
 * always sentence case in the muted ink (M3's type scale has no all-caps
 * label): "Segment Tier" reads "Segment tier". The caller wraps the rows in
 * a `<dl>`.
 */

interface InlineRowBaseProps {
    /** Supabase table to update, e.g. "client_companies" | "contacts". */
    table: string
    /** Primary key value of the row to update. */
    id: string | number
    /** Column to write. */
    fieldPath: string
    label: string
    /** Current raw stored value (null when unset). */
    rawValue: string | null | undefined
    /** Pre-formatted display. Falls back to rawValue. */
    displayValue?: ReactNode
    /** Shown when there is no value; "—" by default. */
    emptyText?: string
}

async function persist(table: string, id: string | number, payload: Record<string, unknown>) {
    const supabase = createClient()
    return supabase.from(table).update(payload).eq("id", id)
}

/** One property: its label and, as children, its value. */
export function FieldShell({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="relative flex min-w-0 flex-col gap-0.5 px-4 py-2.5 lg:flex-row lg:gap-3 lg:py-[9px]">
            {/* One line height for label and value (M3 body-medium 20px; the
                phone's label is body-small 16px), so a value that wraps or
                stacks keeps an even rhythm and its first line sits level
                with the label. */}
            <dt className="text-xs leading-4 text-muted-foreground lg:w-28 lg:shrink-0 lg:text-[13px] lg:leading-5">{sentenceCaseLabel(label)}</dt>
            <dd className="min-w-0 flex-1 text-sm leading-5 text-foreground lg:text-[13px]">{children}</dd>
        </div>
    )
}

/** A value nobody changes here. */
export function FieldValue({ empty, children }: { empty?: boolean; children: ReactNode }) {
    return <div className={cn("break-words", empty && "text-muted-foreground")}>{children}</div>
}

/**
 * The value as the button that edits it. Its name says so ("Edit Email:
 * ana@x.co"); the pencil is decoration. Its target covers the whole row
 * (the label too), while its tint stays on the value. `ref` and the
 * popover's props arrive through `...props` (React 19 passes a ref as a
 * prop).
 */
export function EditTrigger({ label, saving, empty, children, className, ...props }: ComponentProps<"button"> & {
    label: string
    saving?: boolean
    empty?: boolean
}) {
    return (
        <button
            type="button"
            disabled={saving}
            {...props}
            className={cn(
                "group/inline -mx-1.5 -my-1 flex w-[calc(100%+0.75rem)] items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                "after:absolute after:inset-0 after:content-['']",
                className,
            )}
        >
            <span className="sr-only">Edit {sentenceCaseLabel(label)}: </span>
            <span className={cn("min-w-0 flex-1 break-words", empty ? "text-muted-foreground" : "text-foreground")}>
                {children}
            </span>
            {saving ? (
                <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
            ) : (
                <Pencil
                    aria-hidden="true"
                    className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100 pointer-coarse:opacity-100"
                />
            )}
        </button>
    )
}

/** The pencil beside a value made of links: 24dp, its target 48dp, shown on hover or focus and always to a finger. */
const PENCIL_BUTTON = "relative -my-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity before:absolute before:-inset-3 before:content-[''] hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/inline:opacity-100 pointer-coarse:opacity-100"

/** The row behind a value made of links, tinted on hover as an edited value is. */
const LINKS_ROW = "group/inline -mx-1.5 -my-1 flex w-[calc(100%+0.75rem)] min-w-0 items-start gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"

/**
 * A property this page shows but edits elsewhere (a list of phones, social
 * links, a custom field, an address): the value, and for whoever may change
 * it a pencil that opens the record's Edit form. A plain value is itself
 * the button, as an inline field's is; a value made of links (`links`)
 * keeps them working and puts the pencil beside them as its own button.
 */
export function FieldRow({ label, empty, onEdit, links = false, children }: {
    label: string
    empty?: boolean
    /** Opens the form that edits it; left out, the value is read only. */
    onEdit?: () => void
    /** The value holds links, so it cannot be the button. */
    links?: boolean
    children: ReactNode
}) {
    let value: ReactNode
    if (!onEdit) {
        value = <FieldValue empty={empty}>{children}</FieldValue>
    } else if (links && !empty) {
        value = (
            <div className={LINKS_ROW}>
                <div className="min-w-0 flex-1"><FieldValue>{children}</FieldValue></div>
                <button
                    type="button"
                    onClick={onEdit}
                    aria-haspopup="dialog"
                    aria-label={`Edit ${sentenceCaseLabel(label)}`}
                    className={PENCIL_BUTTON}
                >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
        )
    } else {
        value = (
            <EditTrigger label={label} empty={empty} onClick={onEdit} aria-haspopup="dialog">
                {children}
            </EditTrigger>
        )
    }
    return <FieldShell label={label}>{value}</FieldShell>
}

// ─────────────────────────────────────────────────────────────
//  InlineTextField — text / number / url / phone / date
// ─────────────────────────────────────────────────────────────
interface InlineTextFieldProps extends InlineRowBaseProps {
    inputType?: "text" | "number" | "url" | "phone" | "date"
    placeholder?: string
    /** Refuses an empty value (a name). */
    required?: boolean
    /**
     * The value is also a link (mailto:, tel:, a website): it shows in the
     * primary ink and opens, and the pencil beside it edits.
     */
    href?: string | null
    /** The link opens in a new tab (a website). */
    external?: boolean
    /**
     * Saves through the page's own action (a company's name, which the
     * action audits) instead of writing the row directly; true when saved.
     */
    save?: (next: string | number | null) => Promise<boolean>
}

export function InlineTextField({
    table, id, fieldPath, label, rawValue, displayValue,
    inputType = "text", placeholder, emptyText = "—", required = false, href, external = false, save,
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
        if (save) {
            await save(next)
        } else {
            const { error } = await persist(table, id, { [fieldPath]: next })
            if (error) toast.error(`Update failed: ${error.message}`)
            else { toast.success(`${text} updated`); router.refresh() }
        }
        setSaving(false)
        setOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") { e.preventDefault(); handleSave() }
        if (e.key === "Escape") setOpen(false)
    }

    const shown = displayValue ?? rawValue ?? null
    const link = href && shown ? (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="break-words font-medium text-primary hover:underline">
            {shown}
        </a>
    ) : null

    if (!canEdit) {
        return (
            <FieldShell label={label}>
                <FieldValue empty={!shown}>{link ?? (shown || emptyText)}</FieldValue>
            </FieldShell>
        )
    }

    return (
        <FieldShell label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                {link ? (
                    <div className={LINKS_ROW}>
                        <div className="min-w-0 flex-1">{link}</div>
                        <PopoverTrigger asChild>
                            <button type="button" disabled={saving} aria-label={`Edit ${text}`} className={PENCIL_BUTTON}>
                                {saving
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                                    : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                        </PopoverTrigger>
                    </div>
                ) : (
                    <PopoverTrigger asChild>
                        <EditTrigger label={label} saving={saving} empty={!shown}>
                            {shown || emptyText}
                        </EditTrigger>
                    </PopoverTrigger>
                )}
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
    table, id, fieldPath, label, rawValue, displayValue,
    optionType, parentValue, clearable = true, emptyText = "—",
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
            <FieldShell label={label}>
                <FieldValue empty={!shown}>{shown || emptyText}</FieldValue>
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
        <FieldShell label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <EditTrigger label={label} saving={saving} empty={!shown}>
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
    emptyText?: string
}

export function InlineCustomSelectField({
    table, id, customData, customKey, label,
    optionType, parentValue, clearable = true,
    alsoClearCustomKeys, alsoClearColumns, emptyText = "—",
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
            <FieldShell label={label}>
                <FieldValue empty={!shown}>{shown || emptyText}</FieldValue>
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
        <FieldShell label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <EditTrigger label={label} saving={saving} empty={!shown}>
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
    label, value, display, empty, options, onOpen, onSave, canEdit, clearLabel,
}: InlineChoiceFieldProps) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const text = sentenceCaseLabel(label)

    if (!canEdit) {
        return (
            <FieldShell label={label}>
                <FieldValue empty={empty}>{display}</FieldValue>
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
        <FieldShell label={label}>
            <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) onOpen?.() }}>
                <PopoverTrigger asChild>
                    <EditTrigger label={label} saving={saving} empty={empty}>
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
