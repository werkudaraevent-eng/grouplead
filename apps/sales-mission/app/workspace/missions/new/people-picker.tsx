"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
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

/**
 * Choosing people from the tenant's directory.
 *
 * Replaces a wall of checkboxes: sixteen names took four rows before the next
 * question was even visible, gave no way to find a person except reading every
 * one, and grew worse with every new hire. A searchable list costs one tap and
 * stays the same height at sixteen names or a hundred and sixty.
 *
 * Material Design 3 supplies the rules, not the skin:
 *   - selected values are input chips carrying their own remove affordance,
 *     which is what M3 uses for a committed multi-value choice
 *   - every target is 48dp, M3's minimum, rather than the 44 the WCAG floor
 *     would allow
 *   - the trigger reads as a text field: same height, same border, same focus
 *     ring as the inputs above it, because it answers the same kind of question
 *   - search appears only past a threshold, since a picker for three people
 *     that demands typing is worse than three visible options
 *
 * The colours, radii and type are this app's existing tokens throughout. None
 * of M3's palette or shape system is imported.
 */

export interface Person {
  id: string
  name: string
}

/** Below this, a search box costs more than it saves. M3 calls the same idea a menu. */
const SEARCH_THRESHOLD = 7

const TRIGGER_CLASS =
  "flex h-12 w-full items-center justify-between gap-2 rounded-md border border-input bg-field px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?"
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
    >
      {initials(name)}
    </span>
  )
}

/** One person. Submits a single hidden value under `name`. */
export function PersonPicker({
  id,
  name,
  people,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string
  name: string
  people: Person[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = people.find((person) => person.id === value) ?? null

  return (
    <>
      {/*
        The real form value. The button is the affordance, this is the field.

        No `required` here: browsers exclude hidden inputs from constraint
        validation, so the attribute would have promised a check that never
        runs. createMission enforces the tenant's required fields server-side,
        and the form scrolls its error banner into view, so the empty case is
        caught, just one round trip later. `aria-required` on the trigger is
        what tells assistive tech the same thing.
      */}
      <input type="hidden" name={name} value={value} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-required={required || undefined}
            className={TRIGGER_CLASS}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={selected.name} />
                <span className="truncate text-foreground">{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <PeopleList
            people={people}
            isSelected={(person) => person.id === value}
            onPick={(person) => {
              onChange(person.id === value ? "" : person.id)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

/** Several people. Submits one hidden input per selection, so FormData keeps the array. */
export function PeopleMultiPicker({
  id,
  name,
  people,
  value,
  onChange,
  placeholder,
  emptyLabel,
}: {
  id: string
  name: string
  people: Person[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  /** Shown instead of the control when there is nobody left to pick. */
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(value), [value])
  const selected = people.filter((person) => selectedSet.has(person.id))

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const toggle = (person: Person) => {
    onChange(
      selectedSet.has(person.id)
        ? value.filter((item) => item !== person.id)
        : [...value, person.id]
    )
  }

  return (
    <div className="space-y-2">
      {value.map((personId) => (
        <input key={personId} type="hidden" name={name} value={personId} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} className={TRIGGER_CLASS}>
            <span className={selected.length > 0 ? "text-foreground" : "text-muted-foreground"}>
              {selected.length > 0 ? `${selected.length} sales dipilih` : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <PeopleList
            people={people}
            isSelected={(person) => selectedSet.has(person.id)}
            onPick={toggle}
            keepOpen
          />
        </PopoverContent>
      </Popover>

      {/* Input chips: what is chosen stays visible and removable without
          reopening the list, which is the whole reason to use chips rather
          than a count alone. */}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((person) => (
            <li key={person.id}>
              <span className="flex h-9 items-center gap-1.5 rounded-full border bg-muted/60 py-1 pl-2 pr-1 text-sm">
                <Avatar name={person.name} />
                <span className="max-w-45 truncate text-foreground">{person.name}</span>
                {/*
                  Drawn at 28px, touched at 48px. Material puts the chip's
                  trailing icon well under the minimum target and recovers it by
                  expanding the hit area rather than inflating the chip, because
                  a row of 48px chips stops reading as a compact summary. The
                  ::after carries the extra area; nothing about it is visible.
                */}
                <button
                  type="button"
                  onClick={() => toggle(person)}
                  aria-label={`Hapus ${person.name} dari sales pendukung`}
                  className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PeopleList({
  people,
  isSelected,
  onPick,
  keepOpen = false,
}: {
  people: Person[]
  isSelected: (person: Person) => boolean
  onPick: (person: Person) => void
  keepOpen?: boolean
}) {
  const searchable = people.length >= SEARCH_THRESHOLD

  return (
    <Command>
      {searchable && (
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <CommandInput
            placeholder="Cari nama…"
            className="h-12 border-0 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <CommandList className="max-h-64">
        <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
          Tidak ada nama yang cocok.
        </CommandEmpty>
        <CommandGroup className="p-1">
          {people.map((person) => {
            const picked = isSelected(person)
            return (
              <CommandItem
                key={person.id}
                value={person.name}
                onSelect={() => onPick(person)}
                // 48dp, Material's minimum target, not the 44 WCAG would accept.
                className={cn(
                  "flex h-12 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm",
                  keepOpen && "aria-selected:bg-muted"
                )}
              >
                <Avatar name={person.name} />
                <span className="min-w-0 flex-1 truncate text-foreground">{person.name}</span>
                <Check className={cn("h-4 w-4 shrink-0 text-primary", picked ? "opacity-100" : "opacity-0")} />
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
