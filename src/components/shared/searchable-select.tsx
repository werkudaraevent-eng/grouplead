"use client"

/**
 * Searchable select — Combobox built on shadcn Popover + Command.
 *
 * Replaces plain `<Select>` for fields where the option list can be
 * long (industries, line industries, salutations, social platforms).
 *
 * Features:
 *   • Type-ahead search (CommandInput)
 *   • Clear button (X) when value is set
 *   • Empty state message
 *   • Disabled state
 *   • `null` value = no selection (no sentinel "none" string)
 */

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableOption {
    value: string
    label: string
    /** Optional sub-label shown muted on the right. */
    secondary?: string
    /** Optional grouping key (rendered as section header in dropdown). */
    group?: string
}

interface SearchableSelectProps {
    value: string | null
    onChange: (value: string | null) => void
    options: SearchableOption[]
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
    loading?: boolean
    clearable?: boolean
    className?: string
    /** Force the dropdown content width. Default: matches trigger. */
    contentWidth?: "trigger" | "auto"
}

export function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    emptyText = "No results",
    disabled,
    loading,
    clearable = true,
    className,
    contentWidth = "trigger",
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false)
    const selected = options.find((o) => o.value === value)

    // Group options by `group` key when present. Maintains insertion order.
    const grouped = React.useMemo(() => {
        const map = new Map<string, SearchableOption[]>()
        for (const opt of options) {
            const key = opt.group ?? ""
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(opt)
        }
        return Array.from(map.entries())
    }, [options])

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || loading}
                    className={cn(
                        "w-full justify-between font-normal h-9 px-3 text-sm",
                        !selected && "text-muted-foreground",
                        className,
                    )}
                >
                    <span className="truncate flex-1 text-left">
                        {loading ? "Loading…" : selected ? selected.label : placeholder}
                    </span>
                    <span className="flex items-center gap-1 ml-2 shrink-0">
                        {clearable && selected && !disabled && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onChange(null)
                                }}
                                className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Clear selection"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    "p-0",
                    contentWidth === "trigger" && "w-[--radix-popover-trigger-width]",
                )}
                align="start"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList className="max-h-[260px]">
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        {grouped.map(([groupKey, opts]) => (
                            <CommandGroup key={groupKey} heading={groupKey || undefined}>
                                {opts.map((opt) => (
                                    <CommandItem
                                        key={opt.value}
                                        value={`${opt.label} ${opt.secondary ?? ""}`}
                                        onSelect={() => {
                                            onChange(opt.value === value ? null : opt.value)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === opt.value ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <span className="truncate flex-1">{opt.label}</span>
                                        {opt.secondary && (
                                            <span className="ml-2 text-xs text-muted-foreground shrink-0">
                                                {opt.secondary}
                                            </span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
