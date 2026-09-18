"use client"

import { useState } from "react"
import { Plus } from "@/components/icons"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ResponsivePopover } from "@/components/responsive-popover"
import { Button } from "@/components/ui/button"
import type { FacetSpec } from "@/components/facet-select"

/**
 * "+ Filter": the bar shows only the facets in use, and this is how another
 * one joins them (Linear, Notion, Jira). It lists the fields not yet in the
 * bar; picking one puts that facet in the bar with its list already open.
 */
export function AddFilter({ specs, onPick }: { specs: FacetSpec[]; onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  if (specs.length === 0) return null
  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Tambah filter"
      className="w-56"
      trigger={
        <span>
          <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-muted-foreground hover:text-foreground md:h-9" aria-expanded={open} aria-haspopup="listbox">
            <Plus className="h-4 w-4" /> Filter
          </Button>
        </span>
      }
    >
      <Command>
        {specs.length > 6 && <CommandInput placeholder="Cari filter…" />}
        <CommandList>
          <CommandEmpty>Tidak ada filter lain.</CommandEmpty>
          <CommandGroup>
            {specs.map((spec) => (
              <CommandItem
                key={spec.key}
                value={spec.label}
                onSelect={() => {
                  setOpen(false)
                  onPick(spec.key)
                }}
                className="min-h-12 md:min-h-8"
              >
                {spec.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePopover>
  )
}
