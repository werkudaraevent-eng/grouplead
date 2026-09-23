"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "@/components/icons"
import { ResponsivePopover } from "@/components/responsive-popover"
import { FilterBarFrame } from "@/components/filter-bar-frame"
import { rememberView } from "@/components/remember-view"
import { FacetButton, FacetSelect, type FacetOpenProps, type FacetSpec } from "@/components/facet-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PersonAvatar } from "@/components/person-avatar"
import { cn } from "@/lib/utils"
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  EMPTY_QUERY,
  INDUSTRY_NONE,
  REPORT_FACETS,
  countActiveFacets,
  serializeMissionQuery,
  type DatePreset,
  type MissionQuery,
  SALES_ME,
} from "@/lib/missions/mission-filter"
import { STATUS_LABELS } from "@/lib/missions/status-labels"
import type { MissionStatus } from "@/lib/missions/mission-schema"
import { VISIT_STATE_LABELS, type VisitState } from "@/lib/missions/visit-state"

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
 *   - On a desk the bar shows only the facets in use; the rest join it from
 *     "+ Filter" (Linear, Notion). On a phone the active ones are repeated
 *     as removable chips, because the facets sit behind one button there.
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

const INDUSTRY_NONE_LABEL = "Belum diisi"

export interface FilterPerson {
  id: string
  name: string
  avatarUrl: string | null
}

/** Date facet: presets, plus a from/to pair for "Rentang tanggal". */
export function DateFacet({
  value,
  from,
  to,
  onChange,
  presets = DATE_PRESETS,
  initiallyOpen = false,
  onOpenChange,
}: FacetOpenProps & {
  value: DatePreset | null
  from: string | null
  to: string | null
  onChange: (next: { date: DatePreset | null; from: string | null; to: string | null }) => void
  /** Which presets to offer; a list of past records has no use for "Mendatang". */
  presets?: readonly DatePreset[]
}) {
  const [open, setOpenState] = useState(initiallyOpen)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const body = (
      <div>
        <div className="grid gap-0.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onChange({ date: preset, from: preset === "custom" ? from : null, to: preset === "custom" ? to : null })
                if (preset !== "custom") setOpen(false)
              }}
              className={cn(
                "flex h-12 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted md:h-9",
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
              <Input id="filter-from" type="date" className="h-11 md:h-9" value={from ?? ""} onChange={(e) => onChange({ date: "custom", from: e.target.value || null, to })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-to" className="text-xs">Sampai</Label>
              <Input id="filter-to" type="date" className="h-11 md:h-9" value={to ?? ""} onChange={(e) => onChange({ date: "custom", from, to: e.target.value || null })} />
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
      </div>
  )

  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Tanggal"
      className="w-72 p-2"
      trigger={
        <span>
          <FacetButton
            label="Tanggal"
            value={value ? (value === "custom" ? [from, to].filter(Boolean).join(" – ") || DATE_PRESET_LABELS.custom : DATE_PRESET_LABELS[value]) : undefined}
            count={value ? 1 : 0}
            open={open}
          />
        </span>
      }
    >
      {body}
    </ResponsivePopover>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-card pl-3 pr-1 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus filter ${label}`}
        className="relative grid h-7 w-7 place-items-center rounded-full text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function MissionFilterBar({
  quick,
  query,
  people,
  types,
  locations,
  industries,
  total,
  shown,
}: {
  query: MissionQuery
  /** The quick-filter chip row; the frame decides where it sits. */
  quick?: React.ReactNode
  people: FilterPerson[]
  types: string[]
  locations: string[]
  industries: string[]
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
    // A filter change keeps the sort and the page size and starts again from
    // the first page, the same on Aktivitas, Prospek and Laporan.
    for (const key of ["sort", "size"]) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    rememberView("activities", qs)
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
  const personName = (id: string) => (id === SALES_ME ? "Saya" : (people.find((person) => person.id === id)?.name ?? id))

  const more: FacetSpec[] = [
    {
      key: "date",
      label: "Tanggal",
      active: query.date !== null,
      render: (props) => <DateFacet {...props} value={query.date} from={query.from} to={query.to} onChange={(next) => push({ ...query, ...next })} />,
    },
    {
      key: "report",
      label: "Laporan",
      active: query.report.length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Laporan"
          options={REPORT_FACETS.map((state) => ({ value: state, label: VISIT_STATE_LABELS[state] }))}
          value={query.report}
          onChange={(report) => push({ ...query, report: report as VisitState[] })}
          searchable={false}
        />
      ),
    },
    {
      key: "creator",
      label: "Dibuat oleh",
      active: query.creator.length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Dibuat oleh"
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          value={query.creator}
          onChange={(creator) => push({ ...query, creator })}
        />
      ),
    },
    {
      key: "location",
      label: "Lokasi",
      active: query.location.length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Lokasi"
          options={locations.map((location) => ({ value: location, label: location }))}
          value={query.location}
          onChange={(location) => push({ ...query, location })}
        />
      ),
    },
    {
      key: "industry",
      label: "Industri",
      active: query.industry.length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Industri"
          pinned={[{ value: INDUSTRY_NONE, label: INDUSTRY_NONE_LABEL }]}
          options={industries.map((industry) => ({ value: industry, label: industry }))}
          value={query.industry}
          onChange={(industry) => push({ ...query, industry })}
        />
      ),
    },
    {
      key: "type",
      label: "Jenis",
      active: query.type.length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Jenis"
          options={types.map((type) => ({ value: type, label: type }))}
          value={query.type}
          onChange={(type) => push({ ...query, type })}
          searchable={false}
        />
      ),
    },
  ]

  return (
    <FilterBarFrame
      activeCount={active}
      quick={quick}
      search={
        <div className="relative min-w-0 flex-1 md:max-w-md md:basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cari perusahaan, lokasi, tujuan, orang…"
            aria-label="Cari aktivitas"
            className="h-11 pl-9 md:h-9"
          />
        </div>
      }
      facets={
        <>
        <FacetSelect
          label="Status"
          options={STATUS_OPTIONS.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
          value={query.status}
          onChange={(status) => push({ ...query, status })}
          searchable={false}
        />
        <FacetSelect
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
        </>
      }
      onClearAll={() => { setText(""); push(EMPTY_QUERY) }}
      more={more}
      summary={
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Menyaring…" : active > 0 ? `${shown} dari ${total} aktivitas` : `${total} aktivitas`}
        </span>
      }
      chips={active > 0 ? (
        <>
          {query.q && <Chip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => (
            <Chip key={status} label={STATUS_LABELS[status as MissionStatus] ?? status} onRemove={() => push({ ...query, status: query.status.filter((s) => s !== status) })} />
          ))}
          {query.sales.map((id) => (
            <Chip key={id} label={personName(id)} onRemove={() => push({ ...query, sales: query.sales.filter((s) => s !== id) })} />
          ))}
          {query.report.map((state) => (
            <Chip key={`report-${state}`} label={VISIT_STATE_LABELS[state]} onRemove={() => push({ ...query, report: query.report.filter((r) => r !== state) })} />
          ))}
          {query.creator.map((id) => (
            <Chip key={`creator-${id}`} label={`Dibuat oleh ${personName(id)}`} onRemove={() => push({ ...query, creator: query.creator.filter((c) => c !== id) })} />
          ))}
          {query.location.map((location) => (
            <Chip key={location} label={location} onRemove={() => push({ ...query, location: query.location.filter((l) => l !== location) })} />
          ))}
          {query.industry.map((industry) => (
            <Chip
              key={`industry-${industry}`}
              label={industry === INDUSTRY_NONE ? `Industri ${INDUSTRY_NONE_LABEL.toLowerCase()}` : industry}
              onRemove={() => push({ ...query, industry: query.industry.filter((i) => i !== industry) })}
            />
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
            onClick={() => { setText(""); push(EMPTY_QUERY) }}
            className="ml-1 text-xs font-semibold text-primary hover:underline"
          >
            Bersihkan semua
          </button>
        </>
      ) : null}
    />
  )
}
