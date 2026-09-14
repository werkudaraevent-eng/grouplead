"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PersonAvatar } from "@/components/person-avatar"
import { cn } from "@/lib/utils"
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  countActiveFacets,
  serializeMissionQuery,
  type DatePreset,
  type MissionQuery,
} from "@/lib/missions/mission-filter"
import { STATUS_LABELS } from "@/lib/missions/status-labels"
import type { MissionStatus } from "@/lib/missions/mission-schema"

/**
 * The filter panel.
 *
 * The shape is the one Linear, HubSpot and Notion converged on, taken as
 * rules rather than pixels:
 *
 *   - Search is always visible and matches across the fields a person would
 *     scan for by eye. It debounces, because a list that flickers per
 *     keystroke reads as broken.
 *   - Each facet is a button that opens a checklist; picking several ORs
 *     them, and the button's label carries the count so a collapsed facet
 *     still says what it is doing.
 *   - Everything active is repeated as removable chips under the bar, plus
 *     one "Bersihkan" for all of it. What narrows the list is never hidden.
 *   - The whole state lives in the URL, so a view can be bookmarked, sent to
 *     a colleague, or exported exactly as seen.
 */

const STATUS_OPTIONS: MissionStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "RESCHEDULE_REQUESTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]

export interface FilterPerson {
  id: string
  name: string
  avatarUrl: string | null
}

function FacetButton({
  label,
  count,
  open,
}: {
  label: string
  count: number
  open: boolean
}) {
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

/** A checklist facet. Values OR together. */
function MultiFacet({
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

/** Date facet: presets, plus a from/to pair for "Rentang tanggal". */
function DateFacet({
  value,
  from,
  to,
  onChange,
}: {
  value: DatePreset | null
  from: string | null
  to: string | null
  onChange: (next: { date: DatePreset | null; from: string | null; to: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span><FacetButton label={value ? DATE_PRESET_LABELS[value] : "Tanggal"} count={value ? 1 : 0} open={open} /></span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="grid gap-0.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onChange({ date: preset, from: preset === "custom" ? from : null, to: preset === "custom" ? to : null })
                if (preset !== "custom") setOpen(false)
              }}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted",
                value === preset && "bg-muted font-semibold"
              )}
            >
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", value === preset ? "bg-primary" : "bg-transparent")} />
              {DATE_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        {value === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2">
            <div className="space-y-1">
              <Label htmlFor="filter-from" className="text-xs">Dari</Label>
              <Input id="filter-from" type="date" className="h-9" value={from ?? ""} onChange={(e) => onChange({ date: "custom", from: e.target.value || null, to })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-to" className="text-xs">Sampai</Label>
              <Input id="filter-to" type="date" className="h-9" value={to ?? ""} onChange={(e) => onChange({ date: "custom", from, to: e.target.value || null })} />
            </div>
          </div>
        )}
        {value && (
          <div className="mt-2 border-t pt-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { onChange({ date: null, from: null, to: null }); setOpen(false) }}>
              <X className="h-3.5 w-3.5" /> Kosongkan
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border bg-card pl-3 pr-1 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus filter ${label}`}
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function MissionFilterBar({
  query,
  people,
  types,
  locations,
  total,
  shown,
}: {
  query: MissionQuery
  people: FilterPerson[]
  types: string[]
  locations: string[]
  /** Unfiltered and filtered counts, so the bar can say "12 dari 40". */
  total: number
  shown: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState(query.q)
  const skipFirst = useRef(true)

  const push = (next: MissionQuery) => {
    const params = serializeMissionQuery(next)
    // The answer lens lives beside the query and is kept as is.
    const lens = searchParams.get("filter")
    if (lens) params.set("filter", lens)
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  // Debounced search. The facets push immediately; typing does not.
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    if (text.trim() === query.q) return
    const timer = setTimeout(() => push({ ...query, q: text.trim() }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const active = countActiveFacets(query)
  const personName = (id: string) => people.find((person) => person.id === id)?.name ?? id

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cari perusahaan, lokasi, tujuan, orang…"
            aria-label="Cari mission"
            className="h-10 pl-9 md:h-9"
          />
        </div>

        <MultiFacet
          label="Status"
          options={STATUS_OPTIONS.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
          value={query.status}
          onChange={(status) => push({ ...query, status })}
          searchable={false}
        />
        <MultiFacet
          label="Sales"
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          value={query.sales}
          onChange={(sales) => push({ ...query, sales })}
          renderOption={(option) => {
            const person = people.find((item) => item.id === option.value)
            return (
              <span className="flex min-w-0 items-center gap-2">
                <PersonAvatar name={option.label} avatarUrl={person?.avatarUrl ?? null} size="sm" />
                <span className="truncate">{option.label}</span>
              </span>
            )
          }}
        />
        <MultiFacet
          label="Lokasi"
          options={locations.map((location) => ({ value: location, label: location }))}
          value={query.location}
          onChange={(location) => push({ ...query, location })}
        />
        <MultiFacet
          label="Jenis"
          options={types.map((type) => ({ value: type, label: type }))}
          value={query.type}
          onChange={(type) => push({ ...query, type })}
          searchable={false}
        />
        <DateFacet
          value={query.date}
          from={query.from}
          to={query.to}
          onChange={(next) => push({ ...query, ...next })}
        />

        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {pending ? "Menyaring…" : active > 0 ? `${shown} dari ${total} mission` : `${total} mission`}
        </span>
      </div>

      {active > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {query.q && <Chip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => (
            <Chip key={status} label={STATUS_LABELS[status as MissionStatus] ?? status} onRemove={() => push({ ...query, status: query.status.filter((s) => s !== status) })} />
          ))}
          {query.sales.map((id) => (
            <Chip key={id} label={personName(id)} onRemove={() => push({ ...query, sales: query.sales.filter((s) => s !== id) })} />
          ))}
          {query.location.map((location) => (
            <Chip key={location} label={location} onRemove={() => push({ ...query, location: query.location.filter((l) => l !== location) })} />
          ))}
          {query.type.map((type) => (
            <Chip key={type} label={type} onRemove={() => push({ ...query, type: query.type.filter((t) => t !== type) })} />
          ))}
          {query.date && (
            <Chip
              label={
                query.date === "custom"
                  ? [query.from, query.to].filter(Boolean).join(" – ") || DATE_PRESET_LABELS.custom
                  : DATE_PRESET_LABELS[query.date]
              }
              onRemove={() => push({ ...query, date: null, from: null, to: null })}
            />
          )}
          <button
            type="button"
            onClick={() => { setText(""); push({ q: "", status: [], type: [], sales: [], location: [], date: null, from: null, to: null }) }}
            className="ml-1 text-xs font-semibold text-primary hover:underline"
          >
            Bersihkan semua
          </button>
        </div>
      )}
    </div>
  )
}
