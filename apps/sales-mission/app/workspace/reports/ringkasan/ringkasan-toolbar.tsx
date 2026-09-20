"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Check, Loader2, MoreVertical, Plus, Settings2, Sparkles } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FacetSelect } from "@/components/facet-select"
import { PersonAvatar } from "@/components/person-avatar"
import { rememberView } from "@/components/remember-view"
import { Segmented } from "@/components/segmented"
import { RINGKASAN_PRESETS, RINGKASAN_PRESET_LABELS, serializeRingkasanQuery, type RingkasanQuery } from "@/lib/reporting/ringkasan-filter"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * One row: what to show on the left (the period as a segmented button,
 * a custom range's two dates, whose visits as the Sales facet), how it
 * is shown on the right ("Tanya AI" when the unit has it, "Atur widget",
 * and in that mode "Tambah widget", "Selesai" and an overflow with
 * "Susunan awal"). The filters are the URL; the cookie remembers them for
 * the next bare open.
 */
export function RingkasanToolbar({
  query,
  range,
  people,
  editing,
  saving,
  onEditingChange,
  onAddWidget,
  onReset,
  resetLabel = "Kembali ke susunan awal",
  onPublish,
  onAsk,
}: {
  query: RingkasanQuery
  range: { from: string; to: string }
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  editing: boolean
  saving: boolean
  onEditingChange: (editing: boolean) => void
  onAddWidget: () => void
  onReset: () => void
  resetLabel?: string
  /** Admin only: make this board the unit's default. */
  onPublish?: () => void
  /** Opens the Tanya AI pane; absent when the unit has not switched it on or the person may not use it. */
  onAsk?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const push = (next: RingkasanQuery) => {
    const qs = serializeRingkasanQuery({ ...next, day: null }).toString()
    // Written before navigating: a bare URL would otherwise be restored to
    // the filter the person is leaving.
    rememberView("ringkasan", qs)
    startTransition(() => router.replace(paths.reportSummary(qs), { scroll: false }))
  }

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", pending && "opacity-70")}>
      <Segmented
        label="Periode"
        value={query.date}
        options={RINGKASAN_PRESETS.map((preset) => ({ value: preset, label: RINGKASAN_PRESET_LABELS[preset] }))}
        onChange={(date) => push({ ...query, date, from: date === "custom" ? (query.from ?? range.from) : null, to: date === "custom" ? (query.to ?? range.to) : null })}
      />
      {query.date === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="Dari"
            value={query.from ?? range.from}
            max={query.to ?? range.to}
            onChange={(event) => push({ ...query, from: event.target.value || null })}
            className="h-10 rounded-md border border-input bg-field px-2.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            aria-label="Sampai"
            value={query.to ?? range.to}
            min={query.from ?? range.from}
            onChange={(event) => push({ ...query, to: event.target.value || null })}
            className="h-10 rounded-md border border-input bg-field px-2.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9"
          />
        </div>
      )}
      <FacetSelect
        label="Sales"
        options={people.map((person) => ({ value: person.id, label: person.name }))}
        value={query.sales.filter((id) => id !== "me")}
        onChange={(next) => push({ ...query, sales: query.sales.includes("me") ? ["me", ...next] : next })}
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
      <button
        type="button"
        aria-pressed={query.sales.includes("me")}
        onClick={() => push({ ...query, sales: query.sales.includes("me") ? query.sales.filter((id) => id !== "me") : ["me", ...query.sales] })}
        className={cn(
          "relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors md:h-9",
          query.sales.includes("me") ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "border-input bg-transparent text-foreground hover:bg-muted"
        )}
      >
        {query.sales.includes("me") && <Check className="h-4 w-4" aria-hidden="true" />}
        Saya
      </button>

      <div className="ml-auto flex items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Menyimpan susunan" />}
        {editing ? (
          <>
            <Button type="button" variant="outline" size="sm" className="h-10 md:h-9" onClick={onAddWidget}>
              <Plus className="h-4 w-4" /> Tambah widget
            </Button>
            <Button type="button" size="sm" className="h-10 md:h-9" onClick={() => onEditingChange(false)}>
              <Check className="h-4 w-4" /> Selesai
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full md:h-9 md:w-9" aria-label="Lainnya">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {onPublish && <DropdownMenuItem onSelect={onPublish}>Jadikan susunan awal semua akun</DropdownMenuItem>}
                <DropdownMenuItem onSelect={onReset}>{resetLabel}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {onAsk && (
              <Button type="button" variant="outline" size="sm" className="h-10 md:h-9" onClick={onAsk}>
                <Sparkles className="h-4 w-4" /> Tanya AI
              </Button>
            )}
            {/* On a phone this door is in the top bar's overflow (DashboardEditor). */}
            <Button type="button" variant="outline" size="sm" className="hidden h-10 md:inline-flex md:h-9" onClick={() => onEditingChange(true)}>
              <Settings2 className="h-4 w-4" /> Atur widget
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
