"use client"

import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A facet: a button that opens a checklist. Values OR together.
 *
 * Material's filter chip, grown up: the label carries the count so a closed
 * facet still says what it is doing, and the list clears from inside so the
 * person never hunts for where a selection went. Shared by every filterable
 * list so they all behave the same way.
 */
export function FacetButton({ label, count, open }: { label: string; count: number; open: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      role="combobox"
      aria-expanded={open}
      className={cn("h-10 gap-1.5 md:h-9", count > 0 && "border-primary/50 bg-primary/5 text-foreground")}
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{count}</span>
      )}
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  )
}

export function FacetSelect({
  label,
  options,
  value,
  onChange,
  searchable = true,
  renderOption,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
  renderOption?: (option: { value: string; label: string }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const chosen = new Set(value)
  const flip = (item: string) => onChange(chosen.has(item) ? value.filter((v) => v !== item) : [...value, item])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span><FacetButton label={label} count={value.length} open={open} /></span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          {searchable && options.length > 6 && <CommandInput placeholder={`Cari ${label.toLowerCase()}…`} />}
          <CommandList className="max-h-72">
            <CommandEmpty>Tidak ada pilihan.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} value={option.label} onSelect={() => flip(option.value)} className="gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-[4px] border border-input",
                      chosen.has(option.value) && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {chosen.has(option.value) && <Check className="h-3 w-3" />}
                  </span>
                  {renderOption ? renderOption(option) : <span className="truncate">{option.label}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
                <X className="h-3.5 w-3.5" /> Kosongkan
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
