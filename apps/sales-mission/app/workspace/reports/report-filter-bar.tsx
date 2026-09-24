"use client"

import { FilterChip } from "@/components/filter-chip"
import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Search, X } from "@/components/icons"
import { FilterBarFrame } from "@/components/filter-bar-frame"
import { REPORT_TABS_HEIGHT } from "@/app/workspace/reports/report-tabs"
import { useListNavigate } from "@/components/list-view/list-view-provider"
import { rememberView } from "@/components/remember-view"
import { FacetSelect, type FacetSpec } from "@/components/facet-select"
import { DateFacet, type FilterPerson } from "@/app/workspace/activities/mission-filter-bar"
import { Input } from "@/components/ui/input"
import { PersonAvatar } from "@/components/person-avatar"
import { DATE_PRESET_LABELS } from "@/lib/missions/mission-filter"
import { REPORT_STATUSES } from "@/lib/missions/visit-report-schema"
import { choicesFor, type ChoiceSet } from "@/lib/missions/report-choices"
import {
  EMPTY_REPORT_QUERY,
  REPORT_DATE_PRESETS,
  REPORT_STATUS_LABELS,
  UNASSIGNED_SALES,
  countActiveReportFacets,
  serializeReportQuery,
  type ReportQuery,
  type TriState,
} from "@/lib/reporting/report-filter"
import { cn } from "@/lib/utils"

/**
 * The report list's filter bar: the mission bar's shape (search, facets as
 * filter chips with counts, active facets repeated as removable chips,
 * state in the URL). Two of the facets are yes/no questions, so they are
 * a single choice rather than a checklist.
 */

const STATUS_DOT: Record<string, string> = {
  SUBMITTED: "bg-[var(--success-foreground)]",
  DRAFT: "bg-muted-foreground",
  NEEDS_CLARIFICATION: "bg-[var(--warning-foreground)]",
}

const TRI_OPTIONS = { yes: "1", no: "0" } as const
const triValue = (state: TriState): string[] => (state === null ? [] : [state ? TRI_OPTIONS.yes : TRI_OPTIONS.no])
const triFrom = (values: string[], previous: TriState): TriState => {
  // A single choice: the newest pick wins, picking the same one again clears it.
  const next = values.find((value) => !triValue(previous).includes(value)) ?? values[0]
  if (!next) return null
  return next === TRI_OPTIONS.yes
}


export function ReportFilterBar({
  query,
  choices,
  people,
}: {
  query: ReportQuery
  choices: ChoiceSet
  people: FilterPerson[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Through the list's one transition, so its count says "Menyaring…" until the list lands.
  const navigate = useListNavigate()
  const [text, setText] = useState(query.q)
  const skipFirst = useRef(true)

  const push = (next: ReportQuery) => {
    const params = serializeReportQuery(next)
    // A filter change keeps the sort and the page size and starts again from
    // the first page, the same on Aktivitas, Prospek and Laporan.
    for (const key of ["sort", "size"]) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    rememberView("reports", qs)
    navigate(qs ? `${pathname}?${qs}` : pathname)
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

  const active = countActiveReportFacets(query)
  const outcomeOptions = choicesFor(choices, "visit_outcome").map((choice) => ({ value: choice.code, label: choice.label }))
  const interestOptions = choicesFor(choices, "interest_level").map((choice) => ({ value: choice.code, label: choice.label }))
  const actionOptions = choicesFor(choices, "next_action_type").map((choice) => ({ value: choice.code, label: choice.label }))
  const labelIn = (options: Array<{ value: string; label: string }>, value: string) => options.find((option) => option.value === value)?.label ?? value
  const personName = (id: string) => (id === UNASSIGNED_SALES ? "Tanpa sales utama" : (people.find((person) => person.id === id)?.name ?? id))

  const more: FacetSpec[] = [
    {
      key: "outcome",
      label: "Hasil",
      active: query.outcome.length > 0,
      render: (props) => <FacetSelect {...props} label="Hasil" options={outcomeOptions} value={query.outcome} onChange={(outcome) => push({ ...query, outcome })} searchable={false} />,
    },
    {
      key: "interest",
      label: "Minat",
      active: query.interest.length > 0,
      render: (props) => <FacetSelect {...props} label="Minat" options={interestOptions} value={query.interest} onChange={(interest) => push({ ...query, interest })} searchable={false} />,
    },
    {
      key: "nextAction",
      label: "Next action",
      active: query.nextAction.length > 0,
      render: (props) => <FacetSelect {...props} label="Next action" options={actionOptions} value={query.nextAction} onChange={(nextAction) => push({ ...query, nextAction })} searchable={false} />,
    },
    {
      key: "opportunity",
      label: "Peluang",
      active: triValue(query.opportunity).length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Peluang"
          options={[{ value: TRI_OPTIONS.yes, label: "Ada peluang" }, { value: TRI_OPTIONS.no, label: "Tanpa peluang" }]}
          value={triValue(query.opportunity)}
          onChange={(values) => push({ ...query, opportunity: triFrom(values, query.opportunity) })}
          searchable={false}
        />
      ),
    },
    {
      key: "pushed",
      label: "Lead",
      active: triValue(query.pushed).length > 0,
      render: (props) => (
        <FacetSelect
          {...props}
          label="Lead"
          options={[{ value: TRI_OPTIONS.yes, label: "Sudah dikirim ke CRM" }, { value: TRI_OPTIONS.no, label: "Belum dikirim" }]}
          value={triValue(query.pushed)}
          onChange={(values) => push({ ...query, pushed: triFrom(values, query.pushed) })}
          searchable={false}
        />
      ),
    },
  ]

  return (
    <FilterBarFrame
      activeCount={active}
      // On a phone the search and chips come back under the tabs, which stay pinned.
      pinBelow={REPORT_TABS_HEIGHT}
      search={
        <div className="relative min-w-0 flex-1 md:max-w-md md:basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cari perusahaan, kota, sales…"
            aria-label="Cari laporan"
            className="h-11 pl-9 md:h-9"
          />
        </div>
      }
      facets={
        <>
        <FacetSelect
          label="Status"
          options={REPORT_STATUSES.map((status) => ({ value: status, label: REPORT_STATUS_LABELS[status] }))}
          value={query.status}
          onChange={(status) => push({ ...query, status: status as ReportQuery["status"] })}
          searchable={false}
          renderOption={(option) => (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[option.value] ?? "bg-muted-foreground")} />
              <span className="truncate">{option.label}</span>
            </span>
          )}
        />
        <FacetSelect
          label="Sales utama"
          options={[{ value: UNASSIGNED_SALES, label: "Tanpa sales utama" }, ...people.map((person) => ({ value: person.id, label: person.name }))]}
          value={query.sales}
          onChange={(sales) => push({ ...query, sales })}
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
        <DateFacet value={query.date} from={query.from} to={query.to} presets={REPORT_DATE_PRESETS} onChange={(next) => push({ ...query, ...next })} />
        </>
      }
      onClearAll={() => { setText(""); push(EMPTY_REPORT_QUERY) }}
      more={more}
      chips={active > 0 ? (
        <>
          {query.q && <FilterChip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => <FilterChip key={status} label={REPORT_STATUS_LABELS[status]} onRemove={() => push({ ...query, status: query.status.filter((item) => item !== status) })} />)}
          {query.outcome.map((code) => <FilterChip key={code} label={labelIn(outcomeOptions, code)} onRemove={() => push({ ...query, outcome: query.outcome.filter((item) => item !== code) })} />)}
          {query.interest.map((code) => <FilterChip key={code} label={labelIn(interestOptions, code)} onRemove={() => push({ ...query, interest: query.interest.filter((item) => item !== code) })} />)}
          {query.nextAction.map((code) => <FilterChip key={code} label={labelIn(actionOptions, code)} onRemove={() => push({ ...query, nextAction: query.nextAction.filter((item) => item !== code) })} />)}
          {query.sales.map((id) => <FilterChip key={id} label={personName(id)} onRemove={() => push({ ...query, sales: query.sales.filter((item) => item !== id) })} />)}
          {query.opportunity !== null && <FilterChip label={query.opportunity ? "Ada peluang" : "Tanpa peluang"} onRemove={() => push({ ...query, opportunity: null })} />}
          {query.pushed !== null && <FilterChip label={query.pushed ? "Sudah dikirim ke CRM" : "Belum dikirim"} onRemove={() => push({ ...query, pushed: null })} />}
          {query.date && (
            <FilterChip
              label={query.date === "custom" ? [query.from, query.to].filter(Boolean).join(" – ") || DATE_PRESET_LABELS.custom : DATE_PRESET_LABELS[query.date]}
              onRemove={() => push({ ...query, date: null, from: null, to: null })}
            />
          )}
          <button type="button" onClick={() => { setText(""); push(EMPTY_REPORT_QUERY) }} className="ml-1 text-xs font-semibold text-primary hover:underline">
            Bersihkan semua
          </button>
        </>
      ) : null}
    />
  )
}
