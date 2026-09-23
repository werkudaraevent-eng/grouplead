"use client"

import { FilterChip } from "@/components/filter-chip"
import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarClock, Check, Search } from "@/components/icons"
import { FilterBarFrame } from "@/components/filter-bar-frame"
import { rememberView } from "@/components/remember-view"
import { FacetSelect } from "@/components/facet-select"
import { Input } from "@/components/ui/input"
import { PersonAvatar } from "@/components/person-avatar"
import { cn } from "@/lib/utils"
import {
  EMPTY_PROSPECT_QUERY,
  MANUAL_SOURCE,
  STATE_PREFIX,
  UNASSIGNED,
  countActiveProspectFacets,
  serializeProspectQuery,
  type ProspectQuery,
} from "@/lib/prospects/prospect-filter"
import { COLOR_DOT, DERIVED_STATES, type ProspectStatus } from "@/lib/prospects/prospect-status"
import type { ImportBatchOption } from "@/lib/prospects/prospect-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * The prospect list's filter bar: the mission bar's shape (search, facets
 * as filter chips with counts, active facets repeated as removable chips,
 * state in the URL), with one extra: a toggle for "due today", the
 * question a rep opens this list with every morning.
 */

export interface FilterPerson {
  id: string
  name: string
  avatarUrl: string | null
}


const batchLabel = (batch: ImportBatchOption) => {
  const when = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(batch.createdAt))
  return `${batch.fileName} · ${when}${batch.createdByName ? ` · ${batch.createdByName}` : ""}`
}

export function ProspectFilterBar({
  query,
  statuses,
  people,
  batches,
  total,
  shown,
  dueCount,
}: {
  query: ProspectQuery
  statuses: ProspectStatus[]
  people: FilterPerson[]
  batches: ImportBatchOption[]
  total: number
  shown: number
  dueCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState(query.q)
  const skipFirst = useRef(true)

  const push = (next: ProspectQuery) => {
    const params = serializeProspectQuery(next)
    // A filter change keeps the sort and the page size and starts again from
    // the first page, the same on Aktivitas, Prospek and Laporan.
    for (const key of ["sort", "size"]) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    rememberView("prospects", qs)
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

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

  const active = countActiveProspectFacets(query)
  const statusOptions = [
    ...statuses.filter((status) => status.isActive || query.status.includes(status.id)).map((status) => ({ value: status.id, label: status.isActive ? status.label : `${status.label} (diarsipkan)` })),
    ...DERIVED_STATES.map((state) => ({ value: `${STATE_PREFIX}${state.value}`, label: state.label })),
  ]
  const statusDot = (value: string) => {
    if (value.startsWith(STATE_PREFIX)) return COLOR_DOT[DERIVED_STATES.find((state) => state.value === value.slice(STATE_PREFIX.length))?.color ?? "neutral"]
    return COLOR_DOT[statuses.find((status) => status.id === value)?.color ?? "neutral"]
  }
  const statusLabel = (value: string) => statusOptions.find((option) => option.value === value)?.label ?? value
  const personName = (id: string) => (id === UNASSIGNED ? "Belum ada pemegang" : (people.find((person) => person.id === id)?.name ?? id))
  const batchName = (id: string) => (id === MANUAL_SOURCE ? "Manual" : (batches.find((batch) => batch.id === id) ? batchLabel(batches.find((batch) => batch.id === id)!) : id))

  return (
    <FilterBarFrame
      activeCount={active}
      search={
        <div className="relative min-w-0 flex-1 md:basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cari perusahaan, kontak, telepon, kota…"
            aria-label="Cari prospek"
            className="h-11 pl-9 md:h-9"
          />
        </div>
      }
      facets={
        <>
        <FacetSelect
          label="Status"
          options={statusOptions}
          value={query.status}
          onChange={(status) => push({ ...query, status })}
          searchable={false}
          renderOption={(option) => (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", statusDot(option.value))} />
              <span className="truncate">{option.label}</span>
            </span>
          )}
        />
        <FacetSelect
          label="Pemegang"
          options={[{ value: UNASSIGNED, label: "Belum ada pemegang" }, ...people.map((person) => ({ value: person.id, label: person.name }))]}
          value={query.owner}
          onChange={(owner) => push({ ...query, owner })}
          renderOption={(option) => {
            const person = people.find((item) => item.id === option.value)
            return (
              <span className="flex min-w-0 items-center gap-2">
                {person ? <PersonAvatar name={option.label} avatarUrl={person.avatarUrl} size="sm" /> : <span className="h-6 w-6 rounded-full border border-dashed" aria-hidden="true" />}
                <span className="truncate">{option.label}</span>
              </span>
            )
          }}
        />
        {(batches.length > 0 || query.batch.length > 0) && (
          <FacetSelect
            label="Sumber impor"
            options={[{ value: MANUAL_SOURCE, label: "Manual" }, ...batches.map((batch) => ({ value: batch.id, label: batchLabel(batch) }))]}
            value={query.batch}
            onChange={(batch) => push({ ...query, batch })}
          />
        )}
        {/* A toggle chip: pressed state, not a checklist, because it is one yes/no. */}
        <button
          type="button"
          aria-pressed={query.due}
          onClick={() => push({ ...query, due: !query.due })}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-foreground transition-colors md:h-9",
            query.due ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted"
          )}
        >
          {/* On: the same check and tint as a facet with a value (M3 filter chip). */}
          {query.due ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : <CalendarClock className="h-3.5 w-3.5" />}
          Butuh follow-up
          {dueCount > 0 && (
            <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold", query.due ? "bg-primary text-primary-foreground" : "bg-[var(--warning-foreground)] text-white")}>
              {dueCount}
            </span>
          )}
        </button>
        </>
      }
      onClearAll={() => { setText(""); push(EMPTY_PROSPECT_QUERY) }}
      summary={
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Menyaring…" : active > 0 ? `${shown} dari ${total} prospek` : `${total} prospek`}
        </span>
      }
      chips={active > 0 ? (
        <>
          {query.q && <FilterChip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => (
            <FilterChip key={status} label={statusLabel(status)} onRemove={() => push({ ...query, status: query.status.filter((s) => s !== status) })} />
          ))}
          {query.owner.map((id) => (
            <FilterChip key={id} label={personName(id)} onRemove={() => push({ ...query, owner: query.owner.filter((o) => o !== id) })} />
          ))}
          {query.batch.map((id) => (
            <FilterChip key={id} label={batchName(id)} onRemove={() => push({ ...query, batch: query.batch.filter((b) => b !== id) })} />
          ))}
          {query.due && <FilterChip label="Butuh follow-up" onRemove={() => push({ ...query, due: false })} />}
          <button type="button" onClick={() => { setText(""); push(EMPTY_PROSPECT_QUERY) }} className="ml-1 text-xs font-semibold text-primary hover:underline">
            Bersihkan semua
          </button>
        </>
      ) : null}
    />
  )
}
