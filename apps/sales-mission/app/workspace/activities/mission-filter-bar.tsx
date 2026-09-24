"use client"

import { FilterChip } from "@/components/filter-chip"
import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "@/components/icons"
import { ResponsivePopover } from "@/components/responsive-popover"
import { FilterBarFrame } from "@/components/filter-bar-frame"
import { rememberView } from "@/components/remember-view"
import { FacetButton, FacetSelect, type FacetOpenProps, type FacetSpec } from "@/components/facet-select"
import { ToggleChip } from "@/components/toggle-chip"
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
  type DatePreset,
  type MissionFilter,
  type MissionQuery,
  SALES_ME,
} from "@/lib/missions/mission-filter"
import {
  LENS_CHIP_LABELS,
  activityListParams,
  countNarrowing,
  hasMe,
  salesOthers,
  toggleLens,
  toggleMe,
  withSalesOthers,
  type AnswerLens,
} from "@/lib/missions/quick-filters"
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
 *   - The everyday narrowings are in the bar itself, each in one place:
 *     Tanggal (whose values are Hari ini, Minggu ini, Mendatang …) is
 *     always there, "Saya" is a toggle chip, and while the unit asks for
 *     answers so are "Butuh jawaban" and "Menunggu tim" with their counts
 *     (see lib/missions/quick-filters.ts). On a phone these sit in a row
 *     under the search, one tap each.
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


export function MissionFilterBar({
  query,
  lens,
  lenses,
  lensCounts,
  people,
  types,
  locations,
  industries,
  total,
  shown,
}: {
  query: MissionQuery
  /** The answer lens in force ("all" when none, or when the unit asks for no answers). */
  lens: MissionFilter
  /** The answer lenses the unit's policy offers as toggle chips; none when nobody is asked. */
  lenses: readonly AnswerLens[]
  /** How many activities each lens would leave, under the rest of the query. */
  lensCounts: Record<AnswerLens, number>
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

  const push = (next: MissionQuery, nextLens: MissionFilter = lens) => {
    // The answer lens lives beside the query and is kept unless a lens chip
    // or "Bersihkan semua" changes it. A filter change keeps the sort and
    // the page size and starts again from the first page, the same on
    // Aktivitas, Prospek and Laporan.
    const params = activityListParams(next, nextLens, { sort: searchParams.get("sort"), size: searchParams.get("size") })
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

  const active = countNarrowing(query, lens)
  const personName = (id: string) => (id === SALES_ME ? "Saya" : (people.find((person) => person.id === id)?.name ?? id))
  const others = salesOthers(query)
  const clearAll = () => { setText(""); push(EMPTY_QUERY, "all") }

  const more: FacetSpec[] = [
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
      quick={
        <>
          {/* Whose, then when, then who owes an answer: "Saya" is the chip a
              rep reaches for most, so on a phone it is never the one past
              the screen's edge. Text only at rest, as the chips row was: a
              row of seven controls on a laptop has no width for an icon each. */}
          <ToggleChip label="Saya" pressed={hasMe(query)} onToggle={() => push(toggleMe(query))} />
          <DateFacet value={query.date} from={query.from} to={query.to} onChange={(next) => push({ ...query, ...next })} />
          {lenses.map((item) => (
            <ToggleChip
              key={item}
              label={LENS_CHIP_LABELS[item]}
              pressed={lens === item}
              onToggle={() => push(query, toggleLens(lens, item))}
              count={lensCounts[item]}
              countTone={item === "mine" ? "warning" : "neutral"}
              showZero
            />
          ))}
        </>
      }
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
          value={others}
          onChange={(next) => push(withSalesOthers(query, next))}
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
      onClearAll={clearAll}
      more={more}
      summary={
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Menyaring…" : active > 0 ? `${shown} dari ${total} aktivitas` : `${total} aktivitas`}
        </span>
      }
      // Saya, the date and the lenses are in the phone's row of their own
      // (`quick`), so they are not repeated here.
      chips={countNarrowing({ ...query, sales: others, date: null }, "all") > 0 ? (
        <>
          {query.q && <FilterChip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => (
            <FilterChip key={status} label={STATUS_LABELS[status as MissionStatus] ?? status} onRemove={() => push({ ...query, status: query.status.filter((s) => s !== status) })} />
          ))}
          {others.map((id) => (
            <FilterChip key={id} label={personName(id)} onRemove={() => push({ ...query, sales: query.sales.filter((s) => s !== id) })} />
          ))}
          {query.report.map((state) => (
            <FilterChip key={`report-${state}`} label={VISIT_STATE_LABELS[state]} onRemove={() => push({ ...query, report: query.report.filter((r) => r !== state) })} />
          ))}
          {query.creator.map((id) => (
            <FilterChip key={`creator-${id}`} label={`Dibuat oleh ${personName(id)}`} onRemove={() => push({ ...query, creator: query.creator.filter((c) => c !== id) })} />
          ))}
          {query.location.map((location) => (
            <FilterChip key={location} label={location} onRemove={() => push({ ...query, location: query.location.filter((l) => l !== location) })} />
          ))}
          {query.industry.map((industry) => (
            <FilterChip
              key={`industry-${industry}`}
              label={industry === INDUSTRY_NONE ? `Industri ${INDUSTRY_NONE_LABEL.toLowerCase()}` : industry}
              onRemove={() => push({ ...query, industry: query.industry.filter((i) => i !== industry) })}
            />
          ))}
          {query.type.map((type) => (
            <FilterChip key={type} label={type} onRemove={() => push({ ...query, type: query.type.filter((t) => t !== type) })} />
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-xs font-semibold text-primary hover:underline"
          >
            Bersihkan semua
          </button>
        </>
      ) : null}
    />
  )
}
