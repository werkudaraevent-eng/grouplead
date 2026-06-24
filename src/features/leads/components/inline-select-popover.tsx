"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Pencil, Check, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMasterOptions } from "@/hooks/use-master-options"
import { usePermissions } from "@/contexts/permissions-context"

interface InlineSelectPopoverProps {
    leadId: number
    /** Lead column to update (e.g. "category", "main_stream"). */
    fieldPath: string
    /** master_options option_type to load the choices from. */
    optionType: string
    label: string
    /** Current raw value (the stored option `value`), or null when unset. */
    rawValue: string | null | undefined
    /** Pre-resolved display text (defaults to rawValue). */
    displayValue?: string | null
    /** Allow clearing the value back to null. Default true. */
    clearable?: boolean
    triggerClassName?: string
}

/**
 * Inline single-select editor for master_options-backed lead fields.
 *
 * Mirrors `HeaderMetricPopover`: click the value → searchable option list →
 * pick one → direct client-side update + toast + router.refresh(). Used on the
 * lead detail "Deal Information" card so classification fields (Category, Main
 * Stream, Stream Type, …) are editable in place without opening the full
 * Edit Lead modal.
 *
 * The trigger shows a faint pencil on hover so the row reads as editable, the
 * same affordance the currency/date inline editors use.
 */
export function InlineSelectPopover({
    leadId,
    fieldPath,
    optionType,
    label,
    rawValue,
    displayValue,
    clearable = true,
    triggerClassName,
}: InlineSelectPopoverProps) {
    const supabase = createClient()
    const router = useRouter()
    const { can } = usePermissions()
    const canEdit = can("leads", "update")
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const { options, loading } = useMasterOptions(open ? optionType : undefined)

    // Close on unmount safety — nothing async lingers.
    useEffect(() => () => setSaving(false), [])

    const shown = displayValue ?? rawValue ?? null

    // No update permission → plain read-only text, no edit affordance.
    if (!canEdit) {
        return (
            <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 -mx-1.5",
                triggerClassName || "text-[12px] font-medium text-[#292D30]",
            )}>
                <span className={cn("truncate", !shown && "text-slate-300")}>{shown || "—"}</span>
            </span>
        )
    }

    const handleSelect = async (next: string | null) => {
        if (next === (rawValue ?? null)) {
            setOpen(false)
            return
        }
        setSaving(true)
        const { error } = await supabase
            .from("leads")
            .update({ [fieldPath]: next })
            .eq("id", leadId)

        if (error) {
            toast.error(`Update failed: ${error.message}`)
        } else {
            toast.success(`${label} updated`)
            router.refresh()
        }
        setSaving(false)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={saving}
                    className={cn(
                        "group/inline inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-blue-50",
                        triggerClassName || "text-[12px] font-medium text-[#292D30] hover:text-blue-600",
                    )}
                >
                    {saving
                        ? <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                        : <Pencil className="h-3 w-3 text-transparent group-hover/inline:text-blue-500 shrink-0 transition-colors" />}
                    <span className={cn("truncate", !shown && "text-slate-300")}>{shown || "—"}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="end" sideOffset={8}>
                <Command>
                    <CommandInput placeholder={`Search ${label.toLowerCase()}…`} className="h-9 text-sm" />
                    <CommandList>
                        <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                            {loading ? "Loading…" : "No options"}
                        </CommandEmpty>
                        <CommandGroup>
                            {clearable && (
                                <CommandItem
                                    value="__clear__"
                                    onSelect={() => handleSelect(null)}
                                    className="text-[12px] text-muted-foreground"
                                >
                                    <X className="mr-2 h-3.5 w-3.5" />
                                    Clear
                                </CommandItem>
                            )}
                            {options.map(opt => (
                                <CommandItem
                                    key={opt.id}
                                    value={opt.label}
                                    onSelect={() => handleSelect(opt.value)}
                                    className="text-[12px]"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-3.5 w-3.5",
                                            (rawValue ?? null) === opt.value ? "opacity-100 text-blue-600" : "opacity-0",
                                        )}
                                    />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
