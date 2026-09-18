"use client"

import { useState } from "react"
import { Check, ChevronDown, X } from "@/components/icons"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { ResponsivePopover } from "@/components/responsive-popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A facet: a button that opens a checklist. Values OR together.
 *
 * Material's filter chip, grown up: an active facet reads as "Industri:
 * Perbankan" (or the label with a count when several are chosen), so a
 * closed facet still says what it is doing, and the list clears from
 * inside so the person never hunts for where a selection went. Shared by
 * every filterable list so they all behave the same way.
 */
export function FacetButton({ label, value, count, open }: { label: string; value?: string; count: number; open: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      role="combobox"
      aria-expanded={open}
      className={cn("h-10 max-w-64 gap-1.5 md:h-9", count > 0 && "border-primary/50 bg-primary/5 text-foreground")}
    >
      <span className="truncate">
        {label}
        {value && <span className="font-normal text-muted-foreground">: </span>}
        {value}
      </span>
      {count > 1 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{count}</span>}
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Button>
  )
}

/** What a facet's button needs to show for the values chosen. */
export function facetSummary(labels: string[]): { value?: string; count: number } {
  return { value: labels.length === 1 ? labels[0] : undefined, count: labels.length }
}

export interface FacetOpenProps {
  /** Open the list as soon as it mounts: a facet just added from "+ Filter". */
  initiallyOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function FacetSelect({
  label,
  options,
  value,
  onChange,
  searchable = true,
  renderOption,
  pinned = [],
  initiallyOpen = false,
  onOpenChange,
}: FacetOpenProps & {
  label: string
  options: Array<{ value: string; label: string }>
  /** Options that are about the field rather than a value of it ("Belum diisi"), kept above a divider. */
  pinned?: Array<{ value: string; label: string }>
  value: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
  renderOption?: (option: { value: string; label: string }) => React.ReactNode
}) {
  const [open, setOpenState] = useState(initiallyOpen)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const chosen = new Set(value)
  const flip = (item: string) => onChange(chosen.has(item) ? value.filter((v) => v !== item) : [...value, item])
  const all = [...pinned, ...options]
  const summary = facetSummary(value.map((item) => all.find((option) => option.value === item)?.label ?? item))

  const item = (option: { value: string; label: string }, isPinned: boolean) => (
    <CommandItem key={option.value} value={option.label} onSelect={() => flip(option.value)} className="min-h-12 gap-3 md:min-h-8 md:gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "grid h-5 w-5 place-items-center rounded-[4px] border border-input md:h-4 md:w-4",
          chosen.has(option.value) && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {chosen.has(option.value) && <Check className="h-3 w-3" />}
      </span>
      {renderOption && !isPinned ? renderOption(option) : <span className={cn("truncate", isPinned && "text-muted-foreground")}>{option.label}</span>}
    </CommandItem>
  )

  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title={label}
      className="w-64"
      trigger={<span><FacetButton label={label} value={summary.value} count={summary.count} open={open} /></span>}
    >
        <Command>
          {searchable && all.length > 6 && <CommandInput placeholder={`Cari ${label.toLowerCase()}…`} />}
          <CommandList className="max-h-[55dvh] md:max-h-72">
            <CommandEmpty>Tidak ada pilihan.</CommandEmpty>
            {pinned.length > 0 && (
              <>
                <CommandGroup>{pinned.map((option) => item(option, true))}</CommandGroup>
                {options.length > 0 && <CommandSeparator />}
              </>
            )}
            <CommandGroup>{options.map((option) => item(option, false))}</CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
                <X className="h-3.5 w-3.5" /> Kosongkan
              </Button>
            </div>
          )}
        </Command>
    </ResponsivePopover>
  )
}

/**
 * A facet the bar shows only while it is in use. Everything else about it
 * lives in `render`, which gets the open-state props so a facet just picked
 * from "+ Filter" opens at once and disappears again if left empty.
 */
export interface FacetSpec {
  key: string
  label: string
  active: boolean
  render: (props: FacetOpenProps) => React.ReactNode
}
