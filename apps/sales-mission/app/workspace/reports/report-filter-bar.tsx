"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "@/components/icons"
import { FilterBarFrame } from "@/components/filter-bar-frame"
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

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border bg-card pl-3 pr-1 text-xs font-medium text-foreground">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Hapus filter ${label}`} className="relative grid h-7 w-7 place-items-center rounded-full text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-muted hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function ReportFilterBar({
  query,
  choices,
  people,
  total,
  shown,
}: {
  query: ReportQuery
  choices: ChoiceSet
  people: FilterPerson[]
  total: number
  shown: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState(query.q)
  const skipFirst = useRef(true)

  const push = (next: ReportQuery) => {
    const params = serializeReportQuery(next)
    const sort = searchParams.get("sort")
    if (sort) params.set("sort", sort)
    const size = searchParams.get("size")
    if (size) params.set("size", size)
    const qs = params.toString()
    rememberView("reports", qs)
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
      summary={
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Menyaring…" : active > 0 ? `${shown} dari ${total} laporan` : `${total} laporan`}
        </span>
      }
      chips={active > 0 ? (
        <>
          {query.q && <Chip label={`“${query.q}”`} onRemove={() => { setText(""); push({ ...query, q: "" }) }} />}
          {query.status.map((status) => <Chip key={status} label={REPORT_STATUS_LABELS[status]} onRemove={() => push({ ...query, status: query.status.filter((item) => item !== status) })} />)}
          {query.outcome.map((code) => <Chip key={code} label={labelIn(outcomeOptions, code)} onRemove={() => push({ ...query, outcome: query.outcome.filter((item) => item !== code) })} />)}
          {query.interest.map((code) => <Chip key={code} label={labelIn(interestOptions, code)} onRemove={() => push({ ...query, interest: query.interest.filter((item) => item !== code) })} />)}
          {query.nextAction.map((code) => <Chip key={code} label={labelIn(actionOptions, code)} onRemove={() => push({ ...query, nextAction: query.nextAction.filter((item) => item !== code) })} />)}
          {query.sales.map((id) => <Chip key={id} label={personName(id)} onRemove={() => push({ ...query, sales: query.sales.filter((item) => item !== id) })} />)}
          {query.opportunity !== null && <Chip label={query.opportunity ? "Ada peluang" : "Tanpa peluang"} onRemove={() => push({ ...query, opportunity: null })} />}
          {query.pushed !== null && <Chip label={query.pushed ? "Sudah dikirim ke CRM" : "Belum dikirim"} onRemove={() => push({ ...query, pushed: null })} />}
          {query.date && (
            <Chip
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
